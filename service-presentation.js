/* Service purpose and actions are separate from instance bookmarks and imagery. */
const PortalServicePresentation = (() => {
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const labels={model:'模型接口',database:'数据库地址',cache:'缓存地址',connection:'连接地址'};
  const descriptions={model:'供应用调用模型 · 复制接口地址',database:'供数据库客户端或应用连接',cache:'供应用或缓存客户端连接',connection:'供客户端连接 · 复制后使用'};
  const drawings={
    model:'<path d="M38 22V12m20 10V12M38 12l-5-6m25 6 5-6M32 25q16-12 32 0v24q-16 14-32 0Z"/><path d="M37 43q11 8 22 0M25 33H12v17h13m46-17h13v17H71M43 57v10m10-10v10"/><circle cx="41" cy="34" r="2"/><circle cx="55" cy="34" r="2"/><path d="M15 61h13m40 0h13"/>',
    database:'<ellipse cx="48" cy="20" rx="24" ry="9"/><path d="M24 20v34c0 12 48 12 48 0V20M24 36c0 12 48 12 48 0M24 51c0 12 48 12 48 0M16 32H8v24h8m64-24h8v24h-8"/><path d="M33 31h4m-4 15h4m-4 15h4"/>',
    cache:'<path d="m48 10 30 14-30 14-30-14ZM18 35l30 14 30-14M18 47l30 14 30-14"/><path d="m48 20-6 8h8l-6 9M9 20v31m78-31v31"/><circle cx="9" cy="14" r="3"/><circle cx="87" cy="57" r="3"/>',
    connection:'<rect x="30" y="20" width="36" height="36" rx="9"/><path d="M30 38H12m54 0h18M42 20V9m12 11V9M42 56v11m12-11v11M41 32l-6 6 6 6m14-12 6 6-6 6"/>'
  };
  function resolve(mapping,item) {
    let meta;
    if(mapping?.services && own(mapping.services,item.url)) meta=mapping.services[item.url]?.service;
    if(!item.nonWeb && meta?.role!=='endpoint') return null;
    let protocol='';try{protocol=new URL(item.url).protocol;}catch{}
    const fallback=protocol==='mysql:'?'database':protocol==='redis:'?'cache':'connection';
    const kind=meta && own(labels,meta.kind)?meta.kind:fallback;
    return {kind,label:labels[kind],description:descriptions[kind],action:'复制地址'};
  }
  function svg(kind,cls) {
    return `<svg class="${cls}" viewBox="0 0 96 76" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[kind]||drawings.connection}</svg>`;
  }
  function brand(mapping,item) {
    if(!mapping?.services || !own(mapping.services,item.url))return null;
    const b=mapping.services[item.url]?.brand;
    const safe=f=>typeof f==='string' && /^assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|avif)$/i.test(f);
    if(!b || !safe(b.file))return null;
    return {file:b.file,iconFile:safe(b.iconFile)?b.iconFile:b.file,surface:['light','dark'].includes(b.surface)?b.surface:'none',
      attribution:typeof b.attribution==='string'?b.attribution.slice(0,300):''};
  }
  function attachBrand(card,item,mapping) {
    const b=brand(mapping,item);if(!b)return;
    const img=new Image();img.alt='';img.className='service-brand-image';
    const layer=document.createElement('span');layer.className='service-brand-art brand-surface-'+b.surface;layer.setAttribute('aria-hidden','true');layer.append(img);
    img.onload=()=>{if(!card.contains(layer))card.prepend(layer);card.classList.add('has-service-brand');};
    img.onerror=()=>{layer.remove();card.classList.remove('has-service-brand');};img.src=b.file;
    const emoji=card.querySelector('.emoji');
    if(emoji){const icon=new Image();icon.alt='';icon.className='service-brand-icon brand-surface-'+b.surface;icon.onload=()=>emoji.replaceChildren(icon);icon.src=b.iconFile;}
    if(b.attribution)card.title=b.attribution;
  }
  function credits(mapping) {
    const text=[...new Set(Object.keys(mapping?.services||{}).map(url=>brand(mapping,{url})?.attribution).filter(Boolean))].join(' ');
    let node=document.querySelector('.service-brand-credits');
    if(!text){node?.remove();return;}
    if(!node){node=document.createElement('p');node.className='service-brand-credits';document.body.append(node);}
    node.textContent=text;
  }
  function decorate(card,item,mapping,copy) {
    attachBrand(card,item,mapping);
    const v=resolve(mapping,item);if(!v)return;
    card.classList.add('endpoint-card','endpoint-'+v.kind);
    const art=document.createElement('span');art.className='endpoint-art';art.setAttribute('aria-hidden','true');art.innerHTML=svg(v.kind,'endpoint-drawing');card.prepend(art);
    const emoji=card.querySelector('.emoji');if(emoji)emoji.innerHTML=svg(v.kind,'endpoint-icon');
    const name=card.querySelector('.name');
    const badge=document.createElement('span');badge.className='endpoint-label';badge.textContent=v.label;
    if(name)name.before(badge);else card.querySelector('h3')?.before(badge);
    const note=card.querySelector('.note,.share-original');if(note){note.textContent=v.description;note.title=item.note||v.description;}
    const port=card.querySelector('.port');
    if(port){
      port.replaceChildren();
      const button=document.createElement('button');button.className='endpoint-copy';button.type='button';button.textContent=v.action;button.title=item.url;button.setAttribute('aria-label',v.action+'：'+item.name);button.onclick=copy;
      const address=document.createElement('small');try{const u=new URL(item.url);address.textContent=u.port||u.protocol.replace(':','');}catch{address.textContent='连接';}
      port.append(button,address);
    }
    const main=card.querySelector('.service-link');if(main){main.title=v.action+'：'+item.url;main.setAttribute('aria-label',item.name+'，'+v.label+'，'+v.action);}
    const unified=card.querySelector('.unified-open');if(unified)unified.textContent=v.action;
  }
  return {resolve,decorate,brand,credits};
})();
if(typeof module!=='undefined')module.exports=PortalServicePresentation;
