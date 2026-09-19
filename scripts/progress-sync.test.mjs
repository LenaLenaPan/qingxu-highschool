import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../src/progress-sync.ts', import.meta.url),'utf8');
const code = transformSync(source.replace(/^import[^\n]+\n/, '').replace(/const supabase = createClient[\s\S]*?\n\}\);/, 'const supabase = mockClient;'), {loader:'ts',target:'es2020'}).code;
const task = {id:'task-one',steps:[{id:'attempt',label:'首次作答'},{id:'correction',label:'订正'}],defaultBucket:'week',contentState:'ready'};
function fixture() {
 const nodes = new Map();
 const storage = new Map(), calls = [];
 let response = {data:[],error:null};
 const client = {
  auth: {getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>{}},
  from:()=> {
   const call={filters:[]}; calls.push(call);
   const q={eq:(...args)=>{call.filters.push(args);return q;},select:()=>q,
    update:body=>{call.method='update';call.body=body;return q;},
    insert:body=>{call.method='insert';call.body=body;return q;},
    then:(resolve,reject)=>Promise.resolve(response).then(resolve,reject)};
   return q;
  }
 };
 const context=vm.createContext({mockClient:client,document:{readyState:'loading',querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[],addEventListener:()=>{}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 window:{addEventListener:()=>{},dispatchEvent:()=>{}},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},setTimeout:()=>{},Intl,Date,console,AbortSignal,fetch:async()=>({ok:false})});
 vm.runInContext(code+`
globalThis.h = {
 set:(u,p,ready=true)=>{currentUser=u;progress=p;cloudReady=ready;plan={subjects:{},tasks:[testTask]};},
 writeTask,saveTask,loadCloud,renderAuth,taskCard,setupAuth,importLegacyProgress,
 get:()=>({progress,cloudReady,busy,syncLabel})
};`,Object.assign(context,{testTask:task}));
 return {h:context.h,storage,calls,nodes,respond:r=>{response=r;}};
}
const empty=()=>({version:1,tasks:{},updatedAt:null});
const user={id:'user-a',email:'example@example.com'};
test('login form is visible after initialization',async()=>{
 const f=fixture();let hidden=true;
 f.nodes.set('[data-qx-login-form]',{toggleAttribute:(_,value)=>{hidden=value;}});
 await f.h.setupAuth();assert.equal(hidden,false);
});
test('cloud read selects only current user and replaces prior state',async()=>{
 const f=fixture();f.h.set(user,empty(),false);
 f.respond({data:[{task_id:'task-one',done:['attempt'],bucket:'week',version:3,updated_at:'2026-09-19',completed_at:null}],error:null});
 await f.h.loadCloud();
 assert.equal(f.h.get().progress.tasks['task-one'].revision,3);
 assert.deepEqual(f.calls[0].filters,[['user_id','user-a']]);
 assert.equal(f.h.get().cloudReady,true);
});
test('writes include owner, task and previous version; accept server timestamp',async()=>{
 const f=fixture();const p=empty();p.tasks['task-one']={done:['attempt'],bucket:'week',revision:3};
 f.h.set(user,p);f.respond({data:[{task_id:'task-one',done:['attempt','correction'],bucket:'done',version:4,updated_at:'server-time',completed_at:'server-time'}],error:null});
 await f.h.saveTask(task,{done:['attempt','correction'],bucket:'done'});
 assert.deepEqual(f.calls[0].filters,[['user_id','user-a'],['task_id','task-one'],['version',3]]);
 assert.equal(f.h.get().progress.tasks['task-one'].completedAt,'server-time');
 assert.equal(f.storage.has('qingxu-cloud-progress-cache-v1:user-a'),true);
 assert.equal(f.storage.has('qingxu-cloud-progress-cache-v1'),false);
});
test('stale update does not overwrite acknowledged state and requires refresh',async()=>{
 const f=fixture();const p=empty();p.tasks['task-one']={done:['attempt'],bucket:'week',revision:3};f.h.set(user,p);
 await assert.rejects(f.h.saveTask(task,{done:['attempt','correction'],bucket:'done'}),/另一台设备/);
 assert.equal(f.h.get().progress.tasks['task-one'].revision,3);
 assert.equal(f.h.get().cloudReady,false);assert.equal(f.h.get().busy,false);
});
test('network failure never marks a task completed',async()=>{
 const f=fixture();f.h.set(user,empty());f.respond({data:null,error:{message:'network down'}});
 await assert.rejects(f.h.saveTask(task,{done:['attempt'],bucket:'week'}),/未确认/);
 assert.equal(f.h.get().progress.tasks['task-one'],undefined);assert.equal(f.h.get().cloudReady,false);
});
test('signed-out writes are rejected without request',async()=>{
 const f=fixture();f.h.set(null,empty(),false);
 await assert.rejects(f.h.writeTask(task,{done:[],bucket:'week'}),/先登录/);assert.equal(f.calls.length,0);
});
test('partial tasks cannot be manually filed as completed',()=>{
 const f=fixture();f.h.set(user,empty());assert.doesNotMatch(f.h.taskCard(task),/option value="done"/);
});
test('legacy import does not overwrite an existing cloud task',async()=>{
 const f=fixture();f.h.set(user,empty());
 f.storage.set('qingxu-cloud-progress-cache-v1',JSON.stringify({tasks:{'task-one':{done:['attempt','correction'],bucket:'done'}}}));
 f.respond({data:[{task_id:'task-one',done:[],bucket:'week',version:2,updated_at:'time',completed_at:null}],error:null});
 await f.h.importLegacyProgress();assert.equal(f.calls.length,1);
 assert.equal(f.h.get().progress.tasks['task-one'].done.length,0);
 assert.equal(f.storage.has('qingxu-cloud-progress-cache-v1'),true);
});
