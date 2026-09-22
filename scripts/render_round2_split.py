"""Render reviewed text banks into 40 fixed main papers and a separate review hub.
No deployment, dependency build, database mutation, or legacy record migration.
"""
from pathlib import Path
import json, re, copy, random, html, hashlib, shutil

R=Path(__file__).resolve().parents[1]; D=R/'docs/english-round2'; O=R/'public/english/round2'
REV='r2-split-20260922-v2'
SOURCE='https://github.com/LenaLenaPan/qingxu-highschool/blob/main/source/%E9%AB%98%E8%80%83%E8%AF%8D%E6%B1%875000%E8%AF%8D%E6%96%B0.pdf'
SECTIONS={'M':('meaning','一、词义与拼写',20,1),'C':('collocation','二、固定搭配',15,2),'X':('context','三、语境辨析',13,2),'F':('wordform','四、词形变化',7,2),'T':('translation','五、句子翻译',5,2)}
def parse(path):
    result={};day=section=None
    for n,line in enumerate(path.read_text().splitlines(),1):
        if not line or line.startswith('#'):continue
        if line.startswith('@'):day=int(line[1:]);result[day]={};continue
        if line in SECTIONS:section=line;result[day][section]=[];continue
        assert day and section,(path,n)
        result[day][section].append(line.split('|'))
    return result
def answers(s):
    if s=='as//':return ['as','/']
    return s.split('/')
def target_guess(q,words):
    stem=re.search(r'\(([a-z]{4,})\)',q['q'])
    if stem:return stem[1]
    if q.get('answers') and len(q['answers'][0])>3 and re.fullmatch('[a-z-]+',q['answers'][0]):return q['answers'][0]
    found=[w for w in words if len(w)>3 and re.search(r'\b'+re.escape(w)+r'\b',q['q'],re.I)]
    return found[0] if found else q['id']
def question(day,kind,row,i,pages):
    section,title,count,points=SECTIONS[kind];word=row[0]
    q={'id':f'r2v2-d{day}-{section}-{i+1}','type':'text','points':points,'counted':True,'section':section,'targets':[word],
       'source':f'主词段：5000词手册印刷页{pages[0]}–{pages[1]}；含搭配用法、派生词与跨页回收；原创练习'}
    if kind=='M':
        q.update(q=f'{row[1]}。写本卷词条（{word[0]}开头，{len(word.replace("-",""))}个字母'+('，含连字符' if '-' in word else '')+'）。',answers=[word],explanation=f'{word}：{row[1]}。本题按提示考查指定词条；其他合理表达可标记待核验。')
        variants={'labour':'labor','defence':'defense','licence':'license','savoury':'savory','fertilizer':'fertiliser','urbanization':'urbanisation'}
        if word in variants:q['answers'].append(variants[word]);q['q']+='（英美拼写均可）'
    elif kind=='C':
        assert '___' in row[1],row
        q.update(q=row[1],answers=answers(row[2]),explanation='完整表达：'+row[1].replace('___',' / '.join(answers(row[2])))+'。注意介词、动词形式和语义方向；如有合理未列答案，可标记待核验。')
    elif kind=='X':
        found=re.findall(r'\{([^{}]+)\}',row[1]);assert len(found)==1,row
        correct=found[0];opts=[correct]+row[2].split(',');random.Random(day*100+i).shuffle(opts)
        q.update(type='mcq',q=row[1].replace('{'+correct+'}','___'),options=opts,answer=opts.index(correct),explanation='完整句：'+row[1].replace('{','').replace('}','')+'。结合词义、词性和前后文选择。')
    elif kind=='F':
        aa=answers(row[2]);q.update(q=f'{word} → {row[1]}：___（目标形式以{aa[0][0]}开头；英美拼写均可）',answers=aa,explanation=f'{word}的指定形式：'+ ' / '.join(aa)+'。注意派生形式或不规则变化，不直接填原词。')
    else:q.update(type='manual',q=row[1],sample=row[2],explanation='按首答自评：准确表达指定词语/结构及核心意思1分；其余信息完整、时态与句法基本正确1分。合理改写、英美拼写均可；不要求逐字相同。')
    return q

def engine_source():
    s=(O/'engine.js').read_text()
    pairs=[
      ('const key=`qingxu-vocab-round2-day${C.day}-${C.revision}`;', 'const key=`qingxu-vocab-round2-${C.id}-${C.revision}`;\n  const maximum=items.reduce((n,q)=>n+q.points,0);'),
      ('draft:{...state,corrections:undefined', "draft:{...state,paper:C.kind==='review'?C:undefined,corrections:undefined"),
      ('a.push({...state,archivedAt:', "a.push({...state,report:state.phase==='final'?report():null,archivedAt:"),
      (".replace(/\\s+/g,' ');", ".replace(/\\s+/g,' ').replace(/[；;]/g,';').replace(/\\s*;\\s*/g,';');"),
      ("answers:{},uncertain:{},scores:{},corrections:{},paused:false", "answers:{},uncertain:{},scores:{},corrections:{},disputes:{},attemptId:crypto.randomUUID(),paused:false"),
      ('JSON.stringify({...state,elapsed:elapsed()})', "JSON.stringify({...state,elapsed:elapsed(),report:state.phase==='final'?report():null})"),
      ('`已答 ${n}/70`', '`已答 ${n}/${items.length}`'),('n/70*100','n/items.length*100'),
      ("for(const el of document.querySelectorAll('[data-correction]'))state.corrections[el.dataset.correction]=el.value;", "for(const el of document.querySelectorAll('[data-correction]'))state.corrections[el.dataset.correction]=el.value;\n    state.disputes ||= {}; for(const el of document.querySelectorAll('[data-dispute]'))state.disputes[el.dataset.dispute]=el.checked;"),
      ('id:q.id,no:i+1,category:q.category', 'id:q.id,originId:q.originId||q.id,targets:q.targets||[q.id],disputed:!!state.disputes?.[q.id],no:i+1,category:q.category'),
      ('return {day:C.day,round:2,', 'return {id:C.id,kind:C.kind,attemptId:state.attemptId,day:C.day,round:2,'),
      ('`${d.total}/100`', '`${d.total}/${maximum}`'),('总分：${d.total}/100（含翻译自评）','总分：${d.total}/${maximum}'),
      ('q.id.includes(`-${s.id}-`)', "q.category===s.title.replace(/^[^、]+、/, '')"),
      ("首次作答已保留。先订正，再在约2天和7天后换语境复测；本次分数包含翻译自评。", "首答已保留。错题进入独立专项；约2天、7天换题复测。翻译为自评；本次正确不等于已经稳定掌握。"),
      ('</textarea></label></div>`).join', '</textarea></label><label><input type="checkbox" data-dispute="${q.id}" ${q.disputed?\'checked\':\'\'}> 我认为此评分有误，列为待核验（保留原分）</label></div>`).join'),
      ("state.phase='submitted';state.submittedAt", "state.phase=items.some(q=>q.type==='manual')?'submitted':'final';state.submittedAt"),
      ("$('manualFinalize').scrollIntoView({behavior:'smooth'});", "$(state.phase==='final'?'result':'manualFinalize').scrollIntoView({behavior:'smooth'});"),
      ("if(state.phase==='submitted'||state.phase==='final')lockAndExplain();", "if(state.phase==='submitted'||state.phase==='final')lockAndExplain();"),
      ('清许高考词汇 第二轮 Day ${C.day}', '清许高考词汇 ${C.title}'),
      ('`滚动复测：${d.reviewScore}/10（不计总分）`,', ''),
    ]
    for a,b in pairs:
        assert a in s,a
        s=s.replace(a,b)
    return s

E=html.escape
CSS=(R/'public/assets/style.css').read_text()+'''textarea{box-sizing:border-box;width:100%;padding:12px;margin-top:8px;border:1px solid #ccd3df;border-radius:8px;font:inherit}p,li{line-height:1.8}a{color:#314eaa}.navlinks{display:flex;gap:14px;flex-wrap:wrap}.source-note{background:#fff8e7;padding:14px;border-radius:10px}details{margin:12px 0}summary{cursor:pointer}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.table-scroll{overflow:auto}.q,.wrong-item{overflow-wrap:anywhere}.focus{line-height:2;columns:2}.focus span{display:block}button:focus-visible,a:focus-visible{outline:3px solid #526cca;outline-offset:3px}@media(max-width:600px){.focus{columns:1}.table-scroll table{min-width:500px}.hero{padding:18px}.navlinks>*{max-width:100%}}'''
NAV='<script>if(location.protocol!=="file:"){const s=document.createElement("script");s.src="/shared/nav.js";document.body.append(s);}</script>'
def shell(title,body,js=''):
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+E(title)+'</title><style>'+CSS+'</style></head><body><main class="wrap">'+body+'</main>'+js+NAV+'</body></html>'
def paper(c,engine):
    n=sum(len(s['items']) for s in c['sections']);maxi=sum(q['points'] for s in c['sections'] for q in s['items'])
    focus=c.get('focus',[])
    body=f'''<header class="hero"><p>清许英语 · 第二轮 · {'独立错题专项' if c['kind']=='review' else '固定主线'}</p><h1>{E(c['title'])}</h1><p>{E(c['range'])}</p><div class="meta"><div class="metric">题量<b>{n}题</b></div><div class="metric">独立总分<b>{maxi}分</b></div><div class="metric">建议用时<b>{'8–12' if n<=10 else '25–35'}分钟</b></div></div></header>
<nav class="navlinks"><a href="../index.html">第二轮入口</a><a href="../main/index.html">40次主线</a><a href="../review/index.html">错题专项</a></nav>
<section id="startPanel" class="card"><h2>开始前</h2><p>{'本次单独计分，不改写主线分数。请选择未查看答案的变式独立作答；同一天反复重做不算两次间隔通过。' if c['kind']=='review' else '先复习指定页段全部词条，再关闭词表进行测试。本卷60题是重点抽查，不等于该页每个词都已考过。不会的文字题可以写“不会”。'}</p>'''
    if focus:body+='<details><summary>本卷重点词（开始前可查看；不是该页完整词表）</summary><div class="focus">'+''.join(f'<span>{E(w)} — {E(m)}</span>' for w,m in focus)+'</div></details>'
    body+=f'''<p><a href="{SOURCE}" target="_blank" rel="noopener">打开原5000词手册（需联网；PDF页码＝印刷页码＋1）</a></p><p class="sub">在线版登录后同步；离线版仅本机保存。答完并提交全部首答后才显示参考。翻译允许合理改写。</p><label>姓名 <input id="studentName" value="清许" type="text"></label><button id="startBtn" class="primary">开始测试</button></section>
<p id="saveNotice" role="status"></p><section id="exam" class="hidden"><div class="toolbar"><div class="toolbar-inner"><span id="answeredPill" class="pill">已答 0/{n}</span><span id="lookupPill" class="pill">查词 0 次</span><div class="progress"><div id="progressBar"></div></div><div class="toolbar-actions"><button id="lookupBtn">记录查词</button><button id="pauseBtn">暂停</button><button id="submitObjectiveBtn" class="primary">提交全部首答</button></div><div id="timer" class="timer">00:00:00</div></div></div><div id="questions"></div><section id="manualFinalize" class="card hidden"><h2>翻译自评</h2><p>每题两个要点、每项1分：指定用法与核心意思；其余信息及句法。按已锁定的首答评分，不按订正评分。</p><button id="finalizeBtn" class="primary">生成最终结果</button></section></section>
<section id="result" class="card result"><h2>本次结果</h2><div class="result-grid"><div>总分<div class="big" id="totalScore">—</div></div><div>用时<div id="timeUsed">—</div></div><div>错题数<div id="wrongCount">—</div></div></div><span id="reviewScore" hidden></span><p id="resultBand"></p><div id="categoryScores"></div><h3>错题、不确定与订正</h3><div id="wrongList"></div><div class="footer-actions"><button id="copyBtn">复制总结</button><button id="downloadBtn">下载TXT备份</button><button id="downloadJsonBtn">下载完整JSON</button><button id="restartBtn">归档并重做</button><a href="../review/index.html">去错题专项</a></div><textarea id="copyFallback" class="hidden" readonly></textarea></section><p class="sub">版本：{REV}。主线与专项独立保存。判断题目歧义时保留原分，先标记待核验。</p>'''
    js='<script>window.ROUND2_CONFIG='+json.dumps(c,ensure_ascii=False).replace('</','<\\/')+';</script><script>'+engine+'</script>'
    return shell(c['title'],body,js)

def main():
    for sub in ['main','review']:(O/sub).mkdir(exist_ok=True)
    plan=json.loads((D/'plan.json').read_text());original=json.loads((D/'first-batch-questions.json').read_text())
    bank=parse(D/'lesson-bank.txt');checkpoints=parse(D/'checkpoint-bank.txt');papers={}
    for session in plan['sessions']:
        day=session['day'];pages=session['pages'];sections=[];focus=[]
        if day<=34:
            sections=copy.deepcopy(original[str(day)]['sections'][1:])
            words=[q.get('answers',[''])[0] for q in sections[0]['items']]
            focus=[(q['answers'][0],q['q']) for q in sections[0]['items']]
            for sec in sections:
                for i,q in enumerate(sec['items']):
                    q['targets']=[target_guess(q,words)];q['originId']=q['id'];q['id']=f'r2v2-d{day}-{sec["id"]}-{i+1}'
        else:
            raw=bank.get(day,checkpoints.get(day));assert raw is not None,day
            for kind,(sid,title,count,points) in SECTIONS.items():
                if kind in raw:
                    assert len(raw[kind])==count,(day,kind,len(raw[kind]))
                    qs=[question(day,kind,row,i,pages) for i,row in enumerate(raw[kind])]
                else:
                    assert day in checkpoints and kind in ['M','F']
                    eligible=[c for c in papers.values() if c['kind']=='main' and c['day']<day and c['day'] not in checkpoints]
                    queues=[copy.deepcopy(next(s['items'] for s in c['sections'] if s['id']==sid)) for c in eligible]
                    for i,q in enumerate(queues):random.Random(day+i).shuffle(q)
                    qs=[];used=set()
                    while len(qs)<count:
                        progressed=False
                        for queue in queues:
                            if not queue:continue
                            q=queue.pop(0);progressed=True
                            if q['q'] in used:continue
                            used.add(q['q']);q['originId']=q.get('originId',q['id']);q['id']=f'r2v2-d{day}-{sid}-{len(qs)+1}'
                            q['source']='综合回收：词义/词形保持回忆形式，不作为新语境测试证据。'+q['source'];qs.append(q)
                            if len(qs)==count:break
                        assert progressed
                sections.append({'id':sid,'title':title,'items':qs})
            focus=[(r[0],r[1]) for r in raw.get('M',[])]
        papers[day]={'id':f'main-d{day}','title':f'Day {day} · '+('综合验收' if day in checkpoints else '词段训练'),'day':day,'kind':'main','round':2,'revision':REV,'pages':pages,'focus':focus,'range':f'5000词手册印刷页{pages[0]}–{pages[1]}'+('；累积抽查' if day in checkpoints else '；全页复习＋重点抽查'),'sections':sections}
    history=[];mapped=set()
    for line in (D/'history-drill.txt').read_text().splitlines():
        if not line or line.startswith('#'):continue
        events,word,prompt,answer,why=line.split('|');mapped.update(events.split(','))
        history.append({'id':'hist-'+events.split(',')[0],'originId':'hist-'+events.split(',')[0],'historyIds':events.split(','),'targets':[word],'q':prompt,'answers':answers(answer),'type':'text','points':1,'counted':True,'section':'review','source':'第一轮已找回反馈的独立变式；历史事件：'+events,'explanation':why})
    audit=json.loads((D/'round1-audit.json').read_text())
    events_by_id={f"d{e['day']}-q{e['no']}":e for e in audit['events']}
    for q in history:
        q['originalQuestions']=[events_by_id[key].get('question','') for key in q['historyIds'] if events_by_id[key].get('question')]
    expected={f"d{e['day']}-q{e['no']}" for e in audit['events'] if e['status'] in ['待复测','疑似输入失误']}
    assert mapped==expected,{'unmapped':sorted(expected-mapped),'unexpected':sorted(mapped-expected)}
    pool=[q for c in papers.values() for s in c['sections'] for q in s['items'] if q['type']!='manual']+history
    # Six seed rounds; pad only with previously authored historical variants when needed.
    seed=copy.deepcopy(history)
    extras=[q for c in original.values() for q in c['sections'][0]['items'] if q['type']!='manual']
    while len(seed)%10:
        q=copy.deepcopy(extras.pop(0));q['targets']=[target_guess(q,[])];q['originId']=q['id'];q['points']=1;q['counted']=True;seed.append(q)
    reviewpapers=[]
    for j in range(0,len(seed),10):
        qs=copy.deepcopy(seed[j:j+10]);num=j//10+1
        for i,q in enumerate(qs):q['id']=f'r2v2-h{num}-review-{i+1}'
        reviewpapers.append({'id':f'history-{num}','title':f'历史错题专项 {num:02d}','day':f'专项{num:02d}','kind':'review','round':2,'revision':REV,'range':'第一轮错题独立复测；10题单独计分','sections':[{'id':'review','title':'一、独立复测','items':qs}]})
    engine=engine_source();(O/'main/engine.js').write_text(engine)
    for day,c in papers.items():(O/f'main/day{day}.html').write_text(paper(c,engine))
    for i,c in enumerate(reviewpapers,1):(O/f'review/history{i:02d}.html').write_text(paper(c,engine))
    # JS rather than fetch(JSON), so the separate hub also works under file://.
    payload={'revision':REV,'questions':pool,'history':history,'coverage':audit['coverage']}
    (O/'review/question-bank.js').write_text('window.QX_REVIEW_BANK='+json.dumps(payload,ensure_ascii=False).replace('</','<\\/')+';')
    (D/'main-papers.json').write_text(json.dumps(papers,ensure_ascii=False,indent=2))
    (D/'history-review-map.json').write_text(json.dumps(history,ensure_ascii=False,indent=2))
    rows=''.join(f'<tr><td><a href="day{d}.html">Day {d}</a></td><td>{c["pages"][0]}–{c["pages"][1]}</td><td>{"综合验收" if d in checkpoints else "词段训练"}</td><td>60题 / 100分</td></tr>' for d,c in papers.items())
    body='<header class="hero"><h1>第二轮系统复习 · 40次主线</h1><p>Day32–71 · 每次60题、100分 · 36次词段训练＋4次综合验收</p></header><nav class="navlinks"><a href="../index.html">第二轮入口</a><a href="../review/index.html">独立错题专项</a></nav><section class="card"><p>每次先复习页段全部词条，再做重点测试。20题词义、15题搭配、13题语境、7题词形、5题翻译。完成试卷不等于该页全部词条已经掌握。</p><p>词表92页均已安排；主线固定，不随每次错题改卷。错题另进专项，不重复计入主线总分。Day41、51、61、71为累计验收。</p><div class="table-scroll"><table><tr><th>训练</th><th>印刷页</th><th>类型</th><th>规格</th></tr>'+rows+'</table></div></section>'
    (O/'main/index.html').write_text(shell('第二轮40次主线',body))
    if not (O/'legacy-index.html').exists():shutil.copy2(O/'index.html',O/'legacy-index.html')
    body='''<header class="hero"><h1>清许英语 · 第二轮</h1><p>系统覆盖与错题复测分开进行</p></header><section class="card"><h2>① 第二轮系统复习</h2><p>40次 / 2400题；每次60题、100分，保持第一轮题型与风格。先复习指定页段，再进行重点抽查。</p><a class="btnlink primary" href="main/index.html">进入40次主线</a></section><section class="card"><h2>② 我的错题专项</h2><p>历史错题、新增错题、不确定项与待核验评分分开呈现。每轮至多10题，单独计分；主线分数不改写。</p><a class="btnlink primary" href="review/index.html">进入错题专项</a></section><section class="card"><h2>资料与旧记录</h2><p class="source-note">第一轮已找回24天报告信息；缺Day10–15、Day23，Day4和Day9需原报告核验。原114条标错记录不是114道有效错题。</p><p><a href="audit.html">查看第一轮核验台账</a> · <a href="legacy-index.html">旧版70题首批与记录</a></p><p>新版独立保存，不覆盖旧版Day32–34的试卷或成绩。在线同步需部署后登录；离线版仅本机保存。尚未找到的历史错误不会按“已掌握”处理。</p></section>'''
    (O/'index.html').write_text(shell('清许英语第二轮：主线与错题专项',body))
    # Placeholder-free shell for adaptive rounds; the review controller inserts a full saved paper.
    template=paper({'id':'dynamic','title':'动态错题专项','day':'动态','kind':'review','revision':REV,'range':'按本次到期项目组卷','sections':[{'id':'review','title':'一、独立复测','items':[history[0]]}]},engine)
    (O/'review/practice-template.js').write_text('window.QX_REVIEW_TEMPLATE='+json.dumps(template,ensure_ascii=False).replace('</','<\\/')+';')
    (O/'review/practice.html').write_text(shell('动态错题专项','<p id="loading">正在读取已生成的复测卷…</p><p><a href="index.html">返回错题专项</a></p>','<script src="practice-template.js"></script><script src="practice-loader.js"></script>').replace(NAV,''))
    seedlinks=''.join(f'<a class="btnlink" href="history{i:02d}.html">历史专项 {i:02d} · 10题</a> ' for i in range(1,len(reviewpapers)+1))
    body='''<header class="hero"><h1>我的错题专项</h1><p>首答不改写 · 每轮至多10题 · 两次间隔独立通过后转低频抽查</p></header><nav class="navlinks"><a href="../index.html">第二轮入口</a><a href="../main/index.html">40次主线</a><a href="../audit.html">历史核验台账</a></nav><section class="card"><p id="reviewStatus" role="status">正在读取本机记录…</p><button id="refreshReview">重新读取记录</button><button id="makeReview" class="primary">生成到期错题复测（最多10题）</button><p class="sub">这里只汇总答题结果与安排复测，不是AI错因诊断。要分析原因，请在对话中说“分析最近作答”。完成后返回本页读取结果。评分有争议的项目先核验，不自动判为知识薄弱。</p></section><section class="card"><h2>历史错题首轮回收</h2><p>以下固定卷覆盖当前台账的全部待复测/疑似输入失误事件；重复词条合并出题。新错题通过上方动态入口生成，固定卷不随意改题。</p>'''+seedlinks+'''</section><section class="card"><h2>当前队列</h2><p id="reviewSummary"></p><div class="table-scroll"><table><thead><tr><th>词条/项目</th><th>状态</th><th>最近首答</th><th>下次安排</th></tr></thead><tbody id="reviewRows"></tbody></table></div></section><p class="source-note">历史仍缺7天原报告。词条合并只是便于追踪；某一用法通过不等于这个词的所有用法都掌握。低频项目约30天后再抽查。没有不同题目的项目标为“待补变式”，不以重复原题冒充迁移通过。</p>'''
    (O/'review/index.html').write_text(shell('清许英语错题专项',body,'<script src="question-bank.js"></script><script src="review-logic.js"></script><script src="review.js"></script>'))
    report={'revision':REV,'main_papers':len(papers),'main_questions':sum(len(s['items']) for c in papers.values() for s in c['sections']), 'source_pages':92,'seed_review_papers':len(reviewpapers),'seed_review_questions':len(seed),'history_events_mapped':len(mapped),'historical_records':len(audit['events']),'missing_days':[10,11,12,13,14,15,23],'assessment_is_sampling_not_full_5000_word_testing':True}
    (D/'split-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
