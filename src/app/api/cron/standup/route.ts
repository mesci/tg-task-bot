import { getBot } from "@/bot";
import { postToBoard } from "@/bot/board";
import { verifyCronRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { listActiveMembers } from "@/lib/members";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  await ensureSchema();
  const settings = await getSettings();
  if (!settings.standupEnabled || !settings.chatId) {
    return Response.json({ ok: true, skipped: true });
  }

  const members = await listActiveMembers();
  const bot = getBot();
  const text = [
    "*Morning pulse*",
    "Drop today's focus with /focus or /standup.",
    "",
    ...members.map((member) => `• ${member.displayName}`),
  ].join("\n");

  try {
    await postToBoard(bot.api, text);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
