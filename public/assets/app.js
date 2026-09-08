const {day:DAY,range:RANGE,nextText:NEXT_TEXT,sections}=window.DAY_CONFIG;
const stateKey=`qingxu-vocab-day${DAY}-state-v2`;
const resultKey=`qingxu-vocab-day${DAY}-result-v2`;
let started=false,startTime=null,paused=false,pausedAt=null,pausedTotal=0,lookupCount=0,timerId=null,objectiveSubmitted=false,finalized=false;

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function normalize(s){return String(s??"").trim().toLowerCase().replace(/[’]/g,"'").replace(/\s+/g," ");}
function formatTime(ms){let sec=Math.max(0,Math.floor(ms/1000)),h=String(Math.floor(sec/3600)).padStart(2,'0');sec%=3600;let m=String(Math.floor(sec/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');return `${h}:${m}:${s}`;}
function elapsedNow(){if(!started)return 0;if(paused)return pausedAt-startTime-pausedTotal;return Date.now()-startTime-pausedTotal;}

function render(){
  const host=document.getElementById("questions"); let n=0; let htmls=[];
  sections.forEach(sec=>{
    htmls.push(`<section class="card"><h2>${esc(sec.title)}</h2><div class="sub">${esc(sec.note)}</div>`);
    sec.items.forEach((item,idx)=>{
      n++; const qno=n;
      let qtext="",body="";
      if(sec.type==="text"){
        qtext=item[0];
        body=`<input id="q${qno}" type="text" autocomplete="off"><div id="q${qno}-feedback" class="feedback hidden"></div>`;
      }else if(sec.type==="mcq"){
        qtext=item.q;
        body=`<div class="options">`+item.options.map((op,oi)=>`<label><input type="radio" name="q${qno}" value="${oi}"> ${esc(op)}</label>`).join("")+`</div><div id="q${qno}-feedback" class="feedback hidden"></div>`;
      }else{
        qtext=item.q;
        body=`<textarea id="q${qno}" rows="3" style="width:100%;margin-top:8px;padding:10px;border:1px solid #cfd5df;border-radius:9px;font-size:16px"></textarea>
        <div id="q${qno}-manual" class="hidden" style="margin-top:10px">
          <div class="feedback ok"><b>参考：</b>${esc(item.sample)}<br><span class="small">要点：${esc(item.keys)}</span></div>
          <div class="self-score">
            <label><input type="radio" name="q${qno}-score" value="0"> 0分</label>
            <label><input type="radio" name="q${qno}-score" value="1"> 1分</label>
            <label><input type="radio" name="q${qno}-score" value="2"> 2分</label>
          </div>
        </div>`;
      }
      htmls.push(`<div class="q"><div class="q-title">第${qno}题｜${esc(sec.category)}${sec.counted?'':'（不计总分）'}<br>${esc(qtext)}</div>${body}<label class="uncertain"><input type="checkbox" id="q${qno}-uncertain"> 我不确定</label></div>`);
    });
    htmls.push(`</section>`);
  });
  host.innerHTML=htmls.join("");
}

function countAnswered(){
  let n=0,answered=0;
  sections.forEach(sec=>sec.items.forEach(item=>{n++; if(sec.type==="mcq"){if(document.querySelector(`input[name="q${n}"]:checked`))answered++;}else{if((document.getElementById(`q${n}`)?.value||"").trim())answered++;}}));
  document.getElementById("answeredPill").textContent=`已答 ${answered}/70`;
  document.getElementById("progressBar").style.width=`${answered/70*100}%`;
}
function tick(){document.getElementById("timer").textContent=formatTime(elapsedNow());}
function startExam(){
  started=true; startTime=Date.now(); document.getElementById("startPanel").classList.add("hidden");document.getElementById("exam").classList.remove("hidden");timerId=setInterval(tick,500);tick();saveState();
}
function togglePause(){
  const btn=document.getElementById("pauseBtn");
  if(!paused){paused=true;pausedAt=Date.now();btn.textContent="继续";document.getElementById("questions").style.filter="blur(4px)";document.getElementById("questions").style.pointerEvents="none";}
  else{paused=false;pausedTotal+=Date.now()-pausedAt;btn.textContent="暂停";document.getElementById("questions").style.filter="";document.getElementById("questions").style.pointerEvents="";}
  saveState();
}
function saveState(){
  if(!started||finalized)return; let n=0,answers={},unc={},manualScores={};
  sections.forEach(sec=>sec.items.forEach(item=>{n++; if(sec.type==="mcq"){const c=document.querySelector(`input[name="q${n}"]:checked`);answers[n]=c?c.value:"";}else{answers[n]=document.getElementById(`q${n}`)?.value||"";}
    unc[n]=document.getElementById(`q${n}-uncertain`)?.checked||false; const ms=document.querySelector(`input[name="q${n}-score"]:checked`); if(ms)manualScores[n]=ms.value;
  }));
  localStorage.setItem(stateKey,JSON.stringify({started,startTime,paused,pausedAt,pausedTotal,lookupCount,objectiveSubmitted,answers,unc,manualScores}));
}
function restore(){
  const raw=localStorage.getItem(stateKey); if(!raw)return;
  try{const s=JSON.parse(raw); if(!s.started)return; started=true;startTime=s.startTime;paused=!!s.paused;pausedAt=s.pausedAt;pausedTotal=s.pausedTotal||0;lookupCount=s.lookupCount||0;objectiveSubmitted=!!s.objectiveSubmitted;
    document.getElementById("startPanel").classList.add("hidden");document.getElementById("exam").classList.remove("hidden");document.getElementById("lookupPill").textContent=`查词 ${lookupCount} 次`;
    let n=0;sections.forEach(sec=>sec.items.forEach(item=>{n++;const a=s.answers?.[n];if(sec.type==="mcq"){if(a!==undefined&&a!==""){const el=document.querySelector(`input[name="q${n}"][value="${a}"]`);if(el)el.checked=true;}}else if(document.getElementById(`q${n}`))document.getElementById(`q${n}`).value=a||"";
      const u=document.getElementById(`q${n}-uncertain`);if(u)u.checked=!!s.unc?.[n]; if(s.manualScores?.[n]!==undefined){const m=document.querySelector(`input[name="q${n}-score"][value="${s.manualScores[n]}"]`);if(m)m.checked=true;}
    }));
    if(paused){document.getElementById("pauseBtn").textContent="继续";document.getElementById("questions").style.filter="blur(4px)";document.getElementById("questions").style.pointerEvents="none";}
    if(objectiveSubmitted){applySubmittedState();} else timerId=setInterval(tick,500);
    tick();countAnswered();
  }catch(e){console.warn(e)}
}
function applySubmittedState(){
  clearInterval(timerId);document.getElementById("submitObjectiveBtn").disabled=true;document.getElementById("lookupBtn").disabled=true;document.getElementById("pauseBtn").disabled=true;
  let n=0; sections.forEach(sec=>sec.items.forEach(item=>{n++;
    if(sec.type==="manual"){document.getElementById(`q${n}-manual`).classList.remove("hidden");return;}
    const fb=document.getElementById(`q${n}-feedback`);let correct=false,user="",answer="";
    if(sec.type==="text"){const el=document.getElementById(`q${n}`);user=el.value;answer=item[1][0];correct=item[1].some(a=>normalize(a)===normalize(user));el.disabled=true;}
    else{const c=document.querySelector(`input[name="q${n}"]:checked`);user=c?item.options[Number(c.value)]:"";answer=item.options[item.answer];correct=!!c&&Number(c.value)===item.answer;document.querySelectorAll(`input[name="q${n}"]`).forEach(x=>x.disabled=true);}
    fb.className=`feedback ${correct?'ok':'bad'}`;fb.innerHTML=correct?'正确':`你的答案：${esc(user||'未作答')}<br>正确答案：${esc(answer)}`;fb.classList.remove("hidden");
  }));document.querySelectorAll('.uncertain input').forEach(x=>x.disabled=true);document.getElementById("manualFinalize").classList.remove("hidden");
}
function submitObjective(){
  if(paused)togglePause();if(!confirm("提交后将显示客观题答案，并进入翻译自评。确认提交吗？"))return;objectiveSubmitted=true;applySubmittedState();saveState();document.getElementById("manualFinalize").scrollIntoView({behavior:"smooth",block:"center"});
}
function gradeData(){
  let n=0,total=0,reviewScore=0,wrong=[],uncertain=0;const cat={};const student=document.getElementById("studentName").value.trim()||"清许";
  sections.forEach(sec=>{if(!cat[sec.category])cat[sec.category]={score:0,max:0,counted:sec.counted};sec.items.forEach(item=>{n++;cat[sec.category].max+=sec.points;const uf=document.getElementById(`q${n}-uncertain`)?.checked||false;if(uf)uncertain++;
      let score=0,user="",answer="";
      if(sec.type==="text"){user=document.getElementById(`q${n}`).value;answer=item[1][0];if(item[1].some(a=>normalize(a)===normalize(user)))score=sec.points;}
      else if(sec.type==="mcq"){const c=document.querySelector(`input[name="q${n}"]:checked`);user=c?item.options[Number(c.value)]:"";answer=item.options[item.answer];if(c&&Number(c.value)===item.answer)score=sec.points;}
      else{user=document.getElementById(`q${n}`).value;const c=document.querySelector(`input[name="q${n}-score"]:checked`);score=c?Number(c.value):0;answer=item.sample;}
      cat[sec.category].score+=score;if(sec.counted)total+=score;else reviewScore+=score;
      if(score<sec.points||uf)wrong.push({no:n,category:sec.category,q:sec.type==="mcq"?item.q:(sec.type==="manual"?item.q:item[0]),user:user||"未作答",answer,score,max:sec.points,uncertain:uf});
  })});
  return {student,total,reviewScore,wrong,uncertain,cat,elapsed:elapsedNow(),lookupCount};
}
function finalize(){
  let n=0,missing=[];sections.forEach(sec=>sec.items.forEach(item=>{n++;if(sec.type==="manual"&&!document.querySelector(`input[name="q${n}-score"]:checked`))missing.push(n);}));if(missing.length){alert(`请先完成第 ${missing.join("、")} 题的自评打分。`);return;}
  finalized=true;const data=gradeData();window.finalData=data;document.getElementById("totalScore").textContent=`${data.total}/100`;document.getElementById("reviewScore").textContent=`${data.reviewScore}/10`;document.getElementById("timeUsed").textContent=formatTime(data.elapsed);document.getElementById("wrongCount").textContent=data.wrong.filter(x=>x.score<x.max).length;
  document.getElementById("resultBand").textContent=data.total>=95?"掌握扎实：继续推进，同时只滚动回收错题。":data.total>=90?"整体稳定：保持速度，重点修复搭配和语境错题。":data.total>=80?"基础可用：下一天继续推进，但增加历史错词回收。":"掌握不稳：建议缩小当日新增量，优先修复高频错误。";
  document.getElementById("categoryScores").innerHTML=Object.entries(data.cat).map(([k,v])=>`<div style="margin:8px 0"><b>${esc(k)}</b>：${v.score}/${v.max}${v.counted?'':'（不计入总分）'}</div>`).join("");
  document.getElementById("wrongList").innerHTML=data.wrong.length?data.wrong.map(x=>`<div class="wrong-item"><div><b>第${x.no}题｜${esc(x.category)}</b>${x.uncertain?' <span class="pill">不确定</span>':''}</div><div>${esc(x.q)}</div><div class="small">作答：${esc(x.user)}｜参考：${esc(x.answer)}｜得分：${x.score}/${x.max}</div></div>`).join(""):"<p>没有错题或不稳定题。</p>";
  document.getElementById("manualFinalize").classList.add("hidden");document.getElementById("result").style.display="block";document.getElementById("result").scrollIntoView({behavior:"smooth",block:"start"});
  localStorage.removeItem(stateKey);localStorage.setItem(resultKey,JSON.stringify({total:data.total,reviewScore:data.reviewScore,time:formatTime(data.elapsed),wrong:data.wrong.filter(x=>x.score<x.max).length,date:new Date().toISOString()}));
}
function summaryText(){
  const d=window.finalData||gradeData();const lines=[`【清许高考词汇 Day ${DAY} 测试结果】`,`学生：${d.student}`,`范围：${RANGE}`,`用时：${formatTime(d.elapsed)}`,`查词次数：${d.lookupCount}`,`总分：${d.total}/100`,`错题数：${d.wrong.filter(x=>x.score<x.max).length}`,`不确定题数：${d.uncertain}`,"","分类表现：",...Object.entries(d.cat).map(([k,v])=>`${k}：${v.score}/${v.max}${v.counted?'':'（不计入总分）'}`),"","错题与不稳定题：",...(d.wrong.length?d.wrong.map(x=>`第${x.no}题｜${x.category}｜作答：${x.user}｜参考：${x.answer}｜${x.uncertain?'不确定':`得分${x.score}/${x.max}`}`):["无"]),"",NEXT_TEXT];return lines.join("\n");
}
async function copySummary(){try{await navigator.clipboard.writeText(summaryText());alert("总结已复制。");}catch(e){const ta=document.createElement("textarea");ta.value=summaryText();document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();alert("总结已复制。");}}
function downloadSummary(){const blob=new Blob([summaryText()],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`清许_英语词汇_Day${DAY}_结果.txt`;a.click();URL.revokeObjectURL(url);}
function restart(){if(!confirm("确定清空本次答案并重新开始吗？"))return;localStorage.removeItem(stateKey);localStorage.removeItem(resultKey);location.reload();}

render();restore();
document.getElementById("startBtn").addEventListener("click",startExam);
document.getElementById("lookupBtn").addEventListener("click",()=>{lookupCount++;document.getElementById("lookupPill").textContent=`查词 ${lookupCount} 次`;saveState();});
document.getElementById("pauseBtn").addEventListener("click",togglePause);
document.getElementById("submitObjectiveBtn").addEventListener("click",submitObjective);
document.getElementById("finalizeBtn").addEventListener("click",finalize);
document.getElementById("copyBtn").addEventListener("click",copySummary);
document.getElementById("downloadBtn").addEventListener("click",downloadSummary);
document.getElementById("restartBtn").addEventListener("click",restart);
document.addEventListener("input",()=>{countAnswered();saveState();});
document.addEventListener("change",()=>{countAnswered();saveState();});
window.addEventListener("beforeunload",saveState);
