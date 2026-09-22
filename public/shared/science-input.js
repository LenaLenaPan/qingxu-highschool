/* Formula templates, Unicode symbols and private handwritten attachments. */
(() => {
  'use strict';
  const api = window.QXAnswers;
  if (!api) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/shared/vendor/katex/katex.min.css'; document.head.append(css);
  const script = document.createElement('script'); script.src = '/shared/vendor/katex/katex.min.js'; document.body.append(script);
  const symbols = ['≤','≥','≠','≈','±','×','÷','π','θ','α','β','Δ','∞','∈','∉','⊆','∪','∩','∅','→','⇌','↑','↓','·','²','³','⁺','⁻','₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
  const templates = [
    {name:'分数', a:'分子', b:'分母', make:(a,b)=>`\\frac{${a}}{${b}}`},
    {name:'上标 / 次方', a:'底数或符号', b:'指数 / 电荷', make:(a,b)=>`{${a}}^{${b}}`},
    {name:'下标', a:'符号', b:'下标', make:(a,b)=>`{${a}}_{${b}}`},
    {name:'根号', a:'根号内', make:a=>`\\sqrt{${a}}`},
    {name:'向量', a:'向量名', make:a=>`\\vec{${a}}`},
    {name:'化学式', a:'例如 H_2O 或 SO_4^{2-}', make:a=>`\\mathrm{${a}}`}
  ];
  function button(label, action) {const b=document.createElement('button'); b.type='button'; b.textContent=label; b.onclick=action; return b;}
  function renderMath(text, root) {
    root.replaceChildren();
    const parts = String(text).split(/(\$[^$\n]{1,1000}\$)/g);
    parts.forEach(part => {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2 && window.katex) {
        const span=document.createElement('span');
        try {window.katex.render(part.slice(1,-1),span,{throwOnError:false,trust:false,strict:'ignore',maxExpand:100,maxSize:10});}
        catch {span.textContent=part;} root.append(span);
      } else root.append(document.createTextNode(part));
    });
  }
  function enhance(input) {
    if (input.dataset.qxEnhanced || !api.fieldKey(input)) return;
    input.dataset.qxEnhanced='true';
    const toolbar=document.createElement('div'); toolbar.className='qx-science'; toolbar.dataset.qxUi='';
    const preview=document.createElement('div'); preview.className='qx-math-preview'; preview.setAttribute('aria-label','作答预览');
    let start=input.selectionStart||0,end=input.selectionEnd||0;
    const remember=()=>{start=input.selectionStart;end=input.selectionEnd;};
    ['keyup','click','select','blur','input'].forEach(name=>input.addEventListener(name,remember));
    const insert=value=>{
      if(input.disabled||input.readOnly){alert('首答已锁定，请在订正栏输入。');return;}
      input.focus();input.setSelectionRange(start,end);input.setRangeText(value,start,end,'end');remember();
      input.dispatchEvent(new Event('input',{bubbles:true})); update();
    };
    const update=()=>{preview.hidden=!input.value;renderMath(input.value,preview);};
    input.addEventListener('input',update);script.addEventListener('load',update);window.addEventListener('qx-answers-restored',update);
    const detail=document.createElement('details'); const summary=document.createElement('summary');summary.textContent='符号键盘';detail.append(summary);
    const keys=document.createElement('div');keys.className='qx-symbols';
    symbols.forEach(symbol=>keys.append(button(symbol,()=>insert(symbol))));detail.append(keys);
    toolbar.append(button('插入公式',()=>{
      if(input.disabled||input.readOnly){alert('请在可编辑的订正栏输入。');return;}
      const dialog=document.createElement('dialog');dialog.className='qx-formula-dialog';dialog.dataset.qxUi='';
      const title=document.createElement('h3');title.textContent='填写公式';
      const kind=document.createElement('select');kind.setAttribute('aria-label','公式类型');
      templates.forEach((t,i)=>{const op=document.createElement('option');op.value=i;op.textContent=t.name;kind.append(op);});
      const la=document.createElement('label'),lb=document.createElement('label'),a=document.createElement('input'),b=document.createElement('input');a.type=b.type='text';a.maxLength=b.maxLength=200;
      const live=document.createElement('div');live.className='qx-math-preview';
      const textA=document.createElement('span'),textB=document.createElement('span');la.append(textA,a);lb.append(textB,b);
      const refresh=()=>{const t=templates[Number(kind.value)];textA.textContent=t.a;textB.textContent=t.b||'';lb.hidden=!t.b;renderMath('$'+t.make(a.value||'a',b.value||'b')+'$',live);};
      kind.onchange=refresh;a.oninput=b.oninput=refresh;
      dialog.append(title,kind,la,lb,live,button('插入',()=>{const t=templates[Number(kind.value)];if(!a.value.trim()||(t.b&&!b.value.trim())){a.focus();return;}insert('$'+t.make(a.value,b.value)+'$');dialog.close();}),button('取消',()=>dialog.close()));
      dialog.addEventListener('close',()=>{dialog.remove();input.focus();});document.body.append(dialog);refresh();dialog.showModal();a.focus();
    }),detail);
    const photo=document.createElement('input');photo.type='file';photo.accept='image/jpeg,image/png,image/webp';photo.hidden=true;
    // No capture attribute: mobile users can choose either camera or photo library.
    const note=document.createElement('span');note.className='qx-photo-note';note.setAttribute('role','status');
    const upload=button('拍照 / 上传手写',()=>photo.click());
    photo.onchange=async()=>{const file=photo.files?.[0];if(!file)return;upload.disabled=true;note.textContent='正在保存图片…';try{await api.uploadPhoto(file,api.fieldKey(input));note.textContent='手写图片已保存';await photos();}catch(e){note.textContent=e.message||'上传失败，请重试';}finally{upload.disabled=false;photo.value='';}};
    const gallery=document.createElement('div');gallery.className='qx-photo-list';
    async function photos(){
      gallery.replaceChildren();
      api.photos(api.fieldKey(input)).forEach(item=>{
        const view=button((item.stage==='correction'?'订正图：':'首答图：')+item.name,async()=>{
          try{const url=await api.photoURL(item.path);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='打开手写图片（链接5分钟内有效）';view.replaceWith(a);a.click();}catch{note.textContent='图片暂不可读，请登录或重试。';}
        });gallery.append(view);
      });
    }
    toolbar.append(upload,photo,note,gallery,preview);input.after(toolbar);update();photos();window.addEventListener('qx-answers-restored',photos);
  }
  document.querySelectorAll('textarea').forEach(enhance);
})();
