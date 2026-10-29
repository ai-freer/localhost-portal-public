/* Shared validation and storage policy; no instance content belongs here. */
const PortalConfig = (() => {
  const fail = message => { throw new Error(message); };
  const text = value => typeof value === 'string' && value.trim();
  function services(data) {
    if (!data || !Array.isArray(data.services) || 'shares' in data) fail('请选择 services.json 服务配置');
    const ids = new Set(), urls = new Set();
    for (const s of data.services) {
      if (!s || !text(s.name) || !text(s.url) || !text(s.category)) fail('每个服务需要名称、地址和分类');
      let url; try { url = new URL(s.url); } catch { fail('服务地址格式无效'); }
      if (['javascript:', 'data:', 'file:', 'vbscript:'].includes(url.protocol) || (!s.nonWeb && !['http:', 'https:'].includes(url.protocol))) fail('网页服务只支持 HTTP(S) 地址');
      if (urls.has(url.href) || (s.id && ids.has(s.id))) fail('服务地址或 ID 重复');
      urls.add(url.href); if (s.id) ids.add(s.id);
      if (s.aliases !== undefined && (!Array.isArray(s.aliases) || s.aliases.some(a=>typeof a!=='string'))) fail('别名应为文本数组');
    }
    return {...data, version:data.version || 1};
  }
  function shares(data) {
    const ALL = '全部分享';
    if (!data || !Array.isArray(data.shares) || !Array.isArray(data.categories) || 'services' in data || data.categories.some(c => !text(c) || c === ALL)) fail('请选择 shares.json 分享配置');
    const ids = new Set(), urls = new Set();
    const items = data.shares.map(s => {
      if (!s || !text(s.name) || !text(s.category) || s.category === ALL || !text(s.url)) fail('每个分享需要标题、分类和地址');
      let url; try { url = new URL(s.url); } catch { fail('分享地址格式无效'); }
      if (!['http:', 'https:'].includes(url.protocol)) fail('分享只支持 HTTP(S) 地址');
      if (s.aliases !== undefined && (!Array.isArray(s.aliases) || s.aliases.some(a=>typeof a!=='string'))) fail('别名应为文本数组');
      if (s.originalName !== undefined && typeof s.originalName !== 'string') fail('原始名称应为文本');
      if (s.date && (typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || Number.isNaN(Date.parse(s.date)) || new Date(s.date).toISOString().slice(0,10) !== s.date)) fail('日期格式应为有效的 YYYY-MM-DD');
      if (urls.has(url.href)) fail('配置中存在重复链接');
      urls.add(url.href);
      const id = text(s.id) ? s.id : crypto.randomUUID();
      if (ids.has(id)) fail('配置中存在重复 ID');
      ids.add(id);
      return {...s, id, name:s.name.trim(), category:s.category.trim(), originalName:s.originalName || '', date:s.date || '', aliases:s.aliases || []};
    });
    return {...data, version:data.version || 1, categories:[...new Set([...data.categories, ...items.map(s=>s.category)])], shares:items};
  }
  function loadSaved(storage, key, defaults, validate) {
    const raw = storage.getItem(key);
    // Never overwrite saved data during initialization, including on a file version bump.
    return raw === null ? validate(defaults) : validate(JSON.parse(raw));
  }
  function instance(site) {
    if (site?.schemaVersion !== 1 || !text(site.storage?.services) || !text(site.storage?.shares) || site.storage.services === site.storage.shares) fail('实例存储配置无效');
    for (const key of ['serviceCategories','shareCategories']) {
      if (!site[key] || typeof site[key] !== 'object' || Array.isArray(site[key])) fail('实例分类配置无效');
      for (const c of Object.values(site[key])) {
        if (!c || (c.tone && !['blue','teal','violet','amber','rose'].includes(c.tone)) || (c.sort && !['manual','date-desc'].includes(c.sort))) fail('分类颜色或排序规则无效');
      }
    }
    return site;
  }
  return {services, shares, loadSaved, instance};
})();
if (typeof module !== 'undefined') module.exports = PortalConfig;
