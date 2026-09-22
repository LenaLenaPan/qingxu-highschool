const {JSDOM}=require(process.env.QX_TEST_JSDOM||'jsdom'),fs=require('fs'),assert=require('assert/strict'),path=require('path');
const base=path.resolve(__dirname,'../../public/english/round2/review');
const pause=()=>new Promise(r=>setTimeout(r,25));
(async()=>{
 const dom=new JSDOM(fs.readFileSync(base+'/index.html','utf8'),{url:'https://test.example/english/round2/review/index.html',runScripts:'outside-only'}),w=dom.window;
 let owner='a',fail=false,calls=[],callback;
 const report={attemptId:'attempt-a',kind:'main',submittedAt:new Date().toISOString(),records:[{id:'q',targets:['test'],question:'test',score:0,max:1,user:'wrong'}]};
 w.QX_REVIEW_BANK={revision:'test',history:[],questions:[{id:'other',targets:['test'],q:'new test',type:'text'}]};
 w.QXSupabase={auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),onAuthStateChange(fn){callback=fn;}},from(table){assert.equal(table,'learning_answer_attempts');let filtered;
  const q={select(){return q},eq(k,v){assert.equal(k,'user_id');filtered=v;calls.push(v);return q},like(k,v){assert.equal(v,'/english/round2/%');return q},order(){return q},async range(){return fail?{error:{message:'offline'}}:{data:filtered==='a'?[{id:'cloud',phase:'submitted',submitted_at:report.submittedAt,draft:{report}}]:[]};}};return q;}};
 w.eval(fs.readFileSync(base+'/review-logic.js','utf8'));w.eval(fs.readFileSync(base+'/review.js','utf8'));await pause();
 assert.match(w.document.getElementById('reviewRows').textContent,/wrong/);assert.deepEqual(calls,['a']);
 owner='b';callback();await pause();assert.equal(w.document.getElementById('reviewRows').textContent,'');assert.deepEqual(calls,['a','b']);
 fail=true;w.document.getElementById('refreshReview').click();await pause();assert.match(w.document.getElementById('reviewStatus').textContent,/读取失败/);assert.equal(w.document.getElementById('makeReview').disabled,true);
 w.close();console.log('PASS: review hub owner filter, account switch clears previous rows, query failure blocks generation. Mocked client only.');
})();
