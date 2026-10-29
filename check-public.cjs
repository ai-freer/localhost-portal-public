// Release guard for this example-only candidate, not a general secret scanner.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const framework=JSON.parse(fs.readFileSync('framework.json'));
const allowed=new Set([...framework.files,'framework.json','instance.json','services.json','shares.json','artwork.json','README.md','.gitignore','check-public.cjs']);
function walk(dir='.') {
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(e.name==='.git') return [];
  const p=path.join(dir,e.name);
  assert.ok(!e.isSymbolicLink(),`Unexpected symlink: ${p}`);
  return e.isDirectory()?walk(p):[p];
 });
}
for(const file of walk()) {
 assert.ok(allowed.has(file),`Unreviewed release file: ${file}`);
 const text=fs.readFileSync(file,'utf8');
 assert.ok(!/\/Users\/[a-zA-Z0-9_-]+\//.test(text),`Personal home path: ${file}`);
 assert.ok(!/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text),`Private key: ${file}`);
}
for(const [file,key] of [['services.json','services'],['shares.json','shares']]) {
 for(const item of JSON.parse(fs.readFileSync(file))[key]) {
  assert.equal(new URL(item.url).hostname,'example.com',`${file}: non-example URL`);
  assert.equal(new URL(item.url).username,''); assert.equal(new URL(item.url).password,'');
 }
}
const site=JSON.parse(fs.readFileSync('instance.json'));
assert.equal(site.probeServices,false);
assert.ok(Object.values(site.storage).every(k=>k.startsWith('portal-demo:')));
console.log('PASS: example-only configs, isolated storage, reviewed file list, no personal home paths or private key blocks');
