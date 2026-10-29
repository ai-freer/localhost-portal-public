const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('./config.js');
const service = {name:'测试',url:'https://example.com/service',category:'工具'};
const share = {id:'reading',name:'阅读',url:'https://example.com/reading',category:'资料',artwork:'reading'};
test('升级文件版本不覆盖浏览器编辑，加载不写存储',()=>{
 const saved = JSON.stringify({version:1,services:[{...service,name:'自定义标题'}]});
 const storage = {getItem:()=>saved,setItem:()=>assert.fail('不应写入')};
 assert.equal(C.loadSaved(storage,'test',{version:99,services:[]},C.services).services[0].name,'自定义标题');
});
test('用户删除全部条目后，不自动补回默认内容',()=>{
 assert.deepEqual(C.loadSaved({getItem:()=>'{"services":[]}'},'test',{services:[service]},C.services).services,[]);
});
test('首次访问读取文件配置',()=>assert.equal(C.loadSaved({getItem:()=>null},'test',{services:[service]},C.services).services.length,1));
test('损坏的浏览器配置抛错，不删除或替换原值',()=>assert.throws(()=>C.loadSaved({getItem:()=>'{bad'},'test',{services:[]},C.services)));
test('服务和分享不能交叉导入',()=>{
 assert.throws(()=>C.services({categories:['资料'],shares:[share]}));
 assert.throws(()=>C.shares({services:[service]}));
});
test('拒绝重复地址和可执行网页 URL',()=>{
 assert.throws(()=>C.services({services:[service,service]}));
 assert.throws(()=>C.services({services:[{...service,url:'javascript:alert(1)'}]}));
 assert.throws(()=>C.shares({categories:['资料'],shares:[share,{...share,id:'other'}]}));
});
test('分享保留原始 URL、配图及扩展字段',()=>{
 const item={...share,url:'https://example.com/reading?a=%2F&b=2#section',custom:'keep'};
 assert.deepEqual(C.shares({categories:['资料'],shares:[item]}).shares[0],{...item,originalName:'',date:'',aliases:[]});
});
test('无效日期拒绝，合法闰年日期保留',()=>{
 assert.throws(()=>C.shares({categories:['资料'],shares:[{...share,date:'2025-02-29'}]}));
 assert.equal(C.shares({categories:['资料'],shares:[{...share,date:'2024-02-29'}]}).shares[0].date,'2024-02-29');
});
test('非网页连接串保留',()=>assert.equal(C.services({services:[{...service,nonWeb:true,url:'redis://localhost:6379'}]}).services[0].url,'redis://localhost:6379'));
test('当前实例的所有数据和配图引用有效',()=>{
 const site=C.instance(JSON.parse(fs.readFileSync('instance.json')));
 C.services(JSON.parse(fs.readFileSync('services.json')));
 const shares=C.shares(JSON.parse(fs.readFileSync('shares.json')));
 const art=JSON.parse(fs.readFileSync('artwork.json'));
 for(const item of shares.shares) assert.ok(art[item.artwork],item.id);
 assert.notEqual(site.storage.services,site.storage.shares);
});
