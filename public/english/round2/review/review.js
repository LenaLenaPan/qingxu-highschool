(() => {
  'use strict';
  const bank=window.QX_REVIEW_BANK,logic=window.QXReviewLogic,$=id=>document.getElementById(id);
  let rows=[],epoch=0,authClient,loading=false;
  const date=ms=>ms?new Date(ms).toLocaleDateString():'现在';
  function status(message){$('reviewStatus').textContent=message;}
  function localReports(){
    const reports=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key.startsWith('qingxu-vocab-round2-'))continue;
      try{const value=JSON.parse(localStorage.getItem(key));for(const s of Array.isArray(value)?value:[value])if(s.phase==='final'&&s.report)reports.push(s.report);}catch{}
    }
    return reports;
  }
  function render(reports,drafts=[]){
    const byId=new Map();for(const q of bank.questions){byId.set(q.id,q);if(q.originId)byId.set(q.originId,q);}
    reports=reports.map(r=>({...r,records:(r.records||[]).map(q=>({...q,targets:q.targets||byId.get(q.originId||q.id)?.targets||[q.id]}))}));
    rows=logic.collect(bank,reports);const body=$('reviewRows');body.replaceChildren();
    for(const item of rows){
      const tr=document.createElement('tr');
      const target=item.key.startsWith('r2-')?'旧题 '+item.key:item.key;
      for(const value of [target+(item.historyIds.length?` · 历史${item.historyIds.length}次`:''),item.status,item.lastAnswer||'历史首答见核验台账',item.disputed?'核验后安排':item.candidates.length?date(item.due):'需补充不同题目']){const td=document.createElement('td');td.textContent=value;tr.append(td);}
      body.append(tr);
    }
    $('reviewSummary').textContent=`${rows.length}个聚合项目；${rows.filter(x=>x.status==='待复测').length}项到期；${rows.filter(x=>x.disputed).length}项待核验。读取${reports.length}次已完成记录。`;
    let box=$('resumableReviews');if(!box){box=document.createElement('div');box.id='resumableReviews';$('reviewSummary').after(box);}box.replaceChildren();
    for(const draft of drafts){const a=document.createElement('a');a.className='btnlink';a.textContent='继续未完成的专项 · '+new Date(draft.created_at).toLocaleDateString();a.href='practice.html#'+encodeURIComponent(JSON.stringify(draft.draft.paper));box.append(a);}
  }
  async function refresh(){
    const ticket=++epoch,client=window.QXSupabase;loading=true;$('makeReview').disabled=true;
    try{
      if(!client){render(localReports());status('当前仅汇总本机记录。在线版登录并成功连接后，将读取当前账号的云端记录。');return;}
      if(authClient!==client){authClient=client;client.auth.onAuthStateChange(()=>{epoch++;rows=[];$('reviewRows').replaceChildren();$('makeReview').disabled=true;setTimeout(refresh,0);});}
      const {data:{session},error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;
      if(ticket!==epoch)return;
      if(!session?.user||session.user.is_anonymous){render(localReports());status('尚未登录：只显示当前设备记录。登录后以当前账号云端记录为准，不自动混入本机其他账号的内容。');return;}
      status('正在读取当前账号的作答记录…');const all=[];
      for(let offset=0;offset<10000;offset+=100){
        const {data,error}=await client.from('learning_answer_attempts').select('id,document_id,draft,phase,submitted_at,created_at,updated_at').eq('user_id',session.user.id).like('document_id','/english/round2/%').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99);
        if(ticket!==epoch)return;if(error)throw error;all.push(...data);if(data.length<100)break;if(offset===9900)throw new Error('记录过多，需要分期读取');
      }
      const reports=all.filter(r=>r.phase==='submitted'&&r.draft?.report).map(r=>({...r.draft.report,cloudId:r.id,submittedAt:r.submitted_at,updatedAt:r.updated_at}));
      const drafts=all.filter(r=>r.phase==='draft'&&r.draft?.paper?.kind==='review');
      render(reports,drafts);status('已读取当前账号云端记录 · '+new Date().toLocaleTimeString()+'。尚未同步的本机内容不会冒充云端记录。');
    }catch(e){if(ticket===epoch){rows=[];$('reviewRows').replaceChildren();$('reviewSummary').textContent='本次读取未完成，请重试；未将读取失败解释为没有错题。';status('读取失败：'+(e.message||'请检查网络'));}}
    finally{if(ticket===epoch){loading=false;$('makeReview').disabled=!rows.length;}}
  }
  $('refreshReview').onclick=refresh;
  $('makeReview').onclick=()=>{
    if(loading)return;
    const chosen=logic.select(rows);if(!chosen.length){status('目前没有可生成的到期变式。请查看等待间隔、待核验或待补变式项目。');return;}
    const id='review-'+crypto.randomUUID();
    const qs=chosen.map((q,i)=>({...q,id:`${id}-review-${i+1}`,originId:q.originId||q.id,points:1,counted:true,section:'review'}));
    const config={id,title:'动态错题专项',kind:'review',day:'动态专项',round:2,revision:bank.revision+'-'+id.slice(7),range:'到期错题变式 · '+qs.length+'题独立计分',sections:[{id:'review',title:'一、独立复测',items:qs}]};
    // Hash stays in the browser; it contains question configuration, not student answers.
    location.href='practice.html#'+encodeURIComponent(JSON.stringify(config));
  };
  window.addEventListener('qx-supabase-ready',refresh);refresh();
})();
