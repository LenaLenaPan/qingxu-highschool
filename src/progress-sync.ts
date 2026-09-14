import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  updateUser
} from "@netlify/identity";

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
type TaskProgress = { done: string[]; bucket: Bucket; updatedAt?: string };
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
let currentUser: Awaited<ReturnType<typeof getUser>> = null;
let inviteToken = "";

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T | null;
const $$ = <T extends Element = HTMLElement>(selector: string) => [...document.querySelectorAll(selector)] as T[];
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char] || char));

const readCache = (): Progress | null => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
};
const saveCache = () => localStorage.setItem(CACHE_KEY, JSON.stringify(progress));
const taskState = (task: Task): TaskProgress => {
  const saved = progress.tasks[task.id];
  return {
    done: saved?.done || task.defaultDone || [],
    bucket: saved?.bucket || task.defaultBucket,
    updatedAt: saved?.updatedAt
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
  const cached = readCache();
  if (cached) progress = cached;
}

async function loadCloud() {
  if (!currentUser) return;
  const response = await fetch("/api/progress", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(response.status === 401 ? "登录已失效，请重新登录。" : "云端进度读取失败。");
  progress = await response.json();
  await migrateLegacyProgress();
  saveCache();
}

async function saveTask(task: Task, state: TaskProgress) {
  if (!currentUser) throw new Error("请先登录，再修改进度。");
  const previous = progress.tasks[task.id];
  progress.tasks[task.id] = state;
  saveCache();
  renderAll();
  const response = await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ taskId: task.id, done: state.done, bucket: state.bucket })
  });
  if (!response.ok) {
    if (previous) progress.tasks[task.id] = previous; else delete progress.tasks[task.id];
    saveCache();
    renderAll();
    throw new Error("保存失败，请检查网络后重试。");
  }
  progress = await response.json();
  saveCache();
  renderAll();
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

async function migrateLegacyProgress() {
  const updates = legacyUpdates();
  for (const item of updates) {
    const response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ taskId: item.task.id, done: item.state.done, bucket: item.state.bucket })
    });
    if (response.ok) progress = await response.json();
  }
}

function setMessage(text: string, type: "info" | "error" = "info") {
  const node = $("[data-qx-auth-message]");
  if (!node) return;
  node.textContent = text;
  node.setAttribute("data-type", type);
}

function renderAuth() {
  const loginPanel = $("[data-qx-login-panel]");
  const accountPanel = $("[data-qx-account-panel]");
  const invitePanel = $("[data-qx-invite-panel]");
  if (loginPanel) loginPanel.toggleAttribute("hidden", !!currentUser || !!inviteToken);
  if (accountPanel) accountPanel.toggleAttribute("hidden", !currentUser);
  if (invitePanel) invitePanel.toggleAttribute("hidden", !inviteToken);
  const email = $("[data-qx-user-email]");
  if (email) email.textContent = currentUser?.email || "";
  const syncState = $("[data-qx-sync-state]");
  if (syncState) syncState.textContent = currentUser ? "已连接云端进度" : "登录后在手机与电脑间同步";
}

function taskCard(task: Task, compact = false) {
  const state = taskState(task);
  const status = taskStatus(task, state);
  const disabled = !currentUser || task.contentState === "preparing";
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
    <div class="qx-steps">${steps}</div>
    <div class="qx-task-foot">${link}<label>安排到 <select data-bucket-task="${task.id}" ${!currentUser ? "disabled" : ""}>${(["today", "week", "later", "done"] as Bucket[]).map(bucket => `<option value="${bucket}" ${state.bucket === bucket ? "selected" : ""}>${BUCKET_LABELS[bucket]}</option>`).join("")}</select></label></div>
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
    try { await saveTask(task, { done: state.done, bucket: select.value as Bucket }); } catch (error) { setMessage((error as Error).message, "error"); }
  }));
}

function renderAll() {
  renderAuth();
  renderDashboard();
  renderProgressPage();
}

async function setupAuth() {
  try {
    const callback = await handleAuthCallback();
    if (callback?.type === "invite") inviteToken = callback.token || "";
    if (callback?.type === "recovery") setMessage("请输入新密码，完成密码重设。", "info");
    currentUser = callback?.user || await getUser();
  } catch (error) {
    setMessage((error as Error).message || "登录服务暂不可用。", "error");
  }
  renderAuth();
  if (currentUser) {
    try { await loadCloud(); } catch (error) { setMessage((error as Error).message, "error"); }
  }
  renderAll();
}

function bindAuthForms() {
  $("[data-qx-login-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = ($<HTMLInputElement>("[data-qx-email]")?.value || "").trim();
    const password = $<HTMLInputElement>("[data-qx-password]")?.value || "";
    setMessage("正在登录…");
    try {
      currentUser = await login(email, password);
      await loadCloud();
      setMessage("进度已从云端同步。");
      renderAll();
    } catch (error) { setMessage((error as Error).message || "登录失败。", "error"); }
  });
  $("[data-qx-invite-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const password = $<HTMLInputElement>("[data-qx-invite-password]")?.value || "";
    try {
      currentUser = await acceptInvite(inviteToken, password);
      inviteToken = "";
      await loadCloud();
      setMessage("账号已启用，进度同步完成。");
      renderAll();
    } catch (error) { setMessage((error as Error).message || "账号启用失败。", "error"); }
  });
  $("[data-qx-reset-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const password = $<HTMLInputElement>("[data-qx-reset-password]")?.value || "";
    try { await updateUser({ password }); setMessage("密码已更新。"); } catch (error) { setMessage((error as Error).message, "error"); }
  });
  $("[data-qx-logout]")?.addEventListener("click", async () => {
    await logout();
    currentUser = null;
    progress = { version: 1, tasks: {}, updatedAt: null };
    localStorage.removeItem(CACHE_KEY);
    renderAll();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try { await loadPlan(); } catch (error) { setMessage((error as Error).message, "error"); return; }
  bindAuthForms();
  renderAll();
  await setupAuth();
});
