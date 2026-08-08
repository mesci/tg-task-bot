import { getBot } from "@/bot";
import { postToBoard } from "@/bot/board";
import { verifyCronRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { mention, taskRef } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { listCompletedSince, listOpenTasks } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  await ensureSchema();
  const settings = await getSettings();
  if (!settings.digestEnabled || !settings.chatId) {
    return Response.json({ ok: true, skipped: true });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const completed = await listCompletedSince(since);
  const open = await listOpenTasks();
  const blocked = open.filter((task) => task.status === "blocked");
  const doing = open.filter((task) => task.status === "doing");

  const lines = [
    "📊 <b>Weekly digest</b>",
    "",
    `✅ <b>Done this week</b> · ${completed.length}`,
    ...completed
      .slice(0, 12)
      .map((task) => `• ${taskRef(task.id)} ${task.title}`),
    "",
    `🔵 <b>In motion</b> · ${doing.length}`,
    ...doing.slice(0, 10).map(
      (task) =>
        `• ${taskRef(task.id)} ${task.title}${task.assignee ? ` — ${mention(task.assignee)}` : ""}`,
    ),
    "",
    `🔴 <b>Blocked</b> · ${blocked.length}`,
    ...blocked.slice(0, 10).map(
      (task) =>
        `• ${taskRef(task.id)} ${task.title}${task.blockedReason ? ` — ${task.blockedReason}` : ""}`,
    ),
    "",
    `📌 Open total: ${open.length}`,
  ];

  const bot = getBot();
  try {
    await postToBoard(bot.api, lines.join("\n"));
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    completed: completed.length,
    open: open.length,
    blocked: blocked.length,
  });
}
