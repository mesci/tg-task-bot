import { GET as runDigest } from "@/app/api/cron/digest/route";
import { GET as runReminders } from "@/app/api/cron/reminders/route";
import { GET as runStandup } from "@/app/api/cron/standup/route";
import { verifyCronRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const day = new Date().getUTCDay();
  const reminders = await runReminders(request);
  const remindersBody = await reminders.json();

  let standupBody: unknown = { skipped: true };
  if (day >= 1 && day <= 5) {
    const standup = await runStandup(request);
    standupBody = await standup.json();
  }

  let digestBody: unknown = { skipped: true };
  if (day === 5) {
    const digest = await runDigest(request);
    digestBody = await digest.json();
  }

  return Response.json({
    ok: true,
    reminders: remindersBody,
    standup: standupBody,
    digest: digestBody,
  });
}
