(() => {
  'use strict';
  try{
    const c=JSON.parse(decodeURIComponent(location.hash.slice(1))),questions=c.sections?.flatMap(s=>s.items);
    if(c.kind!=='review'||!/^review-[0-9a-f-]{36}$/.test(c.id)||typeof c.revision!=='string'||c.revision.length>80||!questions?.length||questions.length>10||questions.some(q=>!['text','mcq'].includes(q.type)||q.points!==1||!/^[a-zA-Z0-9_-]+$/.test(q.id)))throw new Error('复测配置不完整');
    const json=JSON.stringify(c).replace(/<\//g,'<\\/');
    let page=window.QX_REVIEW_TEMPLATE.replace(/window\.ROUND2_CONFIG=[\s\S]*?;<\/script>/,()=>`window.ROUND2_CONFIG=${json};</script>`);
    page=page.replace('<b>1题</b>',`<b>${questions.length}题</b>`).replace('<b>1分</b>',`<b>${questions.length}分</b>`);
    document.open();document.write(page);document.close();
  }catch{document.getElementById('loading').textContent='未找到有效复测卷，请返回错题专项重新生成。';}
})();
