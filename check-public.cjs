// Release guard for this example-only candidate, not a general secret scanner.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {auditGit,contentFindings,readIdentity}=require('./git-privacy.cjs');
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--identity-file')) throw Error('用法：node check-public.cjs [--identity-file 已批准身份.json]');
const framework=JSON.parse(fs.readFileSync('framework.json'));
const allowed=new Set([...framework.files,'framework.json','instance.json','services.json','shares.json','artwork.json','card-media.json','README.md','README.zh-CN.md','LICENSE','.gitignore','check-public.cjs']);
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
 assert.deepEqual(contentFindings(text),[],`Sensitive content pattern: ${file}`);
 assert.ok(!/\/Users\/[a-zA-Z0-9_-]+\//.test(text),`Personal home path: ${file}`);
 assert.ok(!/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text),`Private key: ${file}`);
}
for(const [file,key] of [['services.json','services'],['shares.json','shares']]) {
 for(const item of JSON.parse(fs.readFileSync(file))[key]) {
  assert.equal(new URL(item.url).hostname,'example.com',`${file}: non-example URL`);
  assert.equal(new URL(item.url).username,''); assert.equal(new URL(item.url).password,'');
 }
}
assert.deepEqual(JSON.parse(fs.readFileSync('card-media.json')), {version:1,services:{},shares:{}}, 'Public candidate must not contain instance media mappings');
const site=JSON.parse(fs.readFileSync('instance.json'));
assert.equal(site.probeServices,false);
assert.ok(Object.values(site.storage).every(k=>k.startsWith('portal-demo:')));
console.log('PASS: 示例配置、存储隔离与当前文件检查');
const result=auditGit(process.cwd(),readIdentity(args[1]));
console.log(`Git 检查：${result.commits} 个提交，${result.blobs} 个历史文件对象`);
if(result.issues.length){
 console.error(result.issues.map(x=>'FAIL: '+x).join('\n'));
 process.exitCode=1;
}else console.log('PASS: Git 历史、公开身份及下次提交身份检查');
