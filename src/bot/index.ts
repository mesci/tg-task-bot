import { Bot } from "grammy";
import { env } from "@/lib/env";
import { ensureSchema } from "@/lib/db";
import { registerCommands } from "@/bot/handlers/commands";
import { registerCallbacks } from "@/bot/handlers/callbacks";
import { registerConversations } from "@/bot/handlers/conversations";

declare global {
  var __taptopiaBot: Bot | undefined;
}

export function getBot(): Bot {
  if (global.__taptopiaBot) return global.__taptopiaBot;

  const bot = new Bot(env.telegramBotToken());

  bot.use(async (ctx, next) => {
    await ensureSchema();
    await next();
  });

  registerCommands(bot);
  registerCallbacks(bot);
  registerConversations(bot);

  bot.catch((err) => {
    console.error("Bot error", err);
  });

  global.__taptopiaBot = bot;
  return bot;
}
