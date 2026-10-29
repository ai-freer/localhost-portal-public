(() => {
  'use strict';
  const SHARE_KEY = PortalInstance.site.storage.shares;
  const ALL = '全部分享';
  const $s = selector => document.querySelector(selector);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let config, activeCategory = ALL, query = '', editingId = null;
  const serviceWorkspace = $s('.workspace');
  const serviceChips = $s('#chips');
  const caption = $s('.sidebar-caption');
  const switcher = document.createElement('nav');
  switcher.className = 'space-switch';
  switcher.setAttribute('aria-label', '导航空间');
  switcher.innerHTML = '<button type="button" data-space="services" aria-pressed="true"><span class="space-emblem">'+PortalVisuals.icon('panel')+'</span><span>服务导航</span></button><button type="button" data-space="shares" aria-pressed="false"><span class="space-emblem">'+PortalVisuals.icon('folder')+'</span><span>分享链接</span></button>';
  caption.before(switcher);
  const shareChips = document.createElement('nav');
  shareChips.className = 'chips share-chips';
  shareChips.setAttribute('aria-label', '分享分类');
  shareChips.hidden = true;
  serviceChips.after(shareChips);
  const panel = document.createElement('div');
  panel.className = 'workspace shares-workspace';
  panel.hidden = true;
  panel.innerHTML = `
    <header><div><h1>分享链接</h1><p class="subtitle">${esc(PortalInstance.site.sharesSubtitle)}</p></div>
    <div class="header-actions"><details class="settings"><summary>分享配置</summary><div class="toolbar"><button id="share-export">导出分享</button><button id="share-import">导入分享</button><button id="share-reset">重置分享</button></div></details><button class="primary" id="share-add">＋ 添加链接</button></div></header>
    <div class="search"><span class="icon" aria-hidden="true"></span><input id="share-search" aria-label="搜索分享链接" placeholder="筛选当前分享：标题、原始名称或别名…" autocomplete="off"></div>
    <main><div class="list-heading"><h2><b id="share-view-title">全部分享</b><span id="share-count"></span></h2></div><div class="grid" id="share-grid"></div><div class="empty" id="share-empty" hidden>没有匹配的分享链接。试试其他关键词，或添加链接。</div></main>
    <footer><p>按主题收藏，打开阅读或复制链接分享。搜索仅限当前分享分类。</p></footer>
    <input type="file" id="share-file" accept="application/json,.json" aria-label="导入分享配置文件" hidden>`;
  serviceWorkspace.after(panel);
  const dialog = document.createElement('dialog');
  dialog.id = 'share-editor';
  dialog.setAttribute('aria-labelledby', 'share-form-title');
  dialog.innerHTML = `<form id="share-form"><h2 id="share-form-title">添加链接</h2>
    <label for="share-name">中文标题 *</label><input id="share-name" required>
    <label for="share-original">原始名称</label><input id="share-original">
    <label for="share-url">分享地址 *</label><input id="share-url" type="url" required placeholder="https://…">
    <div class="formrow"><div><label for="share-category">分类 *</label><input id="share-category" list="share-categories" required><datalist id="share-categories"></datalist></div><div><label for="share-date">日期（可选）</label><input id="share-date" type="date"></div></div>
    <label for="share-aliases">搜索别名（逗号分隔）</label><input id="share-aliases">
    <div class="formbtns"><button type="button" class="btn-cancel" id="share-cancel">取消</button><button type="submit" class="btn-save">保存</button></div></form>`;
  document.body.append(dialog);

  function validUrl(value) {
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  }
  const validate = PortalConfig.shares;
  async function defaults() { return validate(PortalInstance.shares); }
  function commit(next) {
    const validated = validate(next);
    localStorage.setItem(SHARE_KEY, JSON.stringify(validated));
    config = validated;
  }
  function currentList() {
    const q = query.trim().toLowerCase();
    const list = config.shares.filter(s => (activeCategory === ALL || s.category === activeCategory) && [s.name,s.originalName,s.category,s.date,...s.aliases].some(text => text.toLowerCase().includes(q)));
    // 分组保持配置顺序；排序方式由实例分类配置指定。
    return list.sort((a,b) => config.categories.indexOf(a.category) - config.categories.indexOf(b.category) || (PortalInstance.site.shareCategories[a.category]?.sort === 'date-desc' ? b.date.localeCompare(a.date) : 0));
  }
  function renderShares() {
    shareChips.innerHTML = '';
    for (const category of [ALL,...config.categories]) {
      const button = document.createElement('button');
      button.className = 'chip' + (category === activeCategory ? ' active' : '');
      button.setAttribute('aria-pressed', String(category === activeCategory));
      button.innerHTML = `<span class="nav-label"><span class="nav-icon">${PortalVisuals.category(category,true)}</span><span>${esc(category)}</span></span><span class="chip-count">${config.shares.filter(s => category === ALL || s.category === category).length}</span>`;
      button.onclick = () => { activeCategory = category; renderShares(); };
      shareChips.append(button);
    }
    $s('#share-view-title').textContent = activeCategory;
    const list = currentList();
    $s('#share-count').textContent = `${list.length} 个`;
    $s('#share-empty').hidden = list.length > 0;
    const grid = $s('#share-grid'); grid.innerHTML = '';
    for (const s of list) {
      const card = document.createElement('article'); card.className = 'card share-card';
      card.innerHTML = `<div class="share-top"><span class="share-meta">${esc(s.category)}${s.date ? ` <time datetime="${esc(s.date)}">${esc(s.date)}</time>` : ''}</span>${PortalVisuals.artwork(s)}</div><h3>${esc(s.name)}</h3><p class="share-original" title="${esc(s.originalName)}">${esc(s.originalName)}</p><div class="share-bottom"><a class="share-open" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">打开</a><button class="share-copy">复制链接</button><details class="share-menu"><summary aria-label="管理 ${esc(s.name)}">•••</summary><div class="toolbar"><button data-edit>编辑</button><button data-delete>删除</button></div></details></div>`;
      card.querySelector('.share-copy').onclick = async () => {
        try { await navigator.clipboard.writeText(s.url); toast('链接已复制'); }
        catch { toast('复制失败，请通过“打开”访问后复制地址'); }
      };
      card.querySelector('[data-edit]').onclick = () => { card.querySelector('details').open = false; openShareEditor(s); };
      card.querySelector('[data-delete]').onclick = () => {
        if (!confirm(`删除「${s.name}」？`)) return;
        try { commit({...config, shares:config.shares.filter(item => item.id !== s.id)}); renderShares(); toast('已删除链接'); }
        catch (error) { toast(error.message); }
      };
      PortalCardMedia.attach(card,s,'shares');
      grid.append(card);
    }
  }
  function switchSpace(space) {
    cancelUnified();
    unifiedPanel.hidden = true;
    $s('#unified-input').value = '';
    cancelJump();
    const sharing = space === 'shares';
    serviceWorkspace.hidden = sharing; serviceChips.hidden = sharing;
    panel.hidden = !sharing; shareChips.hidden = !sharing;
    caption.textContent = sharing ? '分享主题' : '服务目录';
    switcher.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.space === space)));
    if (sharing) renderShares();
    const url = new URL(location.href); url.searchParams.delete('q');
    if (sharing) url.searchParams.set('space','shares'); else url.searchParams.delete('space');
    history.replaceState(null, '', url);
  }
  function openShareEditor(s) {
    editingId = s?.id || null;
    $s('#share-form-title').textContent = s ? '编辑链接' : '添加链接';
    for (const [field,value] of Object.entries({name:s?.name || '', original:s?.originalName || '', url:s?.url || '', category:s?.category || (activeCategory === ALL ? config.categories[0] || '' : activeCategory), date:s?.date || '', aliases:(s?.aliases || []).join(', ')})) $s('#share-'+field).value = value;
    $s('#share-categories').innerHTML = config.categories.map(c => `<option value="${esc(c)}"></option>`).join('');
    dialog.showModal(); $s('#share-name').focus();
  }
  $s('#share-form').onsubmit = event => {
    event.preventDefault();
    const item = {id:editingId || crypto.randomUUID(), name:$s('#share-name').value.trim(), originalName:$s('#share-original').value.trim(), url:$s('#share-url').value.trim(), category:$s('#share-category').value.trim(), date:$s('#share-date').value, aliases:$s('#share-aliases').value.split(/[,，]/).map(s => s.trim()).filter(Boolean)};
    try {
      commit({...config, shares:editingId ? config.shares.map(s => s.id === editingId ? {...s,...item} : s) : [...config.shares,item]});
      activeCategory = item.category; query = ''; $s('#share-search').value = '';
      dialog.close(); renderShares(); toast('已保存到本浏览器；请导出分享以备份');
    } catch (error) { toast(error.message); }
  };
  $s('#share-cancel').onclick = () => dialog.close();
  $s('#share-add').onclick = () => openShareEditor(null);
  $s('#share-search').oninput = event => { query = event.target.value; renderShares(); };
  $s('#share-search').onkeydown = event => {
    if (event.key === 'Enter') {
      const links = panel.querySelectorAll('.share-open');
      if (links.length === 1) links[0].click(); else links[0]?.focus();
    }
  };
  $s('#share-export').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(config,null,2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'shares.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000); toast('已导出 shares.json');
  };
  $s('#share-import').onclick = () => $s('#share-file').click();
  $s('#share-file').onchange = async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      const next = validate(JSON.parse(await file.text()));
      if (!confirm(`用导入的 ${next.shares.length} 个分享链接替换当前分享配置？服务导航不受影响。`)) return;
      commit(next); activeCategory = ALL; query = ''; $s('#share-search').value = ''; renderShares(); toast('分享配置已导入');
    } catch (error) { toast('导入失败：'+error.message); }
  };
  $s('#share-reset').onclick = async () => {
    if (!confirm('重置分享链接为 shares.json 默认配置？分享的本地修改会丢失，服务导航不受影响。')) return;
    try { commit(await defaults()); activeCategory = ALL; query = ''; $s('#share-search').value = ''; renderShares(); toast('分享配置已重置'); }
    catch (error) { toast('重置失败：'+error.message); }
  };
  const unifiedPanel = document.createElement('div');
  unifiedPanel.className = 'workspace unified-workspace'; unifiedPanel.hidden = true;
  unifiedPanel.innerHTML = `<header><div><h1>搜索结果</h1><p class="subtitle">全部服务与分享链接</p></div></header><div id="unified-hint" role="status"></div><main id="unified-results"></main>`;
  panel.after(unifiedPanel);
  let unifiedTimer = null;
  function cancelUnified() {
    clearInterval(unifiedTimer); unifiedTimer = null;
    $s('#unified-hint').replaceChildren();
  }
  function unifiedMatches(value) {
    const q = value.trim().toLowerCase();
    if(!q) return {service:[], share:[]};
    return {
      service:services.filter(s=>match(s,q)),
      share:config.shares.filter(s=>[s.name,s.originalName,s.category,s.date,...s.aliases].some(t=>t.toLowerCase().includes(q)))
    };
  }
  function renderUnified() {
    cancelUnified();
    const value = $s('#unified-input').value;
    const matches = unifiedMatches(value);
    const results = $s('#unified-results'); results.replaceChildren();
    if(!value.trim() || !matches.service.length && !matches.share.length){
      const empty = document.createElement('p'); empty.className = 'empty';
      empty.textContent = value.trim() ? '没有匹配结果，试试其他关键词。' : '输入关键词，同时搜索服务和分享链接。';
      results.append(empty); return matches;
    }
    for(const [kind,label] of [['service','服务'],['share','分享链接']]){
      if(!matches[kind].length) continue;
      const group = document.createElement('section'); group.className = 'unified-group';
      group.innerHTML = `<h2>${label}<span>${matches[kind].length} 个</span></h2><div class="grid"></div>`;
      for(const item of matches[kind]){
        const card = document.createElement('article'); card.className = 'card unified-card';
        card.innerHTML = `<div class="share-top"><span class="share-meta">${esc(item.category)}</span>${kind==='share'?PortalVisuals.artwork(item):''}</div><h3>${esc(item.name)}</h3><p class="share-original">${esc(kind==='share' ? item.originalName : item.note)}</p><button class="unified-open">${item.nonWeb ? '复制连接串' : '打开'}</button>`;
        card.querySelector('button').onclick = ()=>{cancelUnified();openUrl(item);};
        PortalCardMedia.attach(card,item,kind==='share'?'shares':'services');
        group.querySelector('.grid').append(card);
      }
      results.append(group);
    }
    return matches;
  }
  function showUnified(value, autoJump) {
    cancelJump(); cancelUnified();
    serviceWorkspace.hidden = true; serviceChips.hidden = true; panel.hidden = true; shareChips.hidden = true;
    unifiedPanel.hidden = false; caption.textContent = '跨空间搜索';
    switcher.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.space==='search')));
    $s('#unified-input').value = value;
    const matches = renderUnified();
    const url = new URL(location.href); url.searchParams.delete('q'); url.searchParams.set('space','search'); history.replaceState(null,'',url);
    const all = [...matches.service,...matches.share];
    if(autoJump && all.length===1){
      const target = all[0], q = value.trim().toLowerCase();
      const exact = [target.name,target.originalName || '',...(target.aliases||[])].some(t=>t.toLowerCase()===q);
      let seconds = exact ? 3 : 10;
      const hint = $s('#unified-hint');
      hint.innerHTML = `<span id="unified-countdown"></span><button id="unified-cancel">取消</button>`;
      const countdown = $s('#unified-countdown');
      const update = ()=>{countdown.textContent = `${seconds} 秒后${target.nonWeb?'复制连接串':'打开'}「${target.name}」`;};
      update();
      $s('#unified-cancel').onclick = ()=>{cancelUnified();hint.textContent='已取消自动打开';};
      unifiedTimer = setInterval(()=>{seconds--;if(seconds<=0){cancelUnified();openUrl(target);}else update();},1000);
    }
  }
  $s('#unified-input').oninput = ()=>showUnified($s('#unified-input').value, false);
  $s('#unified-input').onkeydown = event=>{
    if(event.key==='Escape') cancelUnified();
    if(event.key==='Enter'){
      event.preventDefault();
      if(unifiedPanel.hidden) showUnified($s('#unified-input').value, false);
      const buttons = unifiedPanel.querySelectorAll('.unified-open');
      if(buttons.length===1) buttons[0].click(); else buttons[0]?.focus();
    }
  };
  document.addEventListener('keydown',event=>{
    const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase()==='k';
    const slash = event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable]');
    if((shortcut || slash) && !$s('dialog[open]')){
      event.preventDefault();event.stopImmediatePropagation();$s('#unified-input').focus();
    }
  },true);
  async function initShares() {
    const [fallback] = await Promise.all([defaults(), servicesReady]);
    try { const saved = localStorage.getItem(SHARE_KEY); config = saved ? validate(JSON.parse(saved)) : fallback;
      config.shares = config.shares.map(s => ({...s, ...(s.artwork ? {} : {artwork:PortalInstance.shares.shares.find(d=>d.id===s.id || d.url===s.url)?.artwork})})); }
    catch { config = fallback; toast('分享缓存无法读取，已使用默认配置'); }
    switcher.querySelectorAll('button').forEach(button => button.onclick = () => switchSpace(button.dataset.space));
    renderShares();
    $s('#unified-input').disabled = false;
    const params = new URLSearchParams(location.search);
    if(params.has('q')) showUnified(params.get('q'), true);
    else if(params.get('space') === 'shares') switchSpace('shares');
    else if(params.get('space') === 'search') showUnified('', false);
  }
  initShares();
})();
