import type { Bot } from "grammy";
import { gateMember, isAllowedRoom } from "@/bot/access";
import { syncBoard } from "@/bot/board";
import { formatTaskCard } from "@/bot/format";
import { createPriorityKeyboard, taskKeyboard } from "@/bot/keyboards";
import { finalizeTaskCreate } from "@/bot/handlers/callbacks";
import { clearDraft, getDraft, readPayload, setDraft } from "@/lib/drafts";
import { setFocus } from "@/lib/focus";
import { mention } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { getTask, updateTask } from "@/lib/tasks";
import { parseDueInput } from "@/lib/time";
import { postToBoard } from "@/bot/board";

export function registerConversations(bot: Bot) {
  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) {
      await next();
      return;
    }

    const draft = await getDraft(String(ctx.from.id));
    if (!draft) {
      await next();
      return;
    }

    if (!(await isAllowedRoom(ctx)) && ctx.chat.type !== "private") {
      return;
    }

    const settings = await getSettings();
    const payload = readPayload(draft);
    const text = ctx.message.text.trim();

    if (draft.step === "create_title") {
      await setDraft({
        telegramId: String(ctx.from.id),
        chatId: String(ctx.chat.id),
        topicId: ctx.message.message_thread_id ?? null,
        step: "create_description",
        payload: { title: text },
      });
      await ctx.reply("Description? Send text or `skip`.", {
        parse_mode: "Markdown",
      });
      return;
    }

    if (draft.step === "create_description") {
      const description =
        text.toLowerCase() === "skip" || text === "-" ? null : text;
      await setDraft({
        telegramId: String(ctx.from.id),
        chatId: draft.chatId,
        topicId: draft.topicId,
        step: "create_priority",
        payload: { ...payload, description },
      });
      await ctx.reply("Pick a priority.", {
        reply_markup: createPriorityKeyboard(),
      });
      return;
    }

    if (draft.step === "create_due") {
      const due = parseDueInput(text, settings.timezone);
      if (text.toLowerCase() !== "skip" && text !== "-" && due === null && text.toLowerCase() !== "none") {
        await ctx.reply("Couldn't parse that date. Try `YYYY-MM-DD` or `skip`.", {
          parse_mode: "Markdown",
        });
        return;
      }

      await setDraft({
        telegramId: String(ctx.from.id),
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

    if (draft.step === "focus") {
      const member = await gateMember(ctx);
      if (!member) {
        await clearDraft(String(ctx.from.id));
        await ctx.reply("You're not on the team yet.");
        return;
      }
      await setFocus({ memberId: member.id, note: text });
      await clearDraft(String(ctx.from.id));
      await ctx.reply(`Focus set: *${text}*`, { parse_mode: "Markdown" });
      return;
    }

    if (draft.step === "standup") {
      const member = await gateMember(ctx);
      if (!member) {
        await clearDraft(String(ctx.from.id));
        await ctx.reply("You're not on the team yet.");
        return;
      }
      await setFocus({ memberId: member.id, note: text });
      await clearDraft(String(ctx.from.id));
      const line = `*Standup*\n${mention(member)}: ${text}`;
      try {
        await postToBoard(ctx.api, line);
        await ctx.reply("Posted.");
      } catch {
        await ctx.reply(line, { parse_mode: "Markdown" });
      }
      return;
    }

    if (draft.step === "block_reason" && payload.taskId) {
      const updated = await updateTask(payload.taskId, {
        status: "blocked",
        blockedReason: text,
      });
      await clearDraft(String(ctx.from.id));
      if (updated) {
        await ctx.reply(formatTaskCard(updated, settings.timezone), {
          parse_mode: "Markdown",
          reply_markup: taskKeyboard(updated),
        });
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
        await ctx.reply("Couldn't parse that date. Try `YYYY-MM-DD` or `skip`.", {
          parse_mode: "Markdown",
        });
        return;
      }

      const updated = await updateTask(payload.taskId, {
        dueAt: due,
        reminderSentAt: null,
      });
      await clearDraft(String(ctx.from.id));
      if (updated) {
        await ctx.reply(formatTaskCard(updated, settings.timezone), {
          parse_mode: "Markdown",
          reply_markup: taskKeyboard(updated),
        });
      } else {
        const task = await getTask(payload.taskId);
        if (task) {
          await ctx.reply(formatTaskCard(task, settings.timezone), {
            parse_mode: "Markdown",
            reply_markup: taskKeyboard(task),
          });
        }
      }
      await syncBoard(ctx.api);
      return;
    }

    await next();
  });
}
