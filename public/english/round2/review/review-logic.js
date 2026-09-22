/* Pure scheduling logic: two different questions, separated in time, not two clicks. */
(() => {
  'use strict';
  const DAY=86400000, text=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
  function aliases(bank) {
    const map={};
    for(const q of bank.questions) if(q.section==='wordform'&&q.targets?.length===1)
      for(const a of q.answers||[]) if(/^[a-z-]+$/.test(a)&&a!==q.targets[0]) map[a]=q.targets[0];
    return word=>{let w=text(word),seen=new Set();while(map[w]&&!seen.has(w)){seen.add(w);w=map[w];}return w;};
  }
  function collect(bank,reports,now=Date.now()) {
    const canonical=aliases(bank),items=new Map();
    const itemFor=word=>{const key=canonical(word);if(!items.has(key))items.set(key,{key,historyIds:[],failures:0,lastFailure:null,passes:[],seenIds:new Set(),seenTexts:new Set(),disputed:false,lastAnswer:'',lastAt:0});return items.get(key);};
    for(const q of bank.history){const item=itemFor(q.targets[0]);item.historyIds.push(...q.historyIds);for(const s of q.originalQuestions||[])item.seenTexts.add(text(s));}
    const unique=new Map();
    for(const r of reports){if(!Array.isArray(r.records))continue;const id=r.attemptId||r.cloudId||`${r.id||r.day}:${r.revision}:${r.submittedAt}`;if(!unique.has(id)||String(r.updatedAt||'')>String(unique.get(id).updatedAt||''))unique.set(id,r);}
    for(const r of [...unique.values()].sort((a,b)=>Date.parse(a.submittedAt)-Date.parse(b.submittedAt))){
      const at=Date.parse(r.submittedAt);if(!Number.isFinite(at))continue;
      for(const q of r.records){
        const bad=Number(q.score)<Number(q.max)||q.uncertain;
        for(const word of q.targets||[q.id]){
          const key=canonical(word);if(!bad&&!q.disputed&&!items.has(key))continue;
          const item=itemFor(key),origin=q.originId||q.id,qt=text(q.question);
          if(at>=item.lastAt){item.lastAt=at;item.lastAnswer=q.user||'未作答';}
          if(q.disputed){item.disputed=true;continue;}
          if(bad){item.failures++;item.lastFailure=at;item.passes=[];item.seenIds.add(origin);item.seenTexts.add(qt);continue;}
          const fresh=!item.seenIds.has(origin)&&!item.seenTexts.has(qt);
          item.seenIds.add(origin);item.seenTexts.add(qt);
          if(r.kind!=='review'||r.lookupCount>0||!fresh)continue;
          const due=item.passes.length>=2?item.passes.at(-1).at+30*DAY:item.passes.length?item.passes[0].at+5*DAY:(item.lastFailure===null?0:item.lastFailure+2*DAY);
          if(at>=due)item.passes.push({at,origin});
        }
      }
    }
    for(const item of items.values()){
      const stable=item.passes.length>=2;
      item.due=stable?item.passes.at(-1).at+30*DAY:item.passes.length?item.passes[0].at+5*DAY:item.lastFailure===null?0:item.lastFailure+2*DAY;
      const available=bank.questions.filter(q=>q.type!=='manual'&&q.targets?.some(w=>canonical(w)===item.key)&&!item.seenIds.has(q.originId||q.id)&&!item.seenTexts.has(text(q.q)));
      item.candidates=available;
      item.status=item.disputed?'待核验':!available.length?'待补变式':stable?(item.due<=now?'低频抽查到期':'低频抽查'):item.due<=now?'待复测':`已通过${item.passes.length}次，等待间隔`;
    }
    return [...items.values()].sort((a,b)=>Number(a.disputed)-Number(b.disputed)||a.due-b.due||b.failures-a.failures||a.key.localeCompare(b.key));
  }
  function select(items,now=Date.now()) {
    const seen=new Set(),result=[];
    for(const item of items){
      if(item.disputed||item.due>now)continue;
      const q=item.candidates.find(q=>!seen.has(text(q.q)));
      if(q){seen.add(text(q.q));result.push(q);}
      if(result.length===10)break;
    }
    return result;
  }
  window.QXReviewLogic={collect,select};
})();
