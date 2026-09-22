// Content rendering only. Does not run the production build or deploy anything.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),base=root+'/docs/english-grammar/';
const source=JSON.parse(fs.readFileSync(base+'source-transcription.json','utf8'));
const groups=JSON.parse(fs.readFileSync(base+'related-groups.json','utf8'));
const overrides=new Map(fs.readFileSync(base+'explanations.txt','utf8').split('\n').filter(x=>x&&!x.startsWith('#')).map(line=>{const at=line.indexOf('|');return[line.slice(0,at),line.slice(at+1).split('||')];}));
const data=source.filter(q=>!q.ref.startsWith('讲义'));
const ids=new Set(data.map(q=>q.id));
for(const id of overrides.keys())if(!ids.has(id))throw Error('Unknown explanation '+id);
function task(q){
 if(q.ref.startsWith('基础一'))return '按题目要求，划出句中的'+q.ref.split('·')[1].replace(/\d/g,'')+'。';
 if(/基础二|进阶一|进阶二/.test(q.ref))return '分析句子成分，先划分主句与从句，再标明各层内部成分。';
 if(q.ref.startsWith('基础三'))return '判断是简单句、并列句还是主从复合句。';
 if(q.ref.startsWith('句型段落'))return '写出句子的基本结构：SV、SVO、SVOO、SVP或SVOOC；有从句时先看主句。';
 if(q.ref.startsWith('合并句'))return '用并列连词将下面两句话合并，保留原意。';
 if(q.ref.startsWith('翻译'))return '将中文译成英文，注意动作与持续状态的区别。';
 if(q.ref.startsWith('延续性'))return '补全改写句，使之能够表达持续的时间。';
 if(q.ref==='所属改写'||q.ref.startsWith('介词前置'))return '按本题给出的结构改写句子。';
 if(q.chapter==='定语从句')return '填写合适的关系词或关系词短语。';
 return '根据上下文，用括号内词的适当形式或合适的动词结构填空。';
}
for(const q of data){
 q.task=task(q);q.explanation=overrides.get(q.id)||q.why.split(/(?<=[。！？])/).filter(Boolean);
 if(q.explanation.length===0)throw Error('Empty explanation '+q.id);
 const related=new Map();
 for(const g of groups){
  // Being ambiguous alone does not make two exercises grammatically related.
  if(g.ids.join(',')==='150,173,185,191')continue;
  if(!g.ids.includes(Number(q.id.slice(1))))continue;
  for(const n of g.ids){const id='q'+n;if(id===q.id)continue;if(!ids.has(id))throw Error('Unknown related ID '+id);
   const priority=g.ids.length;
   if(!related.has(id)||related.get(id).priority>priority)related.set(id,{id,reason:g.why,priority});
  }
 }
 q.related=[...related.values()].sort((a,b)=>a.priority-b.priority).slice(0,3).map(({id,reason})=>({id,reason}));
 if(q.id==='q134'||q.id==='q192')q.related.unshift({id:q.id==='q134'?'q192':'q134',reason:'原文重复：A12与B50是同一道题，不是新变式。'});
 q.related=q.related.filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i).slice(0,3);
 q.note=q.note.replace('放大后可见原答 have run，缺少 been；不是上一轮所说的 are run。','原答可见为 have run，缺少 been。');
}
const template=fs.readFileSync(base+'page-template.html','utf8');
const result=template.replace('__GRAMMAR_DATA__',JSON.stringify(data).replace(/</g,'\\u003c'));
fs.writeFileSync(root+'/public/english/grammar/index.html',result);
console.log(JSON.stringify({exercises:data.length,expandedExplanations:overrides.size,withRelated:data.filter(x=>x.related.length).length,withoutDirectRelated:data.filter(x=>!x.related.length).map(x=>x.id),action:'rendered source only; no build/deploy'}));
