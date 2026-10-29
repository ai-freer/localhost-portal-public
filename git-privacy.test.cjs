const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {auditGit}=require('./git-privacy.cjs');
const identity={name:'Portal Contributor',email:'123+portal-test@users.noreply.github.com'};
function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'portal-git-check-'));
 const git=(...args)=>execFileSync('git',['-C',dir,...args],{encoding:'utf8',stdio:'pipe',env:{...process.env,GIT_CONFIG_GLOBAL:os.devNull,GIT_CONFIG_SYSTEM:os.devNull,GIT_AUTHOR_NAME:identity.name,GIT_AUTHOR_EMAIL:identity.email,GIT_COMMITTER_NAME:identity.name,GIT_COMMITTER_EMAIL:identity.email}}).trim();
 try{
  git('init','-b','main');git('config','user.name',identity.name);git('config','user.email',identity.email);
  fs.writeFileSync(path.join(dir,'example.txt'),'example');git('add','.');git('-c','commit.gpgSign=false','-c',`core.hooksPath=${os.devNull}`,'commit','-m','initial');
  fn(dir,git);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('approved noreply identity passes, unreviewed name fails',()=>fixture(dir=>{
 assert.deepEqual(auditGit(dir,[identity]).issues,[]);
 assert.ok(auditGit(dir,[]).issues.some(x=>x.includes('未列入')));
}));
test('next-commit personal email is detected without exposing it',()=>fixture((dir,git)=>{
 const email='person@'+'mailbox.test';git('config','user.email',email);
 const issues=auditGit(dir,[identity]).issues;
 assert.ok(issues.some(x=>x.includes('下次提交')&&x.includes('noreply')));
 assert.ok(!issues.join('\n').includes(email));
}));
test('removed private path still fails historical scan',()=>fixture((dir,git)=>{
 const file=path.join(dir,'removed.txt');fs.writeFileSync(file,'/Us'+'ers/example/private');
 git('add','.');git('-c','commit.gpgSign=false','commit','-m','add');
 git('rm','removed.txt');git('-c','commit.gpgSign=false','commit','-m','remove');
 assert.ok(auditGit(dir,[identity]).issues.some(x=>x.includes('历史文件对象')&&x.includes('personal-home')));
}));
test('annotated tag message is checked',()=>fixture((dir,git)=>{
 git('-c','tag.gpgSign=false','tag','-a','test-tag','-m','/Us'+'ers/example/private');
 assert.ok(auditGit(dir,[identity]).issues.some(x=>x.includes('标签')&&x.includes('personal-home')));
}));
