const {JSDOM}=require(process.env.QX_TEST_JSDOM||'jsdom');
const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'../..');
function open(saved={}){return new JSDOM(fs.readFileSync(root+'/public/chemistry/book1-practice-20260922.html','utf8'),{url:'https://test.example/chemistry/book1-practice-20260922.html',runScripts:'dangerously',beforeParse(w){w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};for(const[k,v]of Object.entries(saved))w.localStorage.setItem(k,v);}});}
let dom=open(),w=dom.window,d=w.document;
assert.equal(d.querySelectorAll('.question').length,8);
assert.equal(d.querySelector('.review-only').hidden,true);
const a=d.getElementById('q1-answer');a.value='0.50×17=8.5 g';a.dispatchEvent(new w.Event('input'));a.focus();
d.querySelector('#symbols button').click();assert.ok(a.value.includes('₂'));
d.getElementById('submit').click();assert.equal(a.readOnly,true);assert.equal(d.querySelector('.review-only').hidden,false);
const f=d.getElementById('q1-fix');f.value='注意粒子对象';f.dispatchEvent(new w.Event('input'));
let saved={...w.localStorage};dom.window.close();dom=open(saved);d=dom.window.document;
assert.equal(d.getElementById('q1-answer').readOnly,true);assert.equal(d.getElementById('q1-fix').value,'注意粒子对象');
assert.equal(d.documentElement.dataset.answerStorage,'local');dom.window.close();
console.log('PASS: chemistry 8 questions, hidden answers, symbols, first-answer locking, correction and refresh restore. DOM only.');
