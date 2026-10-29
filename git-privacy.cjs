// Checks reachable Git history and the identity that would be used for the next commit.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const patterns=[
 ['personal-home-path', /\/Users\/[a-zA-Z0-9_-]+\//],
 ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['credential', /gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,}/]
];
function contentFindings(text){
 const hits=patterns.filter(([,p])=>p.test(text)).map(([name])=>name);
 const emails=text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)||[];
 if(emails.some(e=>!/(?:@|\.)(example\.(?:com|org|net)|invalid|test)$|@users\.noreply\.github\.com$/i.test(e))) hits.push('non-example-email');
 return hits;
}
function auditGit(cwd, approved=[]){
 const git=(...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024}).trim();
 const issues=[];let commits=0,blobs=0;
 const identity=(name,email,where)=>{
  if(!/^[A-Za-z0-9+_.-]+@users\.noreply\.github\.com$/i.test(email)) issues.push(`${where}: 邮箱不是 GitHub noreply 地址`);
  if(!approved.some(i=>i.name===name&&i.email===email)) issues.push(`${where}: 姓名和邮箱未列入显式批准的公开身份`);
 };
 try{git('rev-parse','--git-dir');}catch{ return {issues:['Git 仓库不存在，无法完成历史检查'],commits,blobs}; }
 const revisions=git('rev-list','--all');
 for(const rev of revisions.split('\n').filter(Boolean)){
  const [name,email,committer,cemail]=git('show','-s','--format=%an%x00%ae%x00%cn%x00%ce',rev).split('\0');
  identity(name,email,`提交 ${rev.slice(0,8)} 作者`);identity(committer,cemail,`提交 ${rev.slice(0,8)} 提交者`);
  const message=git('show','-s','--format=%B',rev);
  for(const hit of contentFindings(message)) issues.push(`提交 ${rev.slice(0,8)} 消息: ${hit}`);
  commits++;
 }
 for(const variable of ['GIT_AUTHOR_IDENT','GIT_COMMITTER_IDENT']){
  try{
   const raw=git('var',variable), match=raw.match(/^(.*) <([^<>]*)> /);
   if(!match) issues.push(`${variable}: 无法解析身份`);else identity(match[1],match[2],`下次提交 ${variable}`);
  }catch{issues.push(`${variable}: 未配置可用身份`);}
 }
 if(!commits) issues.push('仓库尚无可审查的提交');
 const objects=git('rev-list','--objects','--all');
 const tagObjects=git('for-each-ref','--format=%(objectname)','refs/tags');
 const objectLines=[...new Set([...objects.split('\n').filter(Boolean).map(x=>x.split(' ')[0]),...tagObjects.split('\n').filter(Boolean)])];
 for(const line of objectLines){
  const oid=line.split(' ')[0], type=git('cat-file','-t',oid);
  if(type==='blob'){
   for(const hit of contentFindings(git('cat-file','-p',oid))) issues.push(`历史文件对象 ${oid.slice(0,8)}: ${hit}`);
   blobs++;
  }else if(type==='tag'){
   const raw=git('cat-file','-p',oid), tagger=raw.match(/^tagger (.*) <([^<>]*)> /m);
   if(tagger) identity(tagger[1],tagger[2],`标签 ${oid.slice(0,8)}`);
   for(const hit of contentFindings(raw.split('\n\n').slice(1).join('\n\n'))) issues.push(`标签 ${oid.slice(0,8)} 消息: ${hit}`);
  }
 }
 // Tags can point to trees/blobs too; rev-list above scans all reachable objects.
 const remotes=git('remote','-v');
 if(/https?:\/\/[^\s/]+@/.test(remotes)) issues.push('远程 URL 中存在内嵌身份或凭据');
 return {issues:[...new Set(issues)],commits,blobs};
}
function readIdentity(file){
 if(!file) return [];
 const list=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Array.isArray(list)||list.some(i=>!i||typeof i.name!=='string'||typeof i.email!=='string')) throw Error('公开身份文件必须是包含 name、email 的对象数组');
 return list;
}
module.exports={auditGit,contentFindings,readIdentity};
