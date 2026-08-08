import { requireAdminApi } from "@/lib/admin-guard";
import { ensureSchema } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings, updateSettings } from "@/lib/settings";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();
  return Response.json({ settings: await getSettings() });
}

export async function PATCH(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();

  const body = (await request.json()) as {
    chatId?: string | null;
    topicId?: number | null;
    timezone?: string;
    digestEnabled?: boolean;
    standupEnabled?: boolean;
    remindersEnabled?: boolean;
  };

  const settings = await updateSettings({
    chatId: body.chatId,
    topicId: body.topicId,
    timezone: body.timezone,
    digestEnabled: body.digestEnabled,
    standupEnabled: body.standupEnabled,
    remindersEnabled: body.remindersEnabled,
  });

  return Response.json({ settings });
}

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = (await request.json()) as { action?: string };
  if (body.action !== "setWebhook") {
    return Response.json({ ok: false }, { status: 400 });
  }

  const appUrl = env.appUrl();
  if (!appUrl) {
    return Response.json(
      { ok: false, error: "NEXT_PUBLIC_APP_URL is missing" },
      { status: 400 },
    );
  }

  const token = env.telegramBotToken();
  const secret = env.telegramWebhookSecret();
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  const payload: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  };
  if (secret) payload.secret_token = secret;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const result = (await response.json()) as {
      ok?: boolean;
      description?: string;
      error_code?: number;
    };

    if (!result.ok) {
      return Response.json(
        {
          ok: false,
          error: result.description || "Telegram rejected the webhook",
          result,
          webhookUrl,
        },
        { status: 400 },
      );
    }

    return Response.json({ ok: true, result, webhookUrl });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Webhook request failed",
        webhookUrl,
      },
      { status: 500 },
    );
  }
}
