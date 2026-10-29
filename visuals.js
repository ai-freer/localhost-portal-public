// 本地装饰性 SVG：依据标题表达主题，不代表报告中的真实数据或截图。
const PortalVisuals = (() => {
  const symbols = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    panel:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M9 9v11M6 6.5h.01M9 6.5h.01"/>',
    folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18M8 14h8M8 17h5"/>',
    chip:'<rect x="6" y="6" width="12" height="12" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/>',
    project:'<path d="M3 7h7l2-3h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="m9 12-3 3 3 3m6-6 3 3-3 3"/>',
    tunnel:'<path d="m8 8-4 4 4 4m8-8 4 4-4 4M4 12h16M9 3h6M9 21h6"/>',
    tool:'<path d="m14 5 5 5M14 5l1-2 6 6-2 1M14 5 4 15l-1 6 6-1 10-10M4 15l5 5"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    route:'<rect x="4" y="2" width="14" height="20" rx="3"/><path d="M9 5h4M9 18h4M8 14h5a2 2 0 0 0 0-4h-2"/><circle cx="8" cy="14" r="1"/>',
    car:'<path d="m5 9 2-5h10l2 5M3 10l2-1h14l2 1v8H3ZM6 18v3m12-3v3M6 13h2m8 0h2M9 16h6"/>',
    book:'<path d="M12 5C8 2 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-2-1-6-2-10 1Zm0 0v16M5 8l4 1m-4 3 4 1m6-4 4-1m-4 5 4-1"/>',
    tracker:'<rect x="4" y="4" width="16" height="18" rx="2"/><path d="M8 2v4m8-4v4M4 9h16m-12 7 3 3 6-6"/>',
    document:'<path d="M5 2h9l5 5v15H5ZM14 2v5h5M8 12h8m-8 4h8"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${symbols[name] || symbols.document}</svg>`;
  const serviceIcons = Object.fromEntries(Object.entries(PortalInstance.site.serviceCategories).map(([name,c])=>[name,c.icon]));
  serviceIcons['全部']='grid';
  const themes = PortalInstance.site.shareCategories;
  const category = (name, sharing = false) => icon(sharing ? (themes[name]?.icon || 'folder') : serviceIcons[name]);
  const page = '<rect x="30" y="7" width="36" height="43" rx="4" fill="var(--panel)"/><path d="M39 16h17"/>';
  const check = '<path d="m37 26 2 2 4-5m-6 15 2 2 4-5M48 26h10m-10 12h10"/>';
  const diagrams = PortalInstance.artwork;
  function artwork(item) {
    const original = PortalInstance.shares.shares.find(s => s.id === item.id || s.url === item.url);
    const key = item.artwork || original?.artwork || '';
    const theme = themes[item.category] || {tone:'blue'};
    const drawing = diagrams[key] || page+check;
    return `<span class="share-illustration tone-${theme.tone}" aria-hidden="true"><svg viewBox="0 0 96 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${drawing}</svg></span>`;
  }
  return {icon,category,artwork};
})();
