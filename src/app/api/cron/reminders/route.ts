import { getBot } from "@/bot";
import { syncBoard } from "@/bot/board";
import { verifyCronRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { findMemberById } from "@/lib/members";
import { getSettings } from "@/lib/settings";
import { listTasksNeedingReminder, updateTask } from "@/lib/tasks";
import { formatDue } from "@/lib/time";
import { taskRef } from "@/lib/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  await ensureSchema();
  const settings = await getSettings();
  if (!settings.remindersEnabled) {
    return Response.json({ ok: true, skipped: true });
  }

  const bot = getBot();
  const due = await listTasksNeedingReminder(36);
  let sent = 0;

  for (const task of due) {
    if (!task.assigneeId || !task.dueAt) continue;
    const member = await findMemberById(task.assigneeId);
    if (!member) continue;

    const text = `⏰ Reminder: ${taskRef(task.id)} *${task.title}*\n📅 Due ${formatDue(task.dueAt, settings.timezone)}`;
    try {
      await bot.api.sendMessage(member.telegramId, text, {
        parse_mode: "Markdown",
      });
      await updateTask(task.id, { reminderSentAt: new Date() });
      sent += 1;
    } catch {}
  }

  if (sent > 0 && settings.chatId) {
    await syncBoard(bot.api);
  }

  return Response.json({ ok: true, sent });
}
