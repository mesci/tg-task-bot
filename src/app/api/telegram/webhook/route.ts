import { webhookCallback } from "grammy";
import { getBot } from "@/bot";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = env.telegramWebhookSecret();
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const bot = getBot();
  const handle = webhookCallback(bot, "std/http");
  return handle(request);
}
