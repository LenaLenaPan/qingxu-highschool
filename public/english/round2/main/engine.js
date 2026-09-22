/* Second-round engine. First-round assets and storage keys are left intact. */
(() => {
  'use strict';
  const C=window.ROUND2_CONFIG, $=id=>document.getElementById(id);
  const items=C.sections.flatMap(s=>s.items.map(q=>({...q,category:s.title.replace(/^[^、]+、/, '')})));
  const key=`qingxu-vocab-round2-${C.id}-${C.revision}`;
  const maximum=items.reduce((n,q)=>n+q.points,0);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s??'').trim().toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ').replace(/[；;]/g,';').replace(/\s*;\s*/g,';');
  const time=ms=>{let t=Math.floor(ms/1000);return [Math.floor(t/3600),Math.floor(t/60)%60,t%60].map(x=>String(x).padStart(2,'0')).join(':');};
  let state={revision:C.revision,phase:'ready',student:'清许',elapsed:0,lookup:0,answers:{},uncertain:{},scores:{},corrections:{},disputes:{},attemptId:crypto.randomUUID(),paused:false};
  let anchor=null;
  const elapsed=()=>state.elapsed+(anchor===null?0:Date.now()-anchor);
  function notice(t){$('saveNotice').textContent=t;}
  function save(){
    try{localStorage.setItem(key,JSON.stringify({...state,elapsed:elapsed(),report:state.phase==='final'?report():null}));}
    catch(e){notice('本机保存不可用；提交后请下载TXT或JSON保留记录。');}
    window.dispatchEvent(new Event('qx-answer-change'));
  }
  try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s?.revision===C.revision){state=s;if(state.phase==='active')state.paused=true;}}
  catch(e){notice('未能读取旧记录，当前可重新作答。');}
  function render(){
    let n=0;
    $('questions').innerHTML=C.sections.map(sec=>`<section class="card"><h2>${esc(sec.title)}</h2><p class="sub">${sec.items.length}题，每题${sec.items[0].points}分${sec.id==='review'?'，单独计分':'，计入主卷'}。${sec.id==='translation'?'先独立作答，提交后按要点自评。':''}</p>${sec.items.map(q=>{
      n++;const id=q.id;
      const input=q.type==='mcq'?`<div class="options">${q.options.map((op,i)=>`<label><input type="radio" name="${id}" value="${i}" ${String(state.answers[id])===String(i)?'checked':''}> ${esc(op)}</label>`).join('')}</div>`:q.type==='manual'?`<textarea id="${id}" rows="3" aria-label="第${n}题作答">${esc(state.answers[id]||'')}</textarea>`:`<input type="text" id="${id}" autocomplete="off" aria-label="第${n}题作答" value="${esc(state.answers[id]||'')}">`;
      return `<div class="q" data-id="${id}"><div class="q-title">第${n}题${q.counted?'':'｜复测'}<br>${esc(q.q)}</div>${input}<label class="uncertain"><input type="checkbox" id="${id}-uncertain" ${state.uncertain[id]?'checked':''}> 我不确定</label><div id="${id}-feedback" class="feedback hidden"></div>${q.type==='manual'?`<div id="${id}-manual" class="self-score hidden">${[0,1,2].map(v=>`<label><input type="radio" name="${id}-score" value="${v}" ${state.scores[id]===v?'checked':''}> ${v}分</label>`).join('')}</div>`:''}</div>`;
    }).join('')}</section>`).join('');
    $('studentName').value=state.student;
  }
  function capture(){
    if(state.phase==='active'){
      state.student=$('studentName').value.trim()||'清许';
      for(const q of items){state.answers[q.id]=q.type==='mcq'?(document.querySelector(`input[name="${q.id}"]:checked`)?.value??''):$(q.id).value;state.uncertain[q.id]=$(`${q.id}-uncertain`).checked;}
    }
    if(state.phase==='submitted')for(const q of items.filter(q=>q.type==='manual')){const a=document.querySelector(`input[name="${q.id}-score"]:checked`);if(a)state.scores[q.id]=Number(a.value);}
    for(const el of document.querySelectorAll('[data-correction]'))state.corrections[el.dataset.correction]=el.value;
    state.disputes ||= {}; for(const el of document.querySelectorAll('[data-dispute]'))state.disputes[el.dataset.dispute]=el.checked;
  }
  function right(q){return q.type==='mcq'?String(state.answers[q.id])===String(q.answer):q.answers?.some(a=>norm(a)===norm(state.answers[q.id]));}
  function expected(q){return q.type==='manual'?q.sample:q.type==='mcq'?q.options[q.answer]:q.answers.join(' / ');}
  function score(q){return q.type==='manual'?(state.scores[q.id]??0):right(q)?q.points:0;}
  function userAnswer(q){let a=state.answers[q.id];return q.type==='mcq'?q.options[Number(a)]||'未作答':a||'未作答';}
  function progress(){const n=items.filter(q=>String(state.answers[q.id]??'').trim()!=='').length;$('answeredPill').textContent=`已答 ${n}/${items.length}`;$('progressBar').style.width=`${n/items.length*100}%`;$('lookupPill').textContent=`查词 ${state.lookup} 次`;$('timer').textContent=time(elapsed());}
  function lockAndExplain(){
    for(const q of items){
      const box=document.querySelector(`[data-id="${q.id}"]`);
      box.querySelectorAll('input,textarea').forEach(el=>{if(!el.name.endsWith('-score'))el.disabled=true;});
      const fb=$(`${q.id}-feedback`);fb.className='feedback '+(q.type==='manual'||right(q)?'ok':'bad');
      fb.innerHTML=`${q.type==='manual'?'参考（允许合理改写）':right(q)?'正确':'首答：'+esc(userAnswer(q))}<br><b>${esc(expected(q))}</b><br>${esc(q.explanation)}<br><span class="small">${esc(q.source)}</span>`;
      if(q.type==='manual'){$(`${q.id}-manual`).classList.remove('hidden');box.querySelectorAll(`input[name="${q.id}-score"]`).forEach(el=>el.disabled=state.phase==='final');}
    }
    $('manualFinalize').classList.toggle('hidden',state.phase==='final');
  }
  function syncUI(){
    $('startPanel').classList.toggle('hidden',state.phase!=='ready');$('exam').classList.toggle('hidden',state.phase==='ready');
    const active=state.phase==='active';
    for(const id of ['submitObjectiveBtn','lookupBtn','pauseBtn'])$(id).disabled=!active;
    $('pauseBtn').textContent=state.paused?'继续':'暂停';
    $('questions').inert=active&&state.paused;
    $('questions').style.filter=active&&state.paused?'blur(5px)':'';
    if(state.phase==='submitted'||state.phase==='final')lockAndExplain();
    if(state.phase==='final')renderResult();
    progress();
  }
  function pause(){
    if(state.phase!=='active')return;
    if(!state.paused){state.elapsed=elapsed();anchor=null;state.paused=true;}else{state.paused=false;anchor=Date.now();}
    save();syncUI();
  }
  function report(){
    const records=items.map((q,i)=>({id:q.id,originId:q.originId||q.id,targets:q.targets||[q.id],disputed:!!state.disputes?.[q.id],no:i+1,category:q.category,counted:q.counted,question:q.q,user:userAnswer(q),answer:expected(q),score:score(q),max:q.points,uncertain:!!state.uncertain[q.id],explanation:q.explanation,source:q.source,correction:state.corrections[q.id]||''}));
    return {id:C.id,kind:C.kind,attemptId:state.attemptId,day:C.day,round:2,revision:C.revision,range:C.range,student:state.student,submittedAt:state.submittedAt,elapsed:state.elapsed,lookupCount:state.lookup,total:records.filter(q=>q.counted).reduce((s,q)=>s+q.score,0),reviewScore:records.filter(q=>!q.counted).reduce((s,q)=>s+q.score,0),records,wrong:records.filter(q=>q.score<q.max||q.uncertain)};
  }
  function renderResult(){
    const d=report();$('result').style.display='block';$('totalScore').textContent=`${d.total}/${maximum}`;$('reviewScore').textContent=`${d.reviewScore}/10`;$('timeUsed').textContent=time(d.elapsed);$('wrongCount').textContent=d.records.filter(q=>q.score<q.max).length;
    const cats=C.sections.map(s=>{const rr=d.records.filter(q=>q.category===s.title.replace(/^[^、]+、/, ''));return `${esc(s.title)}：${rr.reduce((n,q)=>n+q.score,0)}/${rr.reduce((n,q)=>n+q.max,0)}${s.id==='review'?'（不计主卷）':''}`;});
    $('categoryScores').innerHTML=cats.map(t=>`<p>${t}</p>`).join('');
    $('resultBand').textContent='首答已保留。错题进入独立专项；约2天、7天换题复测。翻译为自评；本次正确不等于已经稳定掌握。';
    $('wrongList').innerHTML=d.wrong.length?d.wrong.map(q=>`<div class="wrong-item"><b>第${q.no}题｜${esc(q.category)}${q.uncertain?'｜不确定':''}</b><p>${esc(q.question)}</p><p>首答：${esc(q.user)}<br>参考：${esc(q.answer)}<br>得分：${q.score}/${q.max}</p><p class="small">${esc(q.explanation)}</p><label>订正与错误原因（不改首答）<textarea data-correction="${q.id}" rows="2">${esc(q.correction)}</textarea></label><label><input type="checkbox" data-dispute="${q.id}" ${q.disputed?'checked':''}> 我认为此评分有误，列为待核验（保留原分）</label></div>`).join(''):'<p>本次没有错题或不确定题，后续仍会抽查。</p>';
  }
  function summary(){
    const d=report();return [`【清许高考词汇 ${C.title} 测试结果】`,`学生：${d.student}`,`范围：${d.range}`,`版本：${d.revision}`,`用时：${time(d.elapsed)}（提交时停止计时）`,`查词次数：${d.lookupCount}`,`总分：${d.total}/${maximum}`,`错题数：${d.records.filter(q=>q.score<q.max).length}`,`不确定题数：${d.records.filter(q=>q.uncertain).length}`,'','分类表现：',...C.sections.map(s=>{const rr=d.records.filter(q=>q.category===s.title.replace(/^[^、]+、/, ''));return `${s.title}：${rr.reduce((n,q)=>n+q.score,0)}/${rr.reduce((n,q)=>n+q.max,0)}`;}),'','错题与不稳定题：',...(d.wrong.length?d.wrong.map(q=>`第${q.no}题｜${q.category}｜首答：${q.user}｜参考：${q.answer}｜得分${q.score}/${q.max}${q.uncertain?'｜不确定':''}\n题目ID：${q.id}\n原题：${q.question}\n说明：${q.explanation}\n订正：${q.correction||'未填写'}`):['无']),'','请结合第一轮Day1–31错题台账与本次结果，更新后续滚动复测。'].join('\n');
  }
  function download(content,ext,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=`qingxu-round2-day${C.day}-result.${ext}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('startBtn').onclick=()=>{state.phase='active';state.student=$('studentName').value.trim()||'清许';state.paused=false;anchor=Date.now();save();syncUI();};
  $('pauseBtn').onclick=pause;
  $('lookupBtn').onclick=()=>{if(state.phase!=='active'||state.paused)return;state.lookup++;save();progress();};
  $('submitObjectiveBtn').onclick=()=>{
    if(state.phase!=='active')return;
    capture();const missing=items.map((q,i)=>String(state.answers[q.id]??'').trim()===''?i+1:null).filter(Boolean);
    if(missing.length){alert(`请完成第 ${missing.join('、')} 题后提交。确实不会的文字题可填“不会”，并标记不确定。`);return;}
    if(!confirm('提交后锁定全部首答、停止计时，并显示答案。确认提交？'))return;
    state.elapsed=elapsed();anchor=null;state.paused=false;state.phase=items.some(q=>q.type==='manual')?'submitted':'final';state.submittedAt=new Date().toISOString();save();syncUI();$(state.phase==='final'?'result':'manualFinalize').scrollIntoView({behavior:'smooth'});
  };
  $('finalizeBtn').onclick=()=>{if(state.phase!=='submitted')return;capture();if(items.some(q=>q.type==='manual'&&state.scores[q.id]===undefined)){alert('请先按首答完成5道翻译自评。');return;}state.phase='final';save();syncUI();$('result').scrollIntoView({behavior:'smooth'});};
  $('copyBtn').onclick=async()=>{capture();save();try{await navigator.clipboard.writeText(summary());notice('总结已复制。');}catch(e){$('copyFallback').classList.remove('hidden');$('copyFallback').value=summary();$('copyFallback').select();notice('请复制下方总结文本，或下载TXT。');}};
  $('downloadBtn').onclick=()=>{capture();save();download(summary(),'txt','text/plain;charset=utf-8');};
  $('downloadJsonBtn').onclick=()=>{capture();save();download(JSON.stringify(report(),null,2),'json','application/json');};
  $('restartBtn').onclick=async()=>{if(!confirm('保留本次记录，并开始新的尝试。确定？'))return;try{if(window.QXAnswers)await window.QXAnswers.newAttempt();}catch(e){alert(e.message);return;}try{const k=key+'-attempts',a=JSON.parse(localStorage.getItem(k)||'[]');a.push({...state,report:state.phase==='final'?report():null,archivedAt:new Date().toISOString()});localStorage.setItem(k,JSON.stringify(a));localStorage.removeItem(key);}catch(e){alert('本机归档失败，请先下载结果。');return;}state.phase='ready';anchor=null;window.removeEventListener('beforeunload',save);location.reload();};
  document.addEventListener('input',()=>{capture();progress();save();});document.addEventListener('change',()=>{capture();progress();save();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='active'&&!state.paused)pause();});
  window.addEventListener('beforeunload',save);
  window.QXAnswerAdapter={
    read(){return {draft:{...state,paper:C.kind==='review'?C:undefined,corrections:undefined,elapsed:elapsed(),report:state.phase==='final'?report():null},corrections:{...state.corrections},submitted:['submitted','final'].includes(state.phase)};},
    apply(data){
      if(!data.draft?.revision)return;
      anchor=null;state={...data.draft,corrections:data.corrections||{}};
      if(state.phase==='active')state.paused=true;
      if(data.submitted&&!['submitted','final'].includes(state.phase))state.phase='submitted';
      render();syncUI();save();
    }
  };
  render();syncUI();setInterval(()=>{if(state.phase==='active'&&!state.paused)progress();},500);
})();
