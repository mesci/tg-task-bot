import { getBot } from "@/bot";
import { verifyCronRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
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
    if (task.assignees.length === 0 || !task.dueAt) continue;

    const text = `⏰ <b>Reminder</b>\n${taskRef(task.id)} ${task.title}\n📅 Due ${formatDue(task.dueAt, settings.timezone)}`;
    let anySent = false;
    for (const member of task.assignees) {
      try {
        await bot.api.sendMessage(member.telegramId, text, {
          parse_mode: "HTML",
        });
        anySent = true;
        sent += 1;
      } catch {}
    }
    if (anySent) {
      await updateTask(task.id, { reminderSentAt: new Date() });
    }
  }

  return Response.json({ ok: true, sent });
}
