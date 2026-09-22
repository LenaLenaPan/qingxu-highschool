const {JSDOM}=require(process.env.QX_TEST_JSDOM || 'jsdom');
const assert=require('node:assert/strict'),fs=require('fs');
const base=require('path').resolve(__dirname,'../..')+'/';
function open(day,saved={}){
 let alerts=[],downloads=[],errors=[];
 const dom=new JSDOM(fs.readFileSync(base+`public/english/round2/day${day}.html`,'utf8'),{url:`https://offline.test/day${day}.html`,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.alert=m=>alerts.push(m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
  w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
  for(const [k,v]of Object.entries(saved))w.localStorage.setItem(k,v);
  w.addEventListener('error',e=>errors.push(e.message));
 }});return {dom,w:dom.window,d:dom.window.document,alerts,downloads,errors};
}
const results=[];
for(const day of [32,33,34]){
 let x=open(day),{w,d}=x;let $=id=>d.getElementById(id),qs=w.ROUND2_CONFIG.sections.flatMap(s=>s.items);
 assert.equal(qs.length,70);assert.equal(qs.filter(q=>q.counted).reduce((n,q)=>n+q.points,0),100);
 assert.equal(qs.filter(q=>!q.counted).reduce((n,q)=>n+q.points,0),10);
 $('startBtn').click();$('submitObjectiveBtn').click();assert.match(x.alerts[0],/请完成/);
 for(const q of qs){let e=q.type==='mcq'?d.querySelector(`input[name="${q.id}"][value="${q.answer}"]`):$(q.id);if(q.type==='mcq')e.checked=true;else e.value=q.type==='manual'?q.sample:q.answers[0];e.dispatchEvent(new w.Event('input',{bubbles:true}));}
 assert.equal($('answeredPill').textContent,'已答 70/70');
 if(day===32){
  for(const id of ['r2-d32-review-1','r2-d32-meaning-1']){$(id).value='wrong';$(id).dispatchEvent(new w.Event('input',{bubbles:true}));}
  $('r2-d32-meaning-2-uncertain').checked=true;$('r2-d32-meaning-2-uncertain').dispatchEvent(new w.Event('change',{bubbles:true}));$('lookupBtn').click();
  let saved={...w.localStorage};x.dom.window.close();x=open(day,saved);w=x.w;d=x.d;$=id=>d.getElementById(id);assert.equal($('pauseBtn').textContent,'继续');assert.equal($('r2-d32-review-1').value,'wrong');$('pauseBtn').click();
 }
 $('submitObjectiveBtn').click();assert.equal($(`r2-d${day}-translation-1`).disabled,true);
 let frozen=$('timer').textContent;
 $('finalizeBtn').click();assert.match(x.alerts.at(-1),/翻译自评/);
 for(let i=1;i<=5;i++){let e=d.querySelector(`input[name="r2-d${day}-translation-${i}-score"][value="2"]`);e.checked=true;e.dispatchEvent(new w.Event('change',{bubbles:true}));}
 $('finalizeBtn').click();assert.equal($('totalScore').textContent,`${day===32?99:100}/100`);assert.equal($('reviewScore').textContent,`${day===32?9:10}/10`);assert.equal($('timeUsed').textContent,frozen);
 if(day===32){
  let e=d.querySelector('[data-correction="r2-d32-review-1"]');e.value='名词形式admission';e.dispatchEvent(new w.Event('input',{bubbles:true}));$('downloadJsonBtn').click();assert.equal(x.downloads.length,1);
  let store=JSON.parse(w.localStorage.getItem('qingxu-vocab-round2-day32-r2-20260921-v1'));assert.equal(store.answers['r2-d32-review-1'],'wrong');assert.equal(store.corrections['r2-d32-review-1'],'名词形式admission');
  let saved={...w.localStorage};x.dom.window.close();x=open(day,saved);w=x.w;d=x.d;$=id=>d.getElementById(id);assert.equal($('totalScore').textContent,'99/100');assert.equal(d.querySelector('[data-correction="r2-d32-review-1"]').value,'名词形式admission');
 }
 assert.deepEqual(x.errors,[]);results.push({day,questions:70,score:$('totalScore').textContent,review:$('reviewScore').textContent});x.dom.window.close();
}
console.log(JSON.stringify({pass:true,results,checks:['70-item submission guard','90 objective + 10 self-score + 10 review','first answers locked before solutions','timer stops at submission','manual score guard','uncertain flag and corrections','reload state and final result','JSON export action'],limitation:'DOM checks only; real browser rendering not verified'},null,2));
