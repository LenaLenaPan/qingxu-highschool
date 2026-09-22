/* Shared answer drafts. Uses the existing authenticated Supabase client. */
(() => {
  'use strict';
  if (window.QXAnswers) return;
  const STEM = /^\/(math|physics|chemistry)\//.test(location.pathname);
  const DOC = location.pathname.replace(/\/$/, '/index.html');
  const REV = window.ROUND2_CONFIG?.revision || document.documentElement.dataset.answerVersion || 'answers-v1';
  const TABLE = 'learning_answer_attempts', BUCKET = 'learning-answer-photos';
  const clone = x => JSON.parse(JSON.stringify(x));
  const uuid = () => crypto.randomUUID();
  let client, uid, record = null, blocked = true, busy = false, applying = false, dirty = false, generation = 0, timer;
  let cacheOK = true;
  let attachments = [], genericSubmitted = false, panel, status, started = false, authGeneration = 0;
  const correction = el => !!(el.dataset.correction || /(?:fix|correction|score|redo)/i.test([el.id, el.name, el.className].join(' ')) || el.closest('.correction,.redo'));
  const containers = () => [...document.querySelectorAll('[data-question], .question, .q, article[id^="q"], .notes, .redo, section')].filter(el =>
    el.matches('[data-question], .question, .q, article[id^="q"], .notes, .redo') || /^第\s*\d+\s*题/.test(el.querySelector('h2,h3')?.textContent?.trim() || '')
  ).filter(el => !el.parentElement.closest('[data-question], .question, .q, article[id^="q"]'));
  function fields() {
    const all = [];
    containers().forEach((box, i) => {
      box.querySelectorAll('textarea,input[type="text"],input[type="number"],input[type="radio"],input[type="checkbox"],select').forEach((el, j) => {
        if (el.closest('[data-qx-ui]') || el.matches('[data-export]')) return;
        const key = el.dataset.qxKey || el.dataset.original || el.dataset.correction || el.dataset.save || el.id || (el.name ? el.name + ':' + el.value : `question-${i + 1}-field-${j + 1}`);
        el.dataset.qxKey = key; all.push(el);
      });
    });
    return all;
  }
  const generic = {
    read() {
      const answers = {}, corrections = {};
      fields().forEach(el => (correction(el) ? corrections : answers)[el.dataset.qxKey] = /^(checkbox|radio)$/.test(el.type) ? el.checked : el.value);
      return {draft: {fields: answers, title: document.title, timerText: document.querySelector('#timer')?.textContent || '', hints: [...document.querySelectorAll('details[open]')].filter(el => !el.closest('[data-qx-ui]')).map(el => el.querySelector('summary')?.textContent || '')}, corrections, submitted: genericSubmitted};
    },
    apply(data) {
      genericSubmitted = !!data.submitted;
      if (genericSubmitted) document.body.classList.add('submitted');
      fields().forEach(el => {
        const value = (correction(el) ? data.corrections : data.draft.fields)?.[el.dataset.qxKey];
        if (value !== undefined) {
          if (/^(checkbox|radio)$/.test(el.type)) el.checked = !!value; else el.value = value;
          el.dispatchEvent(new Event('input', {bubbles: true}));
          el.dispatchEvent(new Event('change', {bubbles: true}));
        }
        if (genericSubmitted && !correction(el)) el.disabled = true;
      });
    },
    lock() {genericSubmitted = true; document.body.classList.add('submitted'); fields().filter(el => !correction(el)).forEach(el => el.disabled = true);}
  };
  const adapter = () => window.QXAnswerAdapter || generic;
  function payload() { const data = adapter().read(); return {...clone(data), attachments: clone(attachments)}; }
  function hasAnswers(data) {
    const source = data.draft?.answers || data.draft?.fields || {};
    const elements = data.draft?.fields ? new Map(fields().map(el => [el.dataset.qxKey, el])) : new Map();
    return Object.entries(source).concat(Object.entries(data.corrections || {})).some(([key, v]) => {
      const el = elements.get(key);
      if (el?.tagName === 'SELECT' && v === el.options[0]?.value) return false;
      return v !== false && v !== null && v !== undefined && String(v).trim() !== '';
    }) || !!data.attachments?.length;
  }
  const cacheKey = () => `qx-answers-v1:${uid || 'local'}:${DOC}:${REV}`;
  function cache() {
    try {localStorage.setItem(cacheKey(), JSON.stringify({id: record?.id, version: record?.version, data: payload(), dirty, savedAt: new Date().toISOString()})); cacheOK = true; return true;}
    catch {cacheOK = false; say('本机缓存已满或不可用，请保持页面打开并检查云端保存状态。'); return false;}
  }
  function say(message) {if (status) status.textContent = message;}
  function button(text, run) {const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = run; return b;}
  function actions(list = []) {panel.querySelector('[data-actions]').replaceChildren(...list);}
  function apply(data) {
    applying = true;
    try { attachments = clone(data.attachments || []); adapter().apply(data); }
    finally {applying = false;}
    window.dispatchEvent(new Event('qx-answers-restored'));
  }
  function rowData(row) {
    // The server-stamped first answer wins over any later draft edit.
    let draft = clone(row.draft);
    if (row.phase === 'submitted' && row.first_submission) {
      const first = row.first_submission.draft;
      if (draft.fields) draft.fields = clone(first.fields || {});
      if (draft.answers) draft.answers = clone(first.answers || {});
      if (draft.uncertain) draft.uncertain = clone(first.uncertain || {});
      for (const key of ['elapsed', 'lookup', 'student', 'submittedAt']) if (key in first) draft[key] = first[key];
    }
    return {draft, corrections: row.corrections, attachments: row.attachments, submitted: row.phase === 'submitted'};
  }
  async function load() {
    if (!client || !uid) return;
    const user = uid, epoch = authGeneration, changes = generation;
    blocked = true; say('正在读取云端作答…');
    try {
      const {data, error} = await client.from(TABLE).select('*').eq('user_id', user).eq('document_id', DOC).eq('document_version', REV).order('created_at', {ascending: false}).limit(1).maybeSingle();
      if (error) throw error;
      if (user !== uid || epoch !== authGeneration) return;
      let saved; try {saved = JSON.parse(localStorage.getItem(cacheKey()) || 'null');} catch {}
      if (saved?.fresh) {
        record = null; attachments = []; dirty = false; blocked = false;
        localStorage.removeItem(cacheKey()); actions(); say('新的一次作答，开始填写后自动保存'); return;
      }
      if (saved?.dirty && (!data || (saved.id === data.id && saved.version === data.version))) {
        record = data || (saved.id ? {id: saved.id, version: null, phase: 'draft'} : null);
        if (changes === generation) apply(saved.data);
        dirty = true; blocked = false; actions(); await flush(); return;
      }
      if (data && (!hasAnswers(payload()) || (saved?.id === data.id && saved.version === data.version && !saved.dirty)) && changes === generation) {
        record = data; apply(rowData(data)); dirty = false; blocked = false; cache(); actions(); say('已恢复云端作答 · ' + new Date(data.updated_at).toLocaleString()); return;
      }
      if (data || hasAnswers(payload()) || saved?.dirty || changes !== generation) {
        say(data ? '发现云端记录。请选择恢复云端，或把本机内容另存为一次作答。' : '发现本机作答，点击确认后保存到当前账号。');
        actions([
          ...(data ? [button('恢复云端作答', () => {record = data; apply(rowData(data)); dirty = false; blocked = false; cache(); actions(); say('已恢复云端作答');})] : []),
          button(data ? '本机内容另存一次' : '保存本机现有作答', () => {record = null; attachments = []; blocked = false; dirty = true; generation++; actions(); flush();})
        ]); return;
      }
      record = null; blocked = false; dirty = false; actions(); say('已连接账号，开始作答后自动保存');
    } catch { if (user === uid && epoch === authGeneration) {say('云端读取失败，本机作答仍保留。联网后点“重试同步”。'); actions([button('重试同步', load)]);} }
  }
  async function flush() {
    clearTimeout(timer);
    if (!dirty || busy || blocked || !uid || !client) return false;
    const user = uid, epoch = authGeneration, edit = generation, data = payload();
    busy = true; let retry = false;
    say('正在保存…');
    try {
      const body = {draft: data.draft, corrections: data.corrections || {}, attachments: data.attachments,
        phase: data.submitted || record?.phase === 'submitted' ? 'submitted' : 'draft'};
      const id = record?.id || uuid();
      if (!record) record = {id, version: null, phase: 'draft'};
      cache();
      const response = record?.version
        ? await client.from(TABLE).update(body).eq('id', id).eq('version', record.version).select('*').maybeSingle()
        : await client.from(TABLE).insert({...body, id, user_id: user, document_id: DOC, document_version: REV}).select('*').single();
      if (user !== uid || epoch !== authGeneration) return false;
      if (response.error) throw response.error;
      if (!response.data) {
        blocked = true; say('另一台设备已更新这次作答。本机内容已保留，请先核对云端记录。');
        actions([button('核对云端记录', load)]); return false;
      }
      record = response.data; dirty = generation !== edit; cache();
      say(dirty ? '有新的内容待保存…' : `已保存到云端 · ${new Date(record.updated_at).toLocaleTimeString()}`);
      retry = dirty; return true;
    } catch {
      if (user === uid && epoch === authGeneration) {dirty = true; cache(); say(cacheOK ? '尚未同步：本机已保留待上传内容，请保持此页并重试。' : '云端同步和本机缓存均失败，请勿关闭页面，联网后重试或先导出备份。'); actions([button('重试同步', load)]);}
      return false;
    } finally {busy = false; if (retry) timer = setTimeout(flush, 100);}
  }
  function changed() {
    if (applying) return;
    generation++; dirty = true; cache();
    if (!uid) say(cacheOK ? '仅保存在本机；到“学习进度”登录后可同步。' : '本机保存失败，请勿关闭页面，先导出备份。');
    else if (!blocked) {say('本机已保存，等待同步…'); clearTimeout(timer); timer = setTimeout(flush, 800);}
  }
  async function ensureRecord() {
    if (!uid || blocked) throw new Error('请先登录，并在页面上方确认或恢复云端作答。');
    if (busy) throw new Error('正在同步，请稍后再上传。');
    dirty = true; await flush();
    if (!record?.version || dirty || blocked) throw new Error('作答尚未保存成功，请重试同步后上传。');
    return record.id;
  }
  async function uploadPhoto(file, field) {
    const id = await ensureRecord(), user = uid, epoch = authGeneration;
    if (file.size > 20 * 1024 * 1024) throw new Error('图片过大，请先裁剪至20MB以内。');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片；HEIC 请先转为 JPG。');
    const bitmap = await createImageBitmap(file), scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));
    if (!blob || blob.size > 8388608) throw new Error('图片压缩失败或仍过大，请裁剪后重试。');
    if (uid !== user || epoch !== authGeneration || record?.id !== id) throw new Error('账号或作答已切换，请重新上传。');
    const path = `${user}/${id}/${uuid()}.jpg`;
    const {error} = await client.storage.from(BUCKET).upload(path, blob, {contentType: 'image/jpeg', upsert: false});
    if (error) throw new Error('图片未上传成功，请检查网络后重试。');
    if (uid !== user || epoch !== authGeneration || record?.id !== id) throw new Error('作答已切换，图片未关联到当前题目。');
    attachments.push({field, path, name: file.name, stage: payload().submitted ? 'correction' : 'first', createdAt: new Date().toISOString()});
    changed(); await flush(); window.dispatchEvent(new Event('qx-answers-restored'));
    if (dirty) throw new Error('图片已上传，题目关联尚待同步；请点页面上方“重试同步”。');
  }
  async function newAttempt() {
    if (busy || (dirty && uid && (!await flush() || dirty))) throw new Error('当前内容尚未同步，请先完成同步再重做。');
    if (blocked && uid) throw new Error('请先处理页面上方的云端记录提示。');
    try {localStorage.setItem(cacheKey() + ':archive:' + (record?.id || Date.now()), JSON.stringify(payload()));} catch {throw new Error('本机归档失败，请先下载结果。');}
    record = null; attachments = []; genericSubmitted = false; dirty = false;
    localStorage.removeItem(cacheKey());
    // A marker prevents a reload from restoring the just-archived cloud attempt.
    localStorage.setItem(cacheKey(), JSON.stringify({data: {draft: {}, corrections: {}, attachments: [], submitted: false}, dirty: true, fresh: true}));
  }
  window.QXAnswers = {flush, changed, uploadPhoto, newAttempt, fieldKey: el => (fields(), el.dataset.qxKey),
    photos: field => attachments.filter(a => a.field === field),
    async photoURL(path) {if (!client || !uid || !path.startsWith(uid + '/')) throw new Error('请登录查看图片'); const {data, error} = await client.storage.from(BUCKET).createSignedUrl(path, 300); if (error) throw error; return data.signedUrl;}};
  function initUI() {
    if (started) return;
    if (STEM) containers().forEach((box, i) => {
      if (box.querySelector('textarea,input[type="text"],input[type="radio"]')) return;
      const area = document.createElement('div'); area.className = 'qx-written';
      ['第一思路 / 关键过程', '首答 / 结论', '订正与原因'].forEach((label, j) => {
        const l = document.createElement('label'); l.textContent = label; const t = document.createElement('textarea');
        t.rows = j === 0 ? 3 : 2; t.id = `qx-question-${i + 1}-${j === 2 ? 'correction' : j}`;
        l.append(t); area.append(l);
      }); box.append(area);
    });
    if (!fields().length && !window.QXAnswerAdapter) return;
    started = true;
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/shared/answer-records.css'; document.head.append(css);
    panel = document.createElement('section'); panel.dataset.qxUi = ''; panel.className = 'qx-answer-panel';
    const heading = document.createElement('strong'); heading.textContent = '作答记录';
    status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const links = document.createElement('div'); links.dataset.actions = '';
    const login = document.createElement('a'); login.href = '/progress/'; login.textContent = '账号与同步';
    panel.append(heading, status, links, login);
    if (!window.QXAnswerAdapter) panel.append(button('提交并保留首答', async () => {
      if (genericSubmitted) {say('首答已锁定，可以继续填写订正。'); return;}
      if (!hasAnswers(payload())) {say('请先填写作答或上传手写照片。'); return;}
      if (!confirm('提交后保留首次作答，后续请在“订正”栏补充。确认提交？')) return;
      generic.lock(); changed(); await flush();
    }));
    const root = document.querySelector('main,.wrap,.container') || document.body; root.prepend(panel);
    say('仅保存在本机；登录后可同步逐题作答。');
    let local; try {local = JSON.parse(localStorage.getItem(cacheKey()) || 'null');} catch {}
    if (local && !local.fresh && !hasAnswers(payload()) && local.data?.draft) apply(local.data);
    document.addEventListener('input', event => {if (event.target.dataset.qxKey && !window.QXAnswerAdapter) changed();});
    document.addEventListener('change', event => {if (event.target.dataset.qxKey && !window.QXAnswerAdapter) changed();});
    document.addEventListener('click', event => {
      if (window.QXAnswerAdapter || !event.target.closest('#finishBtn,#submitObjectiveBtn,#finalizeBtn,#submit')) return;
      setTimeout(() => {
        if (fields().some(el => !correction(el) && (el.disabled || el.readOnly))) {generic.lock(); changed();}
      }, 0);
    });
    window.addEventListener('qx-answer-change', changed);
    window.addEventListener('online', () => {if (uid && dirty) load();});
    window.addEventListener('pagehide', () => {if (dirty) cache();});
    if (STEM) {const s = document.createElement('script'); s.src = '/shared/science-input.js'; document.body.append(s);}
    if (window.QXSupabase) connect();
  }
  async function connect() {
    if (!started || client || !window.QXSupabase) return;
    client = window.QXSupabase;
    let session;
    try {const result = await client.auth.getSession(); if (result.error) throw result.error; session = result.data.session;}
    catch {client = null; say('账号连接暂不可用，本机作答仍可继续。'); actions([button('重试账号连接', connect)]); return;}
    uid = session?.user?.is_anonymous ? null : session?.user?.id;
    client.auth.onAuthStateChange((_event, session) => {
      const next = session?.user?.is_anonymous ? null : session?.user?.id;
      if (next === uid) return;
      authGeneration++; uid = next; blocked = true; record = null; attachments = [];
      // Avoid copying an earlier account's DOM state into another account.
      say('账号已切换，请刷新页面后确认要恢复的作答。'); actions([button('刷新页面', () => location.reload())]);
    });
    if (uid) await load();
  }
  window.addEventListener('qx-supabase-ready', connect);
  initUI();
  if (!started) {const observer = new MutationObserver(() => {initUI(); if (started) observer.disconnect();}); observer.observe(document.body, {childList: true, subtree: true}); setTimeout(() => observer.disconnect(), 15000);}
})();
