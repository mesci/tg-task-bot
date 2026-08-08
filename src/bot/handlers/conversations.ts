import type { Bot } from "grammy";
import { isAllowedRoom } from "@/bot/access";
import { syncBoard } from "@/bot/board";
import { clearFlow, scrubTrigger, sendFresh } from "@/bot/cleanup";
import { formatTaskCard } from "@/bot/format";
import { finalizeTaskCreate } from "@/bot/handlers/callbacks";
import { createPriorityKeyboard, taskKeyboard } from "@/bot/keyboards";
import { isMenuText } from "@/bot/menu";
import { getDraft, readPayload, setDraft } from "@/lib/drafts";
import { getSettings } from "@/lib/settings";
import { getTask, updateTask } from "@/lib/tasks";
import { parseDueInput } from "@/lib/time";

export function registerConversations(bot: Bot) {
  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) {
      await next();
      return;
    }

    if (isMenuText(ctx.message.text.trim())) {
      await next();
      return;
    }

    const draft = await getDraft(String(ctx.from.id));
    if (!draft || draft.step === "idle") {
      await next();
      return;
    }

    if (!(await isAllowedRoom(ctx)) && ctx.chat.type !== "private") {
      return;
    }

    const settings = await getSettings();
    const payload = readPayload(draft);
    const text = ctx.message.text.trim();
    const telegramId = String(ctx.from.id);

    await scrubTrigger(ctx);

    if (draft.step === "create_title") {
      await sendFresh(
        ctx,
        "📝 Description?\nSend text, or <code>skip</code>.",
        { parse_mode: "HTML" },
        "create_description",
        { title: text },
      );
      return;
    }

    if (draft.step === "create_description") {
      const description =
        text.toLowerCase() === "skip" || text === "-" ? null : text;
      await sendFresh(
        ctx,
        "⚡ Pick a priority:",
        { reply_markup: createPriorityKeyboard() },
        "create_priority",
        { ...payload, description },
      );
      return;
    }

    if (draft.step === "create_due") {
      const due = parseDueInput(text, settings.timezone);
      if (
        text.toLowerCase() !== "skip" &&
        text !== "-" &&
        due === null &&
        text.toLowerCase() !== "none"
      ) {
        await sendFresh(
          ctx,
          "❓ Couldn't parse that.\nTry <code>YYYY-MM-DD</code> or <code>skip</code>.",
          { parse_mode: "HTML" },
          "create_due",
          payload,
        );
        return;
      }

      await setDraft({
        telegramId,
        chatId: draft.chatId,
        topicId: draft.topicId,
        step: "create_due",
        payload: {
          ...payload,
          dueAt: due ? due.toISOString() : null,
        },
      });
      await finalizeTaskCreate(bot, ctx);
      return;
    }

    if (draft.step === "block_reason" && payload.taskId) {
      const updated = await updateTask(payload.taskId, {
        status: "blocked",
        blockedReason: text,
      });
      await clearFlow(ctx.api, telegramId);
      if (updated) {
        await sendFresh(
          ctx,
          formatTaskCard(updated, settings.timezone),
          {
            parse_mode: "HTML",
            reply_markup: taskKeyboard(updated),
          },
          "idle",
          {},
          true,
        );
      }
      await syncBoard(ctx.api);
      return;
    }

    if (draft.step === "edit_due" && payload.taskId) {
      const due = parseDueInput(text, settings.timezone);
      if (
        text.toLowerCase() !== "skip" &&
        text !== "-" &&
        text.toLowerCase() !== "none" &&
        due === null
      ) {
        await sendFresh(
          ctx,
          "❓ Couldn't parse that.\nTry <code>YYYY-MM-DD</code> or <code>skip</code>.",
          { parse_mode: "HTML" },
          "edit_due",
          payload,
        );
        return;
      }

      const updated = await updateTask(payload.taskId, {
        dueAt: due,
        reminderSentAt: null,
      });
      await clearFlow(ctx.api, telegramId);
      const task = updated ?? (await getTask(payload.taskId));
      if (task) {
        await sendFresh(
          ctx,
          formatTaskCard(task, settings.timezone),
          {
            parse_mode: "HTML",
            reply_markup: taskKeyboard(task),
          },
          "idle",
          {},
          true,
        );
      }
      await syncBoard(ctx.api);
      return;
    }

    await next();
  });
}
