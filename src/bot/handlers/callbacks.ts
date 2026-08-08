import type { Bot, Context } from "grammy";
import { gateMember, isAllowedRoom } from "@/bot/access";
import { postToBoard, syncBoard } from "@/bot/board";
import { formatTaskCard } from "@/bot/format";
import {
  assigneeKeyboard,
  confirmDeleteKeyboard,
  createAssigneeKeyboard,
  priorityKeyboard,
  taskKeyboard,
} from "@/bot/keyboards";
import { notifyAssignee } from "@/bot/handlers/commands";
import { clearDraft, getDraft, readPayload, setDraft } from "@/lib/drafts";
import { listActiveMembers } from "@/lib/members";
import { getSettings } from "@/lib/settings";
import {
  createTask,
  deleteTask,
  getTask,
  updateTask,
} from "@/lib/tasks";
import { mention, taskRef } from "@/lib/labels";

export function registerCallbacks(bot: Bot) {
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data === "board:refresh") {
      await syncBoard(ctx.api);
      await ctx.answerCallbackQuery({ text: "🔄 Board refreshed" });
      return;
    }

    if (data === "board:new") {
      const member = await gateMember(ctx);
      if (!member) {
        await ctx.answerCallbackQuery({
          text: "🚪 Not on the team",
          show_alert: true,
        });
        return;
      }
      await setDraft({
        telegramId: String(ctx.from.id),
        chatId: String(ctx.chat?.id ?? ctx.from.id),
        topicId: ctx.callbackQuery.message?.message_thread_id ?? null,
        step: "create_title",
      });
      await ctx.answerCallbackQuery();
      await ctx.reply("🛠 What's the task title?");
      return;
    }

    if (data === "c:cancel") {
      await clearDraft(String(ctx.from.id));
      await ctx.answerCallbackQuery({ text: "❌ Cancelled" });
      await ctx.editMessageText("❌ Cancelled.");
      return;
    }

    if (data.startsWith("c:prio:")) {
      await handleCreatePriority(ctx, data.slice("c:prio:".length));
      return;
    }

    if (data.startsWith("c:assign:")) {
      await handleCreateAssign(ctx, data.slice("c:assign:".length));
      return;
    }

    if (data.startsWith("t:")) {
      await handleTaskAction(bot, ctx, data);
      return;
    }

    await ctx.answerCallbackQuery();
  });
}

async function handleCreatePriority(ctx: Context, priority: string) {
  const draft = await getDraft(String(ctx.from!.id));
  if (!draft || draft.step !== "create_priority") {
    await ctx.answerCallbackQuery({
      text: "Start with /task",
      show_alert: true,
    });
    return;
  }

  const payload = readPayload(draft);
  const valid = ["low", "normal", "high", "urgent"] as const;
  if (!valid.includes(priority as (typeof valid)[number])) {
    await ctx.answerCallbackQuery({
      text: "Invalid priority",
      show_alert: true,
    });
    return;
  }

  await setDraft({
    telegramId: String(ctx.from!.id),
    chatId: draft.chatId,
    topicId: draft.topicId,
    step: "create_assignee",
    payload: {
      ...payload,
      priority: priority as (typeof valid)[number],
    },
  });

  const members = await listActiveMembers();
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("👤 Who should own this?", {
    reply_markup: createAssigneeKeyboard(members),
  });
}

async function handleCreateAssign(ctx: Context, rawId: string) {
  const draft = await getDraft(String(ctx.from!.id));
  if (!draft || draft.step !== "create_assignee") {
    await ctx.answerCallbackQuery({
      text: "Start with /task",
      show_alert: true,
    });
    return;
  }

  const payload = readPayload(draft);
  const assigneeId = Number(rawId);
  await setDraft({
    telegramId: String(ctx.from!.id),
    chatId: draft.chatId,
    topicId: draft.topicId,
    step: "create_due",
    payload: {
      ...payload,
      assigneeId: assigneeId > 0 ? assigneeId : null,
    },
  });

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "📅 Due date?\nSend `YYYY-MM-DD`, `today`, `tomorrow`, or `skip`.",
    { parse_mode: "Markdown" },
  );
}

async function handleTaskAction(bot: Bot, ctx: Context, data: string) {
  if (!(await isAllowedRoom(ctx)) && ctx.chat?.type !== "private") {
    await ctx.answerCallbackQuery({ text: "Wrong room", show_alert: true });
    return;
  }

  const member = await gateMember(ctx);
  if (!member) {
    await ctx.answerCallbackQuery({
      text: "🚪 Not on the team",
      show_alert: true,
    });
    return;
  }

  const parts = data.split(":");
  const taskId = Number(parts[1]);
  const action = parts[2];
  const arg = parts[3];

  const task = await getTask(taskId);
  if (!task) {
    await ctx.answerCallbackQuery({ text: "Task gone", show_alert: true });
    return;
  }

  const settings = await getSettings();

  if (action === "open") {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(formatTaskCard(task, settings.timezone), {
      parse_mode: "Markdown",
      reply_markup: taskKeyboard(task),
    });
    return;
  }

  if (action === "claim") {
    const updated = await updateTask(taskId, {
      assigneeId: member.id,
      status: task.status === "todo" ? "doing" : task.status,
    });
    await ctx.answerCallbackQuery({ text: "✋ Claimed" });
    if (updated) {
      await ctx.editMessageText(formatTaskCard(updated, settings.timezone), {
        parse_mode: "Markdown",
        reply_markup: taskKeyboard(updated),
      });
    }
    await syncBoard(ctx.api);
    return;
  }

  if (action === "todo" || action === "doing" || action === "done") {
    const labels = {
      todo: "📋 Todo",
      doing: "🔵 Doing",
      done: "✅ Done",
    } as const;
    const updated = await updateTask(taskId, {
      status: action,
      blockedReason: null,
    });
    await ctx.answerCallbackQuery({ text: labels[action] });
    if (updated) {
      await ctx.editMessageText(formatTaskCard(updated, settings.timezone), {
        parse_mode: "Markdown",
        reply_markup: taskKeyboard(updated),
      });
    }
    await syncBoard(ctx.api);
    return;
  }

  if (action === "blocked") {
    await setDraft({
      telegramId: String(ctx.from!.id),
      chatId: String(ctx.chat?.id ?? ctx.from!.id),
      topicId: ctx.callbackQuery?.message?.message_thread_id ?? null,
      step: "block_reason",
      payload: { taskId },
    });
    await ctx.answerCallbackQuery();
    await ctx.reply(`🔴 Why is ${taskRef(taskId)} blocked?`);
    return;
  }

  if (action === "prio" && !arg) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({
      reply_markup: priorityKeyboard(taskId),
    });
    return;
  }

  if (action === "prio" && arg) {
    const updated = await updateTask(taskId, {
      priority: arg as "low" | "normal" | "high" | "urgent",
    });
    await ctx.answerCallbackQuery({ text: "⚡ Priority updated" });
    if (updated) {
      await ctx.editMessageText(formatTaskCard(updated, settings.timezone), {
        parse_mode: "Markdown",
        reply_markup: taskKeyboard(updated),
      });
    }
    await syncBoard(ctx.api);
    return;
  }

  if (action === "due") {
    await setDraft({
      telegramId: String(ctx.from!.id),
      chatId: String(ctx.chat?.id ?? ctx.from!.id),
      topicId: ctx.callbackQuery?.message?.message_thread_id ?? null,
      step: "edit_due",
      payload: { taskId },
    });
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📅 New due date for ${taskRef(taskId)}?\n\`YYYY-MM-DD\`, \`today\`, \`tomorrow\`, or \`skip\`.`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (action === "hand" && !arg) {
    const members = await listActiveMembers();
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({
      reply_markup: assigneeKeyboard(taskId, members, "hand"),
    });
    return;
  }

  if (action === "hand" && arg) {
    const assigneeId = Number(arg);
    const updated = await updateTask(taskId, { assigneeId });
    await ctx.answerCallbackQuery({ text: "🔁 Handed off" });
    if (updated) {
      await ctx.editMessageText(formatTaskCard(updated, settings.timezone), {
        parse_mode: "Markdown",
        reply_markup: taskKeyboard(updated),
      });
      await notifyAssignee(
        bot,
        assigneeId,
        `🔁 Handed to you: ${taskRef(taskId)} *${task.title}*\nfrom ${mention(member)}`,
      );
    }
    await syncBoard(ctx.api);
    return;
  }

  if (action === "assign" && arg) {
    const assigneeId = Number(arg);
    const updated = await updateTask(taskId, {
      assigneeId: assigneeId > 0 ? assigneeId : null,
    });
    await ctx.answerCallbackQuery({ text: "👤 Assignee updated" });
    if (updated) {
      await ctx.editMessageText(formatTaskCard(updated, settings.timezone), {
        parse_mode: "Markdown",
        reply_markup: taskKeyboard(updated),
      });
    }
    await syncBoard(ctx.api);
    return;
  }

  if (action === "delask") {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({
      reply_markup: confirmDeleteKeyboard(taskId),
    });
    return;
  }

  if (action === "del") {
    await deleteTask(taskId);
    await ctx.answerCallbackQuery({ text: "🗑 Deleted" });
    await ctx.editMessageText(`🗑 Deleted ${taskRef(taskId)}.`);
    await syncBoard(ctx.api);
    return;
  }

  await ctx.answerCallbackQuery();
}

export async function finalizeTaskCreate(bot: Bot, ctx: Context) {
  const draft = await getDraft(String(ctx.from!.id));
  if (!draft) return false;
  const payload = readPayload(draft);
  if (!payload.title) return false;

  const member = await gateMember(ctx);
  const settings = await getSettings();
  const dueAt = payload.dueAt ? new Date(payload.dueAt) : null;

  const task = await createTask({
    title: payload.title,
    description: payload.description ?? null,
    priority: payload.priority ?? "normal",
    assigneeId: payload.assigneeId ?? null,
    createdById: member?.id ?? null,
    dueAt,
  });

  await clearDraft(String(ctx.from!.id));

  const card = formatTaskCard(task, settings.timezone);
  try {
    const message = await postToBoard(ctx.api, card, taskKeyboard(task));
    await updateTask(task.id, { messageId: message.message_id });
  } catch {
    await ctx.reply(card, {
      parse_mode: "Markdown",
      reply_markup: taskKeyboard(task),
    });
  }

  await syncBoard(ctx.api);
  await notifyAssignee(
    bot,
    task.assigneeId,
    `🛠 Assigned to you: ${taskRef(task.id)} *${task.title}*`,
  );
  await ctx.reply(`✅ Created ${taskRef(task.id)}.`);
  return true;
}
