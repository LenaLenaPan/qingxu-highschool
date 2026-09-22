const {JSDOM}=require(process.env.QX_TEST_JSDOM||'jsdom'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),key='qingxu-grammar-20260922-v1';
const source=JSON.parse(fs.readFileSync(root+'/docs/english-grammar/source-transcription.json','utf8'));
const html=fs.readFileSync(root+'/public/english/grammar/index.html','utf8');
function open(saved={},hash=''){const errors=[];const dom=new JSDOM(html,{url:'https://test.example/english/grammar/'+hash,runScripts:'dangerously',beforeParse(w){w.HTMLElement.prototype.scrollIntoView=function(){};w.confirm=()=>true;w.print=()=>{};w.localStorage.setItem(key,JSON.stringify(saved));w.addEventListener('error',e=>errors.push(e.message));}});return{dom,w:dom.window,d:dom.window.document,errors};}
let x=open({q125:{note:'旧版的思路',mark:'flagged'},q1:{note:'旧讲义记录保留',mark:'learned'}},'#q125');
const select=id=>{x.d.getElementById('questionSelect').value=id;x.d.getElementById('questionSelect').dispatchEvent(new x.w.Event('change'));};
assert.equal(x.d.querySelectorAll('#questionSelect option').length,199);
assert.match(x.d.querySelector('[data-current]').textContent,/哥哥一直在通电话/);
assert.equal(x.d.getElementById('note').value,'旧版的思路');
select('q126');assert.equal(x.d.querySelector('.related details').dataset.related,'q132');
assert.match(x.d.querySelector('.related summary').textContent,/The cause/);
assert.match(x.d.querySelector('[data-current] .explanation').textContent,/外层The day没有谓语/);
x.d.querySelector('[data-jump="q132"]').click();assert.equal(x.d.querySelector('[data-current]').dataset.current,'q132');
select('q134');assert.equal(x.d.querySelector('.related details').dataset.related,'q192');assert.match(x.d.querySelector('.related .reason').textContent,/原文重复/);
for(const q of source.filter(q=>!q.ref.startsWith('讲义'))){select(q.id);assert.equal(x.d.querySelector('[data-current]').dataset.current,q.id);assert.equal(x.d.querySelector('[data-current]>.question').textContent,q.q);assert.ok(x.d.querySelector('.explanation').textContent.trim());assert.ok(!x.d.body.textContent.includes('undefined'));for(const b of x.d.querySelectorAll('[data-jump]'))assert.ok(source.some(s=>s.id===b.dataset.jump));}
select('q125');const note=x.d.getElementById('note');note.value='<script>test</script>';note.dispatchEvent(new x.w.Event('input',{bubbles:true}));x.d.querySelector('[data-mark="learned"]').click();
const saved=JSON.parse(x.w.localStorage.getItem(key));assert.equal(saved.q125.note,'<script>test</script>');assert.equal(saved.q125.mark,'learned');assert.equal(saved.q1.note,'旧讲义记录保留');assert.deepEqual(x.errors,[]);x.w.close();
x=open(saved,'#q125');assert.equal(x.d.getElementById('note').value,'<script>test</script>');assert.equal(x.d.querySelectorAll('script').length,2);
x.d.getElementById('search').value='school';x.d.getElementById('search').dispatchEvent(new x.w.Event('input'));assert.ok(x.d.querySelectorAll('#questionSelect option').length>1);
x.d.getElementById('pageFilter').value='21';x.d.getElementById('pageFilter').dispatchEvent(new x.w.Event('change'));assert.ok([...x.d.querySelectorAll('#questionSelect option')].every(o=>o.textContent.startsWith('P21')));
x.d.getElementById('printAll').click();assert.ok(x.d.querySelectorAll('.print-item').length>0);x.w.dispatchEvent(new x.w.Event('afterprint'));assert.equal(x.d.getElementById('printroot').childElementCount,0);
x.d.getElementById('clear').click();select('q209');assert.equal(x.d.querySelector('.related details').dataset.related,'q210');assert.deepEqual(x.errors,[]);x.w.close();
console.log('PASS: all 199 original stems, 199 explanations, related links, exact duplicate label, old notes/marks including hidden lecture IDs, safe note rendering, search/page filters and print. DOM only; no build or deploy.');
