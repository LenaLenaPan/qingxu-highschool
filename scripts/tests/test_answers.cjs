const {JSDOM}=require(process.env.QX_TEST_JSDOM || 'jsdom');
const fs=require('fs'),assert=require('assert/strict');
const base=require('path').resolve(__dirname,'../..')+'/';
const script=fs.readFileSync(base+'public/shared/answer-records.js','utf8');
const science=fs.readFileSync(base+'public/shared/science-input.js','utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const copy=x=>JSON.parse(JSON.stringify(x));
let rows=[],fail=false,delay=0,uploads=[];
const client={auth:{getSession:async()=>({data:{session:{user:{id:'user-a'}}}}),onAuthStateChange(fn){this.cb=fn;}},storage:{from(){return{upload:async(path)=>{uploads.push(path);return{};},createSignedUrl:async(path)=>({data:{signedUrl:'https://signed.test/'+path}})}}},from(){let mode='read',body,filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},limit(){return q},insert(b){mode='insert';body=b;return q},update(b){mode='update';body=b;return q},single(){return q.maybeSingle()},async maybeSingle(){await wait(delay);if(fail)return{error:{message:'offline'}};let row=rows.find(r=>filters.every(([k,v])=>r[k]===v));if(mode==='insert'){row={...copy(body),version:1,updated_at:new Date().toISOString()};rows.unshift(row);}if(mode==='update'&&row){Object.assign(row,copy(body));row.version++;row.updated_at=new Date().toISOString();}if(row?.phase==='submitted'&&!row.first_submission)row.first_submission={draft:copy(row.draft),attachments:copy(row.attachments)};return{data:row?copy(row):null};}};return q;}};
function open(path='/physics/chapter1-practice.html',cache={}){
 const html=fs.readFileSync(base+'public'+path,'utf8');
 const d=new JSDOM(html,{url:'https://test.example'+path,runScripts:'outside-only',pretendToBeVisual:true});
 const w=d.window;w.confirm=()=>true;w.alert=()=>{};w.QXSupabase=client;
 for(const[k,v]of Object.entries(cache))w.localStorage.setItem(k,v);
 w.eval(script);return{d,w,doc:w.document};
}
function edit(x,selector,value){const el=x.doc.querySelector(selector);el.value=value;el.dispatchEvent(new x.w.Event('input',{bubbles:true}));return el;}
function btn(x,text){return[...x.doc.querySelectorAll('button')].find(b=>b.textContent===text);}
(async()=>{
 let x=open();await wait(100);
 edit(x,'#q1-first','v = $\\frac{Δx}{Δt}$');await x.w.QXAnswers.flush();assert.equal(rows.length,1);assert.match(rows[0].draft.fields['q1-first'],/frac/);
 delay=25;edit(x,'#q1-result','A');const pending=x.w.QXAnswers.flush();await wait(5);edit(x,'#q1-result','AB');await pending;await wait(180);assert.equal(rows[0].draft.fields['q1-result'],'AB');delay=0;
 fail=true;edit(x,'#q1-result','offline value');await x.w.QXAnswers.flush();const saved={...x.w.localStorage};assert.match(x.doc.querySelector('[role=status]').textContent,/尚未同步/);x.w.close();
 fail=false;x=open(undefined,saved);await wait(200);assert.equal(x.doc.querySelector('#q1-result').value,'offline value');assert.equal(rows[0].draft.fields['q1-result'],'offline value');
 btn(x,'提交并保留首答').click();await wait(100);assert.equal(rows[0].phase,'submitted');assert.equal(x.doc.querySelector('#q1-first').disabled,true);assert.equal(x.doc.querySelector('#q1-fix').disabled,false);
 edit(x,'#q1-fix','订正：Δv/Δt');await x.w.QXAnswers.flush();assert.equal(rows[0].corrections['q1-fix'],'订正：Δv/Δt');assert.equal(rows[0].first_submission.draft.fields['q1-result'],'offline value');
 let y=open();await wait(100);assert.equal(y.doc.querySelector('#q1-result').value,'offline value');assert.equal(y.doc.querySelector('#q1-fix').value,'订正：Δv/Δt');y.w.close();
 rows[0].version++;edit(x,'#q1-fix','different local correction');await x.w.QXAnswers.flush();assert.match(x.doc.querySelector('[role=status]').textContent,/另一台设备/);assert.equal(rows[0].corrections['q1-fix'],'订正：Δv/Δt');x.w.close();
 rows=[];x=open('/math/monthly-exam-1-targeted-01.html');await wait(20);assert.equal(x.doc.querySelectorAll('.qx-written textarea').length,18);x.w.eval(science);const t=x.doc.querySelector('.qx-written textarea');t.value='x';t.dispatchEvent(new x.w.Event('input',{bubbles:true}));t.setSelectionRange(1,1);t.dispatchEvent(new x.w.Event('select'));btn(x,'²').click();assert.equal(t.value,'x²');await x.w.QXAnswers.flush();assert.ok(Object.values(rows[0].draft.fields).includes('x²'));
 x.w.eval(fs.readFileSync(base+'public/shared/vendor/katex/katex.min.js','utf8'));
 x.w.HTMLDialogElement.prototype.showModal=function(){this.open=true};x.w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new x.w.Event('close'))};
 btn(x,'插入公式').click();const dialog=x.doc.querySelector('dialog'),ab=dialog.querySelectorAll('input');ab[0].value='1';ab[1].value='2';[...dialog.querySelectorAll('button')].find(b=>b.textContent==='插入').click();
 assert.ok(t.value.includes('$\\frac{1}{2}$'));assert.ok(x.doc.querySelector('.qx-math-preview .katex'));await x.w.QXAnswers.flush();x.w.close();
 // Photo association is saved with the attempt, and restored on a new device.
 rows=[];x=open();await wait(100);edit(x,'#q1-first','handwriting');await x.w.QXAnswers.flush();
 x.w.createImageBitmap=async()=>({width:2400,height:1200,close(){}});
 x.w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){}});
 x.w.HTMLCanvasElement.prototype.toBlob=function(fn){fn(new x.w.Blob(['jpeg'],{type:'image/jpeg'}));};
 await x.w.QXAnswers.uploadPhoto({size:100,type:'image/jpeg',name:'手写.jpg'},'q1-first');
 assert.equal(rows[0].attachments.length,1);assert.match(rows[0].attachments[0].path,/^user-a\//);assert.equal(rows[0].attachments[0].field,'q1-first');
 y=open();await wait(100);assert.equal(y.w.QXAnswers.photos('q1-first').length,1);y.w.close();x.w.close();
 // Round-two adapter preserves score/report, original answers and independent corrections across devices.
 rows=[];
 function english(cache={}){const d=new JSDOM(fs.readFileSync(base+'public/english/round2/day32.html','utf8'),{url:'https://test.example/english/round2/day32.html',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.alert=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};for(const[k,v]of Object.entries(cache))w.localStorage.setItem(k,v);}});d.window.QXSupabase=client;d.window.eval(script);return{d,w:d.window,doc:d.window.document};}
 x=english();await wait(100);x.doc.querySelector('#startBtn').click();
 for(const q of x.w.ROUND2_CONFIG.sections.flatMap(s=>s.items)){const el=q.type==='mcq'?x.doc.querySelector(`input[name="${q.id}"][value="${q.answer}"]`):x.doc.getElementById(q.id);if(q.type==='mcq')el.checked=true;else el.value=q.type==='manual'?q.sample:q.answers[0];el.dispatchEvent(new x.w.Event('input',{bubbles:true}));}
 x.doc.querySelector('#submitObjectiveBtn').click();await x.w.QXAnswers.flush();
 for(let i=1;i<=5;i++){const el=x.doc.querySelector(`input[name="r2-d32-translation-${i}-score"][value="2"]`);el.checked=true;el.dispatchEvent(new x.w.Event('change',{bubbles:true}));}
 x.doc.querySelector('#finalizeBtn').click();await x.w.QXAnswers.flush();assert.equal(rows[0].draft.report.total,100);assert.equal(rows[0].first_submission.draft.phase,'submitted');
 y=english();await wait(200);assert.equal(y.doc.querySelector('#totalScore').textContent,'100/100');assert.equal(y.doc.querySelector('#r2-d32-translation-1').disabled,true);y.w.close();
 await x.w.QXAnswers.newAttempt();const freshCache={...x.w.localStorage};delete freshCache['qingxu-vocab-round2-day32-r2-20260921-v1'];x.w.close();
 x=english(freshCache);await wait(100);assert.equal(x.doc.querySelector('#startPanel').classList.contains('hidden'),false);x.doc.querySelector('#startBtn').click();await x.w.QXAnswers.flush();assert.equal(rows.length,2);x.w.close();
 rows=[];x=open('/chemistry/special-practice-1.html');await wait(20);assert.equal(x.doc.querySelectorAll('textarea[data-qx-key]').length,24);x.w.close();
 console.log('PASS: draft autosave, edits during write, offline recovery, cross-device restore, first-answer lock, separate correction, version conflict, static worksheet inputs, symbol insertion, chemistry field mapping, photo metadata restore, round-two cloud report and retry');
})().catch(e=>{console.error(e);process.exit(1)});
