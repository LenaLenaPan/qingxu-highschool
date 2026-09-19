import { createClient, type User } from "@supabase/supabase-js";
const supabase = createClient("https://qtzowtlqudotkomzrntg.supabase.co", "sb_publishable_JE3kOu7BsjnEyq_D9Xo00A_HeXNjugT", {
  auth: { storageKey: "qingxu-supabase-auth-v1", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(15000) }) }
});

type Bucket = "today" | "week" | "later" | "done";
type Step = { id: string; label: string };
type Task = {
  id: string;
  subject: string;
  title: string;
  description: string;
  url?: string;
  contentState: "ready" | "preparing";
  defaultBucket: Bucket;
  steps: Step[];
  defaultDone?: string[];
  legacyCompleteId?: string;
};
type Plan = { subjects: Record<string, string>; tasks: Task[] };
type TaskProgress = { done: string[]; bucket: Bucket; updatedAt?: string; completedAt?: string | null; revision?: number };
type Progress = { version: 1; tasks: Record<string, TaskProgress>; updatedAt: string | null };

const CACHE_KEY = "qingxu-cloud-progress-cache-v1";
const BUCKET_LABELS: Record<Bucket, string> = {
  today: "今天",
  week: "本周",
  later: "后续",
  done: "已完成"
};
let plan: Plan = { subjects: {}, tasks: [] };
let progress: Progress = { version: 1, tasks: {}, updatedAt: null };
let currentUser: User | null = null;
let busy = false, cloudReady = false;
let syncLabel = "登录后在手机与电脑间同步";

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T | null;
const $$ = <T extends Element = HTMLElement>(selector: string) => [...document.querySelectorAll(selector)] as T[];
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char] || char));

const readCache = (): Progress | null => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
};
// Cache is scoped to the signed-in user; the legacy cache remains untouched for explicit import.
const saveCache = () => {
  if (currentUser) try { localStorage.setItem(CACHE_KEY + ":" + currentUser.id, JSON.stringify(progress)); } catch {}
};
const taskState = (task: Task): TaskProgress => {
  const saved = progress.tasks[task.id];
  return {
    done: saved?.done || task.defaultDone || [],
    bucket: saved?.bucket || task.defaultBucket,
    updatedAt: saved?.updatedAt,
    completedAt: saved?.completedAt,
    revision: saved?.revision
  };
};
const taskStatus = (task: Task, state = taskState(task)) => {
  const completed = task.steps.filter(step => state.done.includes(step.id)).length;
  if (completed === task.steps.length && task.steps.length) return { label: "已完成", key: "done", completed };
  if (!completed) return { label: "未开始", key: "not-started", completed };
  const next = task.steps.find(step => !state.done.includes(step.id));
  if (next?.id === "correction") return { label: "待订正", key: "correction", completed };
  if (next?.id === "retest") return { label: "待复测", key: "retest", completed };
  return { label: "进行中", key: "active", completed };
};

async function loadPlan() {
  const response = await fetch("/data/learning-plan.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("学习计划读取失败");
  plan = await response.json();

}

type CloudRow = { task_id: string; done: string[]; bucket: Bucket; updated_at: string; completed_at: string | null; version: number };
function applyRow(row: CloudRow) {
  progress.tasks[row.task_id] = { done: row.done, bucket: row.bucket, updatedAt: row.updated_at, completedAt: row.completed_at, revision: row.version };
  progress.updatedAt = row.updated_at;
}
async function loadCloud() {
  if (!currentUser) return;
  const uid = currentUser.id;
  const { data, error } = await supabase.from("learning_progress").select("task_id,done,bucket,updated_at,completed_at,version").eq("user_id", uid);
  if (currentUser?.id !== uid) return;
  if (error) throw new Error("云端读取失败，请检查网络后点击“读取云端”。");
  progress = { version: 1, tasks: {}, updatedAt: null };
  for (const row of data as CloudRow[]) applyRow(row);
  cloudReady = true;
  syncLabel = "已同步 · " + new Date().toLocaleTimeString();
  saveCache();
}
async function writeTask(task: Task, state: TaskProgress) {
  if (!currentUser || !cloudReady) throw new Error("请先登录并读取云端进度。");
  const uid = currentUser.id, old = progress.tasks[task.id];
  const body = { done: state.done, bucket: state.bucket };
  const table = supabase.from("learning_progress");
  const query = old
    ? table.update(body).eq("user_id", uid).eq("task_id", task.id).eq("version", old.revision!)
    : table.insert({ ...body, user_id: uid, task_id: task.id });
  const { data, error } = await query.select("task_id,done,bucket,updated_at,completed_at,version");
  if (currentUser?.id !== uid) return;
  if (error || data?.length !== 1) {
    cloudReady = false;
    syncLabel = "未确认同步";
    throw new Error(error?.code === "23505" || (!error && !data?.length)
      ? "另一台设备已更新这项。请先读取云端，再重新修改。"
      : "未确认保存成功，请先读取云端核对，再决定是否重试。");
  }
  applyRow(data[0] as CloudRow);
  saveCache();
}
async function saveTask(task: Task, state: TaskProgress) {
  if (busy) return;
  busy = true; syncLabel = "正在保存…"; renderAll();
  try {
    await writeTask(task, state);
    syncLabel = "已同步 · " + new Date().toLocaleTimeString();
    setMessage("进度已保存。其他设备切回本页或点击“读取云端”即可更新。");
  } finally { busy = false; renderAll(); }
}

function legacyUpdates() {
  const updates: Array<{ task: Task; state: TaskProgress }> = [];
  let shared: { completed?: Record<string, boolean> } = {};
  try { shared = JSON.parse(localStorage.getItem("qingxu-learning-v1") || "{}"); } catch {}
  for (const task of plan.tasks) {
    const current = progress.tasks[task.id];
    if (current) continue;
    const done = new Set(task.defaultDone || []);
    if (task.legacyCompleteId && shared.completed?.[task.legacyCompleteId]) task.steps.forEach(step => done.add(step.id));
    if (task.id === "math-chapter2-diagnostic") {
      try { if (JSON.parse(localStorage.getItem("qingxu-math-ch2-diagnostic-v1") || "{}").submitted) done.add("attempt"); } catch {}
    }
    if (task.id === "chemistry-special-1") {
      try { if (JSON.parse(localStorage.getItem("qingxu-chem-special-1-v1") || "{}").locked) done.add("attempt"); } catch {}
    }
    if (done.size) updates.push({ task, state: { done: [...done], bucket: done.size === task.steps.length ? "done" : task.defaultBucket } });
  }
  return updates;
}

async function importLegacyProgress() {
  // Explicit user action: only seed tasks missing in Supabase. Never overwrite newer cloud rows.
  await loadCloud();
  const cached = readCache();
  let oldCloud: Progress | null = null;
  try {
    const response = await fetch("/api/progress", { signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (response.ok) oldCloud = await response.json();
  } catch {}
  const candidates = new Map(legacyUpdates().map(item => [item.task.id, item.state]));
  for (const source of [cached, oldCloud]) {
    if (!source?.tasks) continue;
    for (const task of plan.tasks) {
      const saved = source.tasks[task.id];
      if (!saved || !Array.isArray(saved.done)) continue;
      const done = [...new Set(saved.done.filter(id => task.steps.some(step => step.id === id)))];
      const bucket = done.length === task.steps.length ? "done" : ["today", "week", "later"].includes(saved.bucket) ? saved.bucket : task.defaultBucket === "done" ? "week" : task.defaultBucket;
      candidates.set(task.id, { done, bucket: bucket as Bucket });
    }
  }
  let count = 0;
  for (const task of plan.tasks) {
    if (progress.tasks[task.id] || !candidates.has(task.id)) continue;
    await writeTask(task, candidates.get(task.id)!); count++;
  }
  setMessage("已导入 " + count + " 项旧记录；云端已有记录保持不变。旧设备的记录需在那台设备上导入。");
}

function setMessage(text: string, type: "info" | "error" = "info") {
  const node = $("[data-qx-auth-message]");
  if (!node) return;
  node.textContent = text;
  node.setAttribute("data-type", type);
}

function renderAuth() {
  $("[data-qx-login-form]")?.toggleAttribute("hidden", !!currentUser);
  $("[data-qx-account-panel]")?.toggleAttribute("hidden", !currentUser);
  const email = $("[data-qx-user-email]");
  if (email) email.textContent = currentUser?.email || "";
  const state = $("[data-qx-sync-state]");
  if (state) state.textContent = syncLabel;
  $$<HTMLButtonElement | HTMLInputElement>(".qx-auth button, .qx-auth input").forEach(node => node.disabled = busy);
}
function taskCard(task: Task, compact = false) {
  const state = taskState(task);
  const status = taskStatus(task, state);
  const disabled = !currentUser || !cloudReady || busy || task.contentState === "preparing";
  const link = task.contentState === "ready" && task.url
    ? `<a class="qx-task-link" href="${escapeHtml(task.url)}">打开内容</a>`
    : `<span class="qx-preparing">内容整理中</span>`;
  if (compact) {
    return `<article class="qx-task qx-task-compact" data-status="${status.key}">
      <span class="qx-subject">${escapeHtml(plan.subjects[task.subject])}</span>
      <div><h3>${escapeHtml(task.title)}</h3><small>${escapeHtml(status.label)} · ${status.completed}/${task.steps.length} 步</small></div>
      ${link}
    </article>`;
  }
  const steps = task.steps.map(step => `<label class="qx-step">
    <input type="checkbox" data-task-id="${task.id}" data-step-id="${step.id}" ${state.done.includes(step.id) ? "checked" : ""} ${disabled ? "disabled" : ""}>
    <span>${escapeHtml(step.label)}</span>
  </label>`).join("");
  return `<article class="qx-task" data-status="${status.key}">
    <div class="qx-task-head"><span class="qx-subject qx-subject-${task.subject}">${escapeHtml(plan.subjects[task.subject])}</span><span class="qx-status-badge">${status.label}</span></div>
    <h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.description)}</p>
    <div class="qx-steps">${steps}</div>${state.completedAt ? `<small>完成时间：${escapeHtml(new Date(state.completedAt).toLocaleString())}</small>` : ""}
    <div class="qx-task-foot">${link}<label>安排到 <select data-bucket-task="${task.id}" ${disabled ? "disabled" : ""}>${(["today", "week", "later", ...(status.key === "done" ? ["done"] : [])] as Bucket[]).map(bucket => `<option value="${bucket}" ${state.bucket === bucket ? "selected" : ""}>${BUCKET_LABELS[bucket]}</option>`).join("")}</select></label></div>
  </article>`;
}

function renderDashboard() {
  const dash = $("[data-qx-dashboard]");
  if (!dash) return;
  const tasks = plan.tasks.filter(task => taskState(task).bucket === "today").slice(0, 3);
  const finished = tasks.filter(task => taskStatus(task).key === "done").length;
  const date = $("[data-qx-date]");
  if (date) date.textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
  const count = $("[data-qx-count]");
  if (count) count.textContent = `${finished}/${tasks.length}`;
  const ring = $("[data-qx-ring]") as HTMLElement | null;
  if (ring) ring.style.setProperty("--progress", `${tasks.length ? finished / tasks.length * 360 : 0}deg`);
  const container = $("[data-qx-tasks]");
  if (container) container.innerHTML = tasks.length ? tasks.map(task => taskCard(task, true)).join("") : '<p class="qx-empty">今天没有安排任务。</p>';
  const streak = $("[data-qx-streak]");
  if (streak) streak.textContent = String(plan.tasks.filter(task => taskStatus(task).key === "done").length);
}

function renderProgressPage() {
  const root = $("[data-qx-progress-app]");
  if (!root) return;
  const summary = $("[data-qx-progress-summary]");
  const complete = plan.tasks.filter(task => taskStatus(task).key === "done").length;
  if (summary) summary.innerHTML = `<strong>${complete}</strong><span>已完成</span><strong>${plan.tasks.length - complete}</strong><span>待推进</span>`;
  for (const bucket of ["today", "week", "later", "done"] as Bucket[]) {
    const container = $(`[data-qx-bucket="${bucket}"]`);
    if (!container) continue;
    const tasks = plan.tasks.filter(task => taskState(task).bucket === bucket);
    container.innerHTML = tasks.length ? tasks.map(task => taskCard(task)).join("") : '<p class="qx-empty">暂无任务</p>';
  }
  $$<HTMLInputElement>("[data-task-id]").forEach(input => input.addEventListener("change", async () => {
    const task = plan.tasks.find(item => item.id === input.dataset.taskId);
    if (!task) return;
    const state = taskState(task);
    const done = new Set(state.done);
    if (input.checked) done.add(input.dataset.stepId!); else done.delete(input.dataset.stepId!);
    const bucket = done.size === task.steps.length ? "done" : state.bucket === "done" ? "week" : state.bucket;
    try { await saveTask(task, { done: [...done], bucket }); } catch (error) { setMessage((error as Error).message, "error"); }
  }));
  $$<HTMLSelectElement>("[data-bucket-task]").forEach(select => select.addEventListener("change", async () => {
    const task = plan.tasks.find(item => item.id === select.dataset.bucketTask);
    if (!task) return;
    const state = taskState(task);
    try { await saveTask(task, { done: state.done, bucket: taskStatus(task).key === "done" ? "done" : select.value as Bucket }); } catch (error) { setMessage((error as Error).message, "error"); }
  }));
}

function renderAll() {
  renderAuth();
  renderDashboard();
  renderProgressPage();
  window.dispatchEvent(new CustomEvent("qx-progress-summary", { detail: {
    signedIn: !!currentUser,
    ready: cloudReady,
    completed: plan.tasks.filter(task => taskStatus(task).key === "done").length,
    total: plan.tasks.length,
    label: syncLabel
  } }));
}

async function refreshCloud() {
  if (busy || !currentUser) return;
  busy = true; syncLabel = "正在读取…"; renderAll();
  try { await loadCloud(); setMessage("已读取云端最新进度。"); }
  catch (error) { cloudReady = false; syncLabel = "同步失败"; setMessage((error as Error).message, "error"); }
  finally { busy = false; renderAll(); }
}
async function setupAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) setMessage("登录已失效，请重新登录。", "error");
  currentUser = data.session?.user || null;
  if (!currentUser && !error) setMessage("使用测试时的同一账号登录；旧记录可在登录后手动导入。");
  renderAll();
  if (currentUser) await refreshCloud();
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user || null;
    if (next?.id === currentUser?.id) return;
    currentUser = next; cloudReady = false;
    progress = { version: 1, tasks: {}, updatedAt: null };
    syncLabel = next ? "等待同步" : "请登录后同步";
    renderAll();
    // Do not call async Auth APIs while inside the Auth callback's lock.
    setTimeout(() => { void refreshCloud(); }, 0);
  });
}
function bindAuthForms() {
  $("[data-qx-login-form]")?.addEventListener("submit", async event => {
    event.preventDefault(); if (busy) return;
    const email = ($<HTMLInputElement>("[data-qx-email]")?.value || "").trim();
    const passwordInput = $<HTMLInputElement>("[data-qx-password]");
    const password = passwordInput?.value || "";
    busy = true; renderAuth(); setMessage("正在登录…");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("登录失败，请检查邮箱、密码或网络。请使用刚才测试页的账号。");
      currentUser = data.user;
      await loadCloud();
      setMessage("已同步。若此设备有旧记录，可点击“导入旧记录”。");
    } catch (error) { setMessage((error as Error).message, "error"); }
    finally { if (passwordInput) passwordInput.value = ""; busy = false; renderAll(); }
  });
  $("[data-qx-reload]")?.addEventListener("click", () => void refreshCloud());
  $("[data-qx-import]")?.addEventListener("click", async () => {
    if (busy || !currentUser || !confirm("将本设备和仍可访问的旧云端进度导入当前账号？只补充云端尚无记录的任务。")) return;
    busy = true; renderAll();
    try { await importLegacyProgress(); syncLabel = "导入完成"; }
    catch (error) { setMessage((error as Error).message, "error"); }
    finally { busy = false; renderAll(); }
  });
  $("[data-qx-logout]")?.addEventListener("click", async () => {
    if (busy) return;
    busy = true; renderAuth();
    const uid = currentUser?.id;
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw new Error("退出失败，请检查网络后重试。");
      if (uid) try { localStorage.removeItem(CACHE_KEY + ":" + uid); } catch {}
      currentUser = null; cloudReady = false;
      progress = { version: 1, tasks: {}, updatedAt: null };
      syncLabel = "已退出"; setMessage("已退出此设备，其他设备不受影响。");
    } catch (error) { setMessage((error as Error).message, "error"); }
    finally { busy = false; renderAll(); }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void refreshCloud(); });
  window.addEventListener("online", () => void refreshCloud());
  window.addEventListener("offline", () => { cloudReady = false; syncLabel = "离线 · 暂停修改"; renderAll(); });
}
async function initializeProgress() {
  bindAuthForms();
  try { await loadPlan(); renderAll(); await setupAuth(); }
  catch { setMessage("初始化失败，请刷新页面或检查网络。", "error"); }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeProgress);
else void initializeProgress();
