const {JSDOM}=require(process.env.QX_TEST_JSDOM||'jsdom');
const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'../..'),base=root+'/public/english/round2/';
function open(file,saved={}){
 const errors=[];
 const dom=new JSDOM(fs.readFileSync(base+file,'utf8'),{url:'https://test.example/english/round2/'+file,runScripts:'dangerously',beforeParse(w){
  w.alert=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
  for(const[k,v]of Object.entries(saved))w.localStorage.setItem(k,v);
  w.addEventListener('error',e=>errors.push(e.message));
 }});return{w:dom.window,d:dom.window.document,errors};
}
function complete(x,wrong=false){
 const {w,d}=x,$=id=>d.getElementById(id),qs=w.ROUND2_CONFIG.sections.flatMap(s=>s.items);
 $('startBtn').click();$('submitObjectiveBtn').click();assert.equal(w.QXAnswerAdapter.read().draft.phase,'active');
 qs.forEach((q,i)=>{let e=q.type==='mcq'?d.querySelector(`input[name="${q.id}"][value="${q.answer}"]`):$(q.id);if(q.type==='mcq')e.checked=true;else e.value=wrong&&i===0?'wrong':q.sample||q.answers[0];e.dispatchEvent(new w.Event('input',{bubbles:true}));});
 $('submitObjectiveBtn').click();
 for(const q of qs.filter(q=>q.type==='manual')){assert.equal($(q.id).disabled,true);const e=d.querySelector(`input[name="${q.id}-score"][value="2"]`);e.checked=true;e.dispatchEvent(new w.Event('change',{bubbles:true}));}
 if(qs.some(q=>q.type==='manual'))$('finalizeBtn').click();
 const report=w.QXAnswerAdapter.read().draft.report;
 assert.equal(report.total,qs.reduce((n,q)=>n+q.points,0)-(wrong?qs[0].points:0));
 assert.equal(report.records.length,qs.length);assert.ok(report.attemptId);assert.ok(report.records.every(q=>q.targets.length));
 assert.deepEqual(x.errors,[]);return report;
}
for(let day=32;day<=71;day++){const x=open(`main/day${day}.html`);assert.equal(complete(x).total,100);x.w.close();}
for(let n=1;n<=6;n++){const x=open(`review/history0${n}.html`);assert.equal(complete(x).total,10);assert.equal(x.w.QXAnswerAdapter.read().draft.paper.kind,'review');x.w.close();}
let x=open('main/day32.html');const report=complete(x,true),first=report.records[0];
const dispute=x.d.querySelector('[data-dispute]');dispute.checked=true;dispute.dispatchEvent(new x.w.Event('change',{bubbles:true}));
const fix=x.d.querySelector('[data-correction]');fix.value='订正';fix.dispatchEvent(new x.w.Event('input',{bubbles:true}));
assert.equal(x.w.QXAnswerAdapter.read().draft.report.records[0].disputed,true);
assert.equal(x.w.QXAnswerAdapter.read().draft.answers[first.id],'wrong');
const saved={...x.w.localStorage};x.w.close();x=open('main/day32.html',saved);
assert.equal(x.d.getElementById('totalScore').textContent,'99/100');assert.equal(x.d.querySelector('[data-correction]').value,'订正');assert.equal(x.d.querySelector('[data-dispute]').checked,true);x.w.close();
const logicDom=new JSDOM('',{runScripts:'outside-only'}),w=logicDom.window;
w.eval(fs.readFileSync(base+'review/review-logic.js','utf8'));
const DAY=86400000,t0=Date.UTC(2026,8,1),bank={questions:Array.from({length:8},(_,i)=>({id:'q'+i,type:'text',targets:['test'],q:'prompt '+i})),history:[]};
const r=(i,day,score=1,extras={})=>({attemptId:'a'+i,kind:'review',submittedAt:new Date(t0+day*DAY).toISOString(),lookupCount:0,records:[{id:'q'+i,question:'prompt '+i,targets:['test'],score,max:1}],...extras});
const collect=rs=>w.QXReviewLogic.collect(bank,rs,t0+8*DAY)[0];
assert.equal(collect([r(0,0,0),r(1,1),r(2,2),r(3,7)]).passes.length,2);
assert.equal(collect([r(0,0,0),r(1,2),r(2,2)]).passes.length,1);
const early=r(1,2);early.attemptId='retry';
assert.equal(collect([r(0,0,0),r(1,1),early]).passes.length,0);
assert.equal(collect([r(0,0,0),r(1,2,1,{lookupCount:1})]).passes.length,0);
assert.equal(collect([r(0,0,0),r(1,2),r(1,7)]).passes.length,1);
assert.equal(collect([r(0,0,0),r(1,2),r(2,7),r(3,8,0)]).passes.length,0);
const contested=r(0,0,0);contested.records[0].disputed=true;assert.equal(collect([contested]).status,'待核验');
w.close();
const dynamic=open('review/history01.html'),config=dynamic.w.ROUND2_CONFIG;
config.id='review-12345678-1234-1234-1234-123456789abc';config.revision+='-dynamic-test';
dynamic.w.location.hash=encodeURIComponent(JSON.stringify(config));
dynamic.w.eval(fs.readFileSync(base+'review/practice-template.js','utf8'));
dynamic.w.eval(fs.readFileSync(base+'review/practice-loader.js','utf8'));
assert.equal(dynamic.w.ROUND2_CONFIG.id,config.id);assert.equal(complete(dynamic).total,10);dynamic.w.close();
console.log('PASS: 40 main papers, 6 historical papers, dynamic paper loader, scores, locked answers, reload, disputes, cloud adapter payload, interval scheduling. DOM only; no live-browser/deployment claim.');
