const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('./service-presentation.js');
test('non-web connections have purpose, HTTP bookmarks remain web by default',()=>{
 assert.equal(P.resolve({}, {url:'mysql://example.com:3306',nonWeb:true}).kind,'database');
 assert.equal(P.resolve({}, {url:'redis://example.com:6379',nonWeb:true}).kind,'cache');
 assert.equal(P.resolve({}, {url:'https://example.com'}),null);
});
test('explicit API presentation uses full service URL without mutating saved bookmarks',()=>{
 const item={id:'old',name:'Renamed',url:'https://example.com/api?x=1#root'},before=JSON.stringify(item);
 const map={services:{[item.url]:{service:{role:'endpoint',kind:'model'}}}};
 assert.equal(P.resolve(map,item).action,'复制地址');assert.equal(P.resolve(map,item).kind,'model');
 assert.equal(P.resolve(map,{...item,url:'https://example.com/api?x=2#root'}),null);
 assert.equal(JSON.stringify(item),before);
});
test('invalid or prototype-derived metadata never inserts arbitrary labels or drawings',()=>{
 const item={url:'https://example.com/api'};
 assert.equal(P.resolve({services:Object.create({[item.url]:{service:{role:'endpoint',kind:'model'}}})},item),null);
 for(const kind of ['__proto__','constructor','<script>'])assert.equal(P.resolve({services:{[item.url]:{service:{role:'endpoint',kind}}}},item).kind,'connection');
});

test('brand assets are local raster images and cannot alter endpoint actions',()=>{
 const item={url:'https://example.com/tool'};
 const map={services:{[item.url]:{brand:{file:'assets/brands/example.png',surface:'light',attribution:'Example mark'}}}};
 assert.equal(P.brand(map,item).file,'assets/brands/example.png');assert.equal(P.resolve(map,item),null);
 for(const file of ['https://example.com/a.png','assets/../private.png','assets/evil.svg','assets//a.png']){
  map.services[item.url].brand.file=file;assert.equal(P.brand(map,item),null);
 }
});

test("dark brand variants accept only safe local assets",()=>{const url="http://localhost:1234"; const item={url}; const mapping={services:{[url]:{brand:{file:"assets/brand.png",darkFile:"assets/brand-dark.png"}}}};assert.equal(P.brand(mapping,item).darkFile,"assets/brand-dark.png");mapping.services[url].brand.darkFile="https://example.com/brand.png";assert.equal(P.brand(mapping,item).darkFile,null);});

test("brand scale is bounded and cannot inject styling",()=>{const item={url:"http://localhost:1234"};const mapping={services:{[item.url]:{brand:{file:"assets/brand.png",scale:.68}}}};assert.equal(P.brand(mapping,item).scale,.68);mapping.services[item.url].brand.scale=99;assert.equal(P.brand(mapping,item).scale,1);mapping.services[item.url].brand.scale="url(bad)";assert.equal(P.brand(mapping,item).scale,1);});
