/* Load the instance before loading the shared UI. Configuration remains single-source JSON. */
(async () => {
  try {
    if (location.protocol === 'file:') throw new Error('请通过本地 HTTP 服务打开本项目，不能直接双击 HTML。参见 README.md。');
    async function json(file) {
      const response = await fetch(file, {cache:'no-store'});
      if (!response.ok) throw new Error(`无法读取 ${file}（${response.status}）`);
      return response.json();
    }
    const [site, services, shares, artwork] = await Promise.all(['instance.json','services.json','shares.json','artwork.json'].map(json));
    PortalConfig.instance(site); PortalConfig.services(services); PortalConfig.shares(shares);
    PortalConfig.loadSaved(localStorage, site.storage.services, services, PortalConfig.services);
    PortalConfig.loadSaved(localStorage, site.storage.shares, shares, PortalConfig.shares);
    // Only inert local SVG drawing elements are allowed in instance artwork.
    const tags = new Set(['path','rect','circle','ellipse','line','polyline','polygon','g']);
    const attrs = new Set(['d','x','y','x1','x2','y1','y2','width','height','rx','ry','r','cx','cy','points','class','fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','transform']);
    for (const drawing of Object.values(artwork)) {
      if (typeof drawing !== 'string') throw new Error('配图必须是 SVG 图形片段');
      const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${drawing}</svg>`, 'image/svg+xml');
      if (doc.querySelector('parsererror') || /<!|<\?/.test(drawing)) throw new Error('配图 SVG 无效');
      for (const el of doc.documentElement.querySelectorAll('*')) {
        if (!tags.has(el.localName) || [...el.attributes].some(a=>!attrs.has(a.name) || /url\s*\(/i.test(a.value))) throw new Error('配图只能包含本地静态线稿');
      }
    }
    let cardMedia = {};
    try { cardMedia = await json('card-media.json'); } catch { /* Optional imagery must never prevent navigation. */ }
    window.PortalInstance = {site, services, shares, artwork, cardMedia};
    document.title = site.title || '服务导航';
    const brand = document.querySelector('.brand');
    brand.lastChild.textContent = ' ' + (site.brand || '导航');
    brand.setAttribute('aria-label', (site.brand || '导航') + '，返回首页');
    document.querySelector('#instance-address').textContent = location.host;
    document.querySelector('#instance-note').textContent = site.sidebarNote || '';
    document.querySelector('.workspace h1').textContent = site.servicesTitle || '服务导航';
    document.querySelector('.workspace .subtitle').textContent = site.servicesSubtitle || '';
    document.querySelector('#quick-url').textContent = new URL('./', location.href).href + '?q=%s';
    document.querySelector('#quick-example').textContent = site.quickExample || '示例';
    for (const src of ['card-media.js','visuals.js','services.js','shares.js']) {
      await new Promise((resolve,reject)=>{
        const script = document.createElement('script'); script.src=src+'?v=0.2.0-card-media';
        script.onload=resolve; script.onerror=()=>reject(new Error(`无法加载 ${src}`));
        document.body.append(script);
      });
    }
  } catch (error) {
    const notice = document.createElement('p'); notice.setAttribute('role','alert');
    notice.textContent = '导航未能加载：' + error.message + '。已有浏览器配置未被修改。';
    document.querySelector('.workspace').prepend(notice);
  }
})();
