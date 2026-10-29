/* Optional instance-owned card imagery. Never reads or writes browser storage. */
const PortalCardMedia = (() => {
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  function validate(entry) {
    if (!entry || typeof entry !== 'object') return null;
    // Only instance-local static raster assets; no remote requests or executable URLs.
    if (typeof entry.file !== 'string' || !/^assets\/[A-Za-z0-9_/-]+\.(?:png|jpe?g|webp|avif)$/i.test(entry.file) || entry.file.includes('..')) return null;
    const v = {...entry};
    if (v.crop !== undefined) {
      if (!Array.isArray(v.crop) || v.crop.length!==4 || !v.crop.every(Number.isFinite) || !Array.isArray(v.sourceSize) || v.sourceSize.length!==2 || !v.sourceSize.every(n=>Number.isFinite(n)&&n>0)) return null;
      const [x,y,w,h]=v.crop, [sw,sh]=v.sourceSize;
      if(x<0||y<0||w<=0||h<=0||x+w>sw||y+h>sh) return null;
    }
    v.focus = typeof v.focus==='string' && /^(?:\d+(?:\.\d+)?%|left|right|center) (?:\d+(?:\.\d+)?%|top|bottom|center)$/.test(v.focus) ? v.focus : '50% 50%';
    v.fit = v.fit==='contain'?'contain':'cover';
    v.brightness = Number.isFinite(v.brightness) ? Math.max(.5,Math.min(1.5,v.brightness)) : 1;
    return v;
  }
  function resolve(mapping,space,item) {
    if(item.nonWeb || !mapping || !own(mapping,space)) return null;
    const entries=mapping[space];
    // Full URL deliberately preserves query and hash, and works for old saved IDs.
    return entries && own(entries,item.url) ? validate(entries[item.url]) : null;
  }
  function attach(card,item,space) {
    const v=resolve(PortalInstance.cardMedia,space,item);
    if(!v) return;
    const layer=document.createElement('span');layer.className='card-media-layer';layer.setAttribute('aria-hidden','true');
    let visual;
    if(v.crop) {
      const ns='http://www.w3.org/2000/svg';visual=document.createElementNS(ns,'svg');
      visual.setAttribute('viewBox',v.crop.join(' '));visual.setAttribute('preserveAspectRatio','xMidYMin slice');
      const image=document.createElementNS(ns,'image');image.setAttribute('width',v.sourceSize[0]);image.setAttribute('height',v.sourceSize[1]);image.setAttribute('href',v.file);visual.append(image);
    } else {
      visual=document.createElement('img');visual.alt='';visual.src=v.file;
      visual.style.objectPosition=v.focus;visual.style.objectFit=v.fit;
    }
    visual.classList.add('card-media-image');visual.style.filter=`brightness(${v.brightness})`;
    const veil=document.createElement('span');veil.className='card-media-veil';layer.append(visual,veil);
    let tries=0;const probe=new Image();
    const fail=()=>{card.classList.remove('has-card-media','native-card-crop');layer.remove();};
    const succeed=()=>{if(v.crop)visual.firstChild.setAttribute('href',probe.src);else visual.src=probe.src;if(!card.contains(layer))card.prepend(layer);card.classList.add('has-card-media');if(v.crop)card.classList.add('native-card-crop');};
    // A failed refresh leaves the existing SVG/white card in place, without hiding content.
    probe.onload=succeed;probe.onerror=()=>{if(tries++===0)probe.src=v.file+'?retry=1';else fail();};
    (v.crop?visual.firstChild:visual).addEventListener('error',fail);
    probe.src=v.file;
  }
  return {validate,resolve,attach};
})();
if(typeof module!=='undefined') module.exports=PortalCardMedia;
