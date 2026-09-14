import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config } from "@netlify/functions";

type TaskProgress = {
  done?: string[];
  bucket?: "today" | "week" | "later" | "done";
  updatedAt?: string;
};

type ProgressState = {
  version: 1;
  tasks: Record<string, TaskProgress>;
  updatedAt: string | null;
};

const emptyState = (): ProgressState => ({ version: 1, tasks: {}, updatedAt: null });
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (req: Request) => {
  const user = await getUser();
  if (!user) return json({ error: "请先登录后再同步进度。" }, 401);

  const store = getStore({ name: "qingxu-progress", consistency: "strong" });
  const key = `users/${user.id}.json`;

  if (req.method === "GET") {
    const state = (await store.get(key, { type: "json" })) as ProgressState | null;
    return json(state || emptyState());
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const length = Number(req.headers.get("content-length") || 0);
  if (length > 16_384) return json({ error: "提交内容过大。" }, 413);

  let body: { taskId?: unknown; done?: unknown; bucket?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "进度数据格式错误。" }, 400);
  }

  if (typeof body.taskId !== "string" || !/^[a-z0-9-]{2,80}$/.test(body.taskId)) {
    return json({ error: "任务编号无效。" }, 400);
  }
  if (!Array.isArray(body.done) || body.done.length > 10 || body.done.some(x => typeof x !== "string" || !/^[a-z0-9-]{1,32}$/.test(x))) {
    return json({ error: "完成步骤无效。" }, 400);
  }
  const buckets = ["today", "week", "later", "done"];
  if (typeof body.bucket !== "string" || !buckets.includes(body.bucket)) {
    return json({ error: "进度安排无效。" }, 400);
  }

  const current = ((await store.get(key, { type: "json" })) as ProgressState | null) || emptyState();
  const now = new Date().toISOString();
  current.tasks[body.taskId] = {
    done: [...new Set(body.done as string[])],
    bucket: body.bucket as TaskProgress["bucket"],
    updatedAt: now
  };
  current.updatedAt = now;
  await store.setJSON(key, current);
  return json(current);
};

export const config: Config = {
  path: "/api/progress",
  method: ["GET", "POST"]
};
