const STORE_KEY = PortalInstance.site.storage.services;
const CATS = ['全部', ...Object.keys(PortalInstance.site.serviceCategories)];
const $ = s => document.querySelector(s);
const grid = $('#grid'), empty = $('#empty'), qInput = $('#q'), hint = $('#hint'), chips = $('#chips');
let services = [], filter = '', category = '全部', pendingJump = null;

let cfgVersion = 1;
async function loadServices(){
  // Browser edits win regardless of file version; replacing them requires explicit import/reset.
  const data = PortalConfig.loadSaved(localStorage, STORE_KEY, PortalInstance.services, PortalConfig.services);
  cfgVersion = data.version || 1;
  return data.services;
}

function portOf(url){ try{ const u = new URL(url); return u.port || (u.protocol==='https:'?'443':u.protocol==='http:'?'80':''); }catch(e){ return url.replace(/^[a-z]+:\/\//,'').replace(/\/.*$/,''); } }
function protoOf(url){ try{ return new URL(url).protocol.replace(':',''); }catch(e){ return ''; } }

function match(service, q){
  if(!q) return true;
  const ql = q.toLowerCase();
  if(service.name && service.name.toLowerCase().includes(ql)) return true;
  if((service.aliases||[]).some(a=>a.toLowerCase().includes(ql))) return true;
  if(service.note && service.note.toLowerCase().includes(ql)) return true;
  if(String(portOf(service.url)).includes(ql)) return true;
  return false;
}

function inCategory(s, c){ return c==='全部' || s.category===c || (PortalInstance.site.serviceCategories[c]?.includeTunnel && s.tunnel); }
function render(){
  const q = filter.trim();
  const list = services.filter(s=>inCategory(s, category) && match(s,q));
  renderChips();
  $('#view-title').textContent = category==='全部' ? '全部服务' : category;
  $('#result-count').textContent = list.length + ' 个';
  grid.innerHTML = '';
  empty.hidden = list.length > 0;
  if(!list.length){
    empty.innerHTML = q ? `没有匹配「${escapeHtml(q)}」的服务。 <a href="#" id="add-missing">添加服务</a>` : '这个分类还没有服务。点击上方“添加服务”。';
    const a = $('#add-missing'); if(a) a.onclick = e=>{e.preventDefault(); openEditor(null, q);};
  }
  for(const s of list){
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = s.id;
    card.innerHTML = `<button class="service-link" title="${escapeHtml(s.nonWeb?'复制连接串':'打开 '+s.name)}"><span class="emoji" aria-hidden="true">${escapeHtml(s.emoji||'📌')}</span><span class="service-info"><span class="name">${escapeHtml(s.name)}</span><span class="note" title="${escapeHtml(s.note||'')}">${escapeHtml(s.note||s.url)}</span></span></button><span class="port">${escapeHtml(portOf(s.url)||'—')}<small>${escapeHtml(protoOf(s.url))}</small></span><span class="connection"><span class="status" role="status">检测中</span>${s.tunnel?'<span class="tunnel-badge">SSH 隧道</span>':''}</span><span class="actions"><button data-act="edit" aria-label="编辑 ${escapeHtml(s.name)}">编辑</button><button data-act="del" aria-label="删除 ${escapeHtml(s.name)}">删除</button></span>`;
    card.querySelector('.service-link').onclick = ()=>openUrl(s);
    card.querySelector('[data-act="edit"]').onclick = ()=>openEditor(s);
    card.querySelector('[data-act="del"]').onclick = ()=>del(s);
    grid.appendChild(card);
    probe(s, card.querySelector('.status'));
  }
}

function ql(){ return filter.trim().toLowerCase(); }

function openUrl(s){
  if(s.nonWeb){
    navigator.clipboard.writeText(s.url).then(()=>toast('已复制连接串：'+s.url), ()=>toast('连接串：'+s.url));
    return;
  }
  // 非 http/https 直接 location 跳转（浏览器会询问）
  location.href = s.url;
}

const probeCache = new Map();
async function probe(s, status){
  if(PortalInstance.site.probeServices === false){
    status.textContent='未检测'; status.title='此实例已关闭服务检测'; return;
  }
  if(s.nonWeb || !/^https?:\/\//.test(s.url)){
    status.textContent = '未检测'; status.title = '非网页服务，点击名称复制连接串'; return;
  }
  if(!probeCache.has(s.url)){
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 4000);
    // no-cors 的不透明响应不能读取状态码，只能确认收到响应。
    const request = fetch(s.url, {mode:'no-cors', credentials:'omit', cache:'no-store', signal:controller.signal})
      .then(()=>({kind:'ok', text:'可达', title:'已收到 HTTP 响应；不代表应用健康或认证成功'}))
      .catch(()=>({kind:'unknown', text:'未确认', title:'连接失败、超时或浏览器限制；不能据此断定服务离线'}))
      .finally(()=>clearTimeout(timer));
    probeCache.set(s.url, request);
  }
  const result = await probeCache.get(s.url);
  status.className = 'status ' + result.kind;
  status.textContent = result.text; status.title = result.title;
}

function renderChips(){
  chips.innerHTML = '';
  for(const c of [...new Set([...CATS, ...services.map(s=>s.category)])]){
    const b = document.createElement('button');
    b.className = 'chip' + (category===c?' active':'');
    b.innerHTML = `<span class="nav-label"><span class="nav-icon">${PortalVisuals.category(c)}</span><span>${escapeHtml(c==='全部'?'全部服务':c)}</span></span><span class="chip-count">${services.filter(s=>inCategory(s,c)).length}</span>`;
    b.setAttribute('aria-pressed', String(category===c));
    b.onclick = ()=>{ cancelJump(); category = c; render(); };
    chips.appendChild(b);
  }
}

let editId = null;
function openEditor(s, prefill){
  cancelJump();
  editId = s ? s.id : null;
  $('#form-title').textContent = s ? '编辑服务' : '添加服务';
  const catSel = $('#f-category');
  catSel.innerHTML = '';
  for(const c of [...new Set([...CATS, ...services.map(s=>s.category)])]) if(c!=='全部'){ const o=document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o); }
  $('#f-name').value = s?s.name:(prefill||'');
  $('#f-aliases').value = s?(s.aliases||[]).join(', '):'';
  $('#f-url').value = s?s.url:(prefill && /^https?:\/\//.test(prefill)?prefill:'');
  $('#f-category').value = s?s.category:'其他';
  $('#f-emoji').value = s?(s.emoji||''):'📌';
  $('#f-note').value = s?(s.note||''):'';
  $('#f-tunnel').checked = !!s?.tunnel;
  $('#f-nonweb').checked = !!s?.nonWeb;
  $('#editor').showModal();
  setTimeout(()=>$('#f-name').focus(), 50);
}

function saveFromForm(){
  const name = $('#f-name').value.trim();
  const url = $('#f-url').value.trim();
  if(!name || !url){ toast('中文名和 URL 必填'); return; }
  const obj = {
    id: editId || ('s'+Date.now()),
    name,
    aliases: $('#f-aliases').value.split(',').map(x=>x.trim()).filter(Boolean),
    url,
    category: $('#f-category').value || '其他',
    emoji: $('#f-emoji').value.trim() || '📌',
    note: $('#f-note').value.trim(),
    tunnel: $('#f-tunnel').checked,
    nonWeb: $('#f-nonweb').checked
  };
  try { PortalConfig.services({services:[...services.filter(s=>s.id!==editId), obj]}); }
  catch(error) { toast(error.message); return; }
  if(editId){
    const i = services.findIndex(x=>x.id===editId);
    if(i>=0) services[i] = {...services[i], ...obj};
  } else {
    services.push(obj);
  }
  persist();
  $('#editor').close();
  render();
  toast('已保存到本浏览器；请导出配置以备份');
}

function del(s){
  if(!confirm('删除「'+s.name+'」？')) return;
  services = services.filter(x=>x.id!==s.id);
  persist();
  render();
  toast('已删除：'+s.name);
}

function persist(){ localStorage.setItem(STORE_KEY, JSON.stringify({version: cfgVersion, services})); }

function escapeHtml(t){ return String(t).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'), 2000); }

// 搜索框
qInput.addEventListener('input', ()=>{ cancelJump(); filter = qInput.value; render(); });
qInput.addEventListener('keydown', e=>{
  if(e.key==='Enter'){
    const list = services.filter(s=> inCategory(s, category) && match(s, filter.trim()));
    if(list.length===1){ openUrl(list[0]); }
    else if(list.length>1){ grid.querySelector('.service-link')?.focus(); }
  }
});

$('#btn-import').onclick = ()=>$('#file-import').click();
$('#refresh').onclick = ()=>{probeCache.clear();render();};
function cancelJump(){if(pendingJump){clearInterval(pendingJump);pendingJump=null;} hint.textContent='';}
$('#add').onclick = ()=>{cancelJump();openEditor(null);};
$('#btn-cancel').onclick = ()=> $('#editor').close();
$('#form').onsubmit = e=>{ e.preventDefault(); saveFromForm(); };
$('#btn-export').onclick = ()=>{
  const blob = new Blob([JSON.stringify({version:cfgVersion, services}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'services.json'; a.click();
  toast('已导出 services.json');
};
$('#file-import').onchange = e=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{ const j = PortalConfig.services(JSON.parse(r.result)); if(confirm('导入将替换本浏览器的服务配置，是否继续？')){ cfgVersion=j.version||1; services = j.services.map(x=>({...x, id:x.id||('s'+Math.random().toString(36).slice(2,8))})); persist(); render(); toast('已导入 '+services.length+' 个服务'); }
      else toast('JSON 格式不对'); }
    catch(err){ toast('解析失败：'+err.message); }
  };
  r.readAsText(f);
  e.target.value = '';
};
$('#btn-reset').onclick = ()=>{
  if(!confirm('重置为 services.json 的默认配置？本地修改会丢失。')) return;
  localStorage.removeItem(STORE_KEY);
  loadServices().then(s=>{ services = s.map(withDefaults); render(); toast('已重置'); });
};

function withDefaults(s){
  return {...s, id:s.id || crypto.randomUUID()};
}
const servicesReady = (async function init(){
  services = (await loadServices()).map(withDefaults);
  render();
})();
