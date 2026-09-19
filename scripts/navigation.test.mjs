import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const code=readFileSync(new URL('../public/shared/nav.js',import.meta.url),'utf8');
function fixture(path,alreadyLoaded=false) {
 const events={}, documentStyle={overflow:'auto'}, appended=[];
 function element(){return {listeners:{},attributes:{},style:{setProperty(){}},addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused=true;}};}
 const button=element(), close=element(), dialog=element(), media=element();
 dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.listeners.close();};
 const summaries=[{},{}],sync=[{},{}];
 const shadow={innerHTML:'',querySelector:s=>({'.menu-button':button,dialog,'.close':close}[s]),querySelectorAll:s=>s==='[data-summary]'?summaries:sync};
 const host=element();host.attachShadow=()=>shadow;
 const document={getElementById:()=>null,createElement:tag=>tag==='div'?host:element(),head:{append(){}},body:{style:{setProperty(){}},prepend(){},append:n=>appended.push(n)},documentElement:{style:documentStyle},querySelector:()=>alreadyLoaded?{}:null};
 vm.runInNewContext(code,{document,location:{pathname:path},getComputedStyle:()=>({paddingLeft:'0px'}),matchMedia:()=>media,window:{addEventListener:(k,fn)=>events[k]=fn}});
 return {shadow,button,close,dialog,media,summaries,sync,events,documentStyle,appended};
}
test('all navigation targets exist',()=>{
 const {shadow}=fixture('/math/chapter2/diagnostic.html');
 const paths=[...shadow.innerHTML.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(paths.length>40);
 for(const path of paths)assert.ok(existsSync(resolve('public','.'+path+(path.endsWith('/')?'index.html':''))),path);
});
test('current chapter opens and exact page is highlighted',()=>{
 const {shadow}=fixture('/math/chapter2/diagnostic.html');
 assert.match(shadow.innerHTML,/<details open><summary>第二章/);
 assert.equal([...shadow.innerHTML.matchAll(/aria-current="page"/g)].length,2);
 assert.match(shadow.innerHTML,/href="\/math\/chapter2\/diagnostic.html" aria-current="page"/);
});
test('directory index and legacy English route are recognized',()=>{
 assert.match(fixture('/math/index.html').shadow.innerHTML,/href="\/math\/" aria-current="page"/);
 assert.match(fixture('/day29.html').shadow.innerHTML,/<summary class="active-subject">英语/);
});
test('drawer locks scroll and close restores focus and original scroll style',()=>{
 const f=fixture('/');f.button.listeners.click();
 assert.equal(f.dialog.open,true);assert.equal(f.documentStyle.overflow,'hidden');assert.equal(f.button.attributes['aria-expanded'],'true');
 f.close.listeners.click();assert.equal(f.documentStyle.overflow,'auto');assert.equal(f.button.focused,true);assert.equal(f.button.attributes['aria-expanded'],'false');
});
test('desktop resize closes mobile drawer',()=>{
 const f=fixture('/');f.button.listeners.click();f.media.listeners.change({matches:true});assert.equal(f.dialog.open,false);
});
test('sidebar shows only confirmed progress and clears on logout',()=>{
 const f=fixture('/');const report=detail=>f.events['qx-progress-summary']({detail});
 report({signedIn:true,ready:true,completed:6,total:22,label:'已同步'});
 assert.equal(f.summaries[0].textContent,'已完成 6 / 22 项');
 report({signedIn:true,ready:false,label:'离线'});assert.equal(f.summaries[0].textContent,'云端进度待确认');
 report({signedIn:false});assert.equal(f.summaries[0].textContent,'登录后查看云端进度');
});
test('load shared progress client once, not a second client',()=>{
 assert.equal(fixture('/',true).appended.length,0);
 assert.equal(fixture('/math/').appended[0].src,'/shared/progress-sync.js');
});
