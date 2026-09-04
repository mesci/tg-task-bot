import type { Bot, Context } from "grammy";
import { gateAdmin, gateMember } from "@/bot/access";
import {
  showBoard,
  showMine,
  showTeam,
  startCreateTask,
} from "@/bot/actions";
import { postToBoard, recreateBoard, syncBoard } from "@/bot/board";
import { formatTaskCard } from "@/bot/format";
import {
  assigneeKeyboard,
  clearDoneKeyboard,
  confirmDeleteKeyboard,
  createAssigneeKeyboard,
  priorityKeyboard,
  taskKeyboard,
} from "@/bot/keyboards";
import { clearFlow, deleteQuietly, sendFresh } from "@/bot/cleanup";
import { notifyAssignees } from "@/bot/handlers/commands";
import { getDraft, readPayload, setDraft } from "@/lib/drafts";
import { listActiveMembers } from "@/lib/members";
import { clearDoneCutoff, getSettings, updateSettings } from "@/lib/settings";
import { CLEAR_DONE_KEEP_DAYS } from "@/lib/settings";
import {
  addTaskAssignee,
  createTask,
  deleteTask,
  getTask,
  updateTask,
} from "@/lib/tasks";
import { escapeHtml, mention, taskRef } from "@/lib/labels";

export function registerCallbacks(bot: Bot) {
  bot.on("callback_query:data", async (ctx) => {
    try {
      const data = ctx.callbackQuery.data;

      if (data === "board:refresh") {
        await syncBoard(ctx.api);
        await ctx.answerCallbackQuery({ text: "🔄 Refreshed" });
        return;
      }

      if (data === "board:clearask") {
        if (!(await gateAdmin(ctx))) {
          await ctx.answerCallbackQuery({
            text: "Admins only",
            show_alert: true,
          });
          return;
        }
        await ctx.answerCallbackQuery();
        await ctx.reply(
          `🧹 Hide completed tasks older than <b>${CLEAR_DONE_KEEP_DAYS} days</b> from the done board?\nLast ${CLEAR_DONE_KEEP_DAYS} days stay visible. History & weekly digest are unchanged.`,
          { parse_mode: "HTML", reply_markup: clearDoneKeyboard() },
        );
        return;
      }

      if (data === "board:clearcancel") {
        await ctx.answerCallbackQuery({ text: "Kept" });
        if (ctx.chat && ctx.callbackQuery.message) {
          await deleteQuietly(
            ctx.api,
            ctx.chat.id,
            ctx.callbackQuery.message.message_id,
          );
        }
        return;
      }

      if (data === "board:clear") {
        if (!(await gateAdmin(ctx))) {
          await ctx.answerCallbackQuery({
            text: "Admins only",
            show_alert: true,
          });
          return;
        }
        await updateSettings({ doneClearedAt: clearDoneCutoff() });
        await recreateBoard(ctx.api);
        await ctx.answerCallbackQuery({ text: "🧹 Cleared" });
        if (ctx.chat && ctx.callbackQuery.message) {
          await deleteQuietly(
            ctx.api,
            ctx.chat.id,
            ctx.callbackQuery.message.message_id,
          );
        }
        return;
      }

      if (data === "board:new" || data === "menu:task") {
        const member = await gateMember(ctx);
        if (!member) {
          await ctx.answerCallbackQuery({
            text: "🚪 Not on the team",
            show_alert: true,
          });
          return;
        }
        await ctx.answerCallbackQuery();
        await startCreateTask(ctx);
        return;
      }

      if (data === "board:mine" || data === "menu:mine") {
        await ctx.answerCallbackQuery();
        await showMine(ctx);
        return;
      }

      if (data === "menu:board") {
        await ctx.answerCallbackQuery();
        await showBoard(ctx);
        return;
      }

      if (data === "menu:team") {
        await ctx.answerCallbackQuery();
        await showTeam(ctx);
        return;
      }

      if (data.startsWith("d:")) {
        const ownerId = data.slice(2);
        const allowed =
          String(ctx.from.id) === ownerId || (await gateAdmin(ctx));
        if (!allowed) {
          await ctx.answerCallbackQuery({
            text: "Only the author or an admin can dismiss this.",
            show_alert: true,
          });
          return;
        }

        await ctx.answerCallbackQuery({ text: "🗑 Dismissed" });
        if (ctx.chat && ctx.callbackQuery.message) {
          const messageId = ctx.callbackQuery.message.message_id;
          await deleteQuietly(ctx.api, ctx.chat.id, messageId);
          const draft = await getDraft(String(ctx.from.id));
          if (draft) {
            const payload = readPayload(draft);
            if (payload.promptMessageId === messageId) {
              await clearFlow(ctx.api, String(ctx.from.id));
            }
          }
          if (String(ctx.from.id) !== ownerId) {
            const ownerDraft = await getDraft(ownerId);
            if (ownerDraft) {
              const payload = readPayload(ownerDraft);
              if (payload.promptMessageId === messageId) {
                await clearFlow(ctx.api, ownerId);
              }
            }
          }
        }
        return;
      }

      if (data === "c:cancel") {
        await ctx.answerCallbackQuery({ text: "❌ Cancelled" });
        if (ctx.chat && ctx.callbackQuery.message) {
          await deleteQuietly(
            ctx.api,
            ctx.chat.id,
            ctx.callbackQuery.message.message_id,
          );
        }
        await clearFlow(ctx.api, String(ctx.from.id));
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
    } catch (error) {
      console.error("Callback error", error);
      try {
        await ctx.answerCallbackQuery({
          text: "Something went wrong. Try again.",
          show_alert: true,
        });
      } catch {}
    }
  });
}

async function handleCreatePriority(ctx: Context, priority: string) {
  const draft = await getDraft(String(ctx.from!.id));
  if (!draft || draft.step !== "create_priority") {
    await ctx.answerCallbackQuery({
      text: "Start a new task first",
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
  await ctx.editMessageText(
    "👤 Who should own this?\nTap to toggle · ✅ Continue when ready.",
    {
      reply_markup: createAssigneeKeyboard(members, []),
    },
  );
}

async function handleCreateAssign(ctx: Context, rawId: string) {
  const draft = await getDraft(String(ctx.from!.id));
  if (!draft || draft.step !== "create_assignee") {
    await ctx.answerCallbackQuery({
      text: "Start a new task first",
      show_alert: true,
    });
    return;
  }

  const payload = readPayload(draft);
  const selected = [...(payload.assigneeIds ?? [])];

  if (rawId === "done" || rawId === "0") {
    const assigneeIds = rawId === "0" ? [] : selected;
    await setDraft({
      telegramId: String(ctx.from!.id),
      chatId: draft.chatId,
      topicId: draft.topicId,
      step: "create_due",
      payload: {
        ...payload,
        assigneeIds,
        assigneeId: assigneeIds[0] ?? null,
      },
    });

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "📅 <b>Due date?</b>\nSend <code>YYYY-MM-DD</code>, <code>today</code>, <code>tomorrow</code>, or <code>skip</code>.",
      { parse_mode: "HTML" },
    );
    return;
  }

  const memberId = Number(rawId);
  if (!(memberId > 0)) {
    await ctx.answerCallbackQuery({ text: "Invalid", show_alert: true });
    return;
  }

  const next = selected.includes(memberId)
    ? selected.filter((id) => id !== memberId)
    : [...selected, memberId];

  await setDraft({
    telegramId: String(ctx.from!.id),
    chatId: draft.chatId,
    topicId: draft.topicId,
    step: "create_assignee",
    payload: {
      ...payload,
      assigneeIds: next,
      assigneeId: next[0] ?? null,
    },
  });

  const members = await listActiveMembers();
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({
    reply_markup: createAssigneeKeyboard(members, next),
  });
}

async function handleTaskAction(bot: Bot, ctx: Context, data: string) {
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

  if (action === "open" || action === "show") {
    await ctx.answerCallbackQuery();
    if (action === "show") {
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
      return;
    }
    await ctx.editMessageText(formatTaskCard(task, settings.timezone), {
      parse_mode: "HTML",
      reply_markup: taskKeyboard(task),
    });
    return;
  }

  if (action === "tasks") {
    await ctx.answerCallbackQuery({ text: "📋 Tasks" });
    await showMine(ctx);
    return;
  }

  if (action === "claim") {
    const updated = await addTaskAssignee(taskId, member.id);
    const withStatus =
      updated && task.status === "todo"
        ? await updateTask(taskId, { status: "doing" })
        : updated;
    await ctx.answerCallbackQuery({ text: "✋ Claimed" });
    if (withStatus) {
      await ctx.editMessageText(formatTaskCard(withStatus, settings.timezone), {
        parse_mode: "HTML",
        reply_markup: taskKeyboard(withStatus),
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
        parse_mode: "HTML",
        reply_markup: taskKeyboard(updated),
      });
    }
    await syncBoard(ctx.api);
    return;
  }

  if (action === "blocked") {
    await ctx.answerCallbackQuery();
    await sendFresh(
      ctx,
      `🔴 Why is <b>${taskRef(taskId)}</b> blocked?`,
      { parse_mode: "HTML" },
      "block_reason",
      { taskId },
      true,
    );
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
        parse_mode: "HTML",
        reply_markup: taskKeyboard(updated),
      });
    }
    await syncBoard(ctx.api);
    return;
  }

  if (action === "due") {
    await ctx.answerCallbackQuery();
    await sendFresh(
      ctx,
      `📅 New due date for <b>${taskRef(taskId)}</b>?\n<code>YYYY-MM-DD</code>, <code>today</code>, <code>tomorrow</code>, or <code>skip</code>.`,
      { parse_mode: "HTML" },
      "edit_due",
      { taskId },
      true,
    );
    return;
  }

  if (action === "hand" && !arg) {
    const members = await listActiveMembers();
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({
      reply_markup: assigneeKeyboard(
        taskId,
        members,
        task.assignees.map((person) => person.id),
      ),
    });
    return;
  }

  if (action === "hand" && arg === "done") {
    await ctx.answerCallbackQuery({ text: "👥 Assignees updated" });
    const latest = await getTask(taskId);
    if (latest) {
      await ctx.editMessageText(formatTaskCard(latest, settings.timezone), {
        parse_mode: "HTML",
        reply_markup: taskKeyboard(latest),
      });
    }
    await syncBoard(ctx.api);
    return;
  }

  if (action === "hand" && arg) {
    const memberId = Number(arg);
    const current = task.assignees.map((person) => person.id);
    let next: number[];
    let added: number | null = null;

    if (memberId === 0) {
      next = [];
    } else if (current.includes(memberId)) {
      next = current.filter((id) => id !== memberId);
    } else {
      next = [...current, memberId];
      added = memberId;
    }

    const updated = await updateTask(taskId, { assigneeIds: next });
    const members = await listActiveMembers();
    await ctx.answerCallbackQuery();
    if (updated) {
      await ctx.editMessageReplyMarkup({
        reply_markup: assigneeKeyboard(taskId, members, next),
      });
    }
    if (added) {
      await notifyAssignees(
        bot,
        [added],
        `🛠 Assigned to you: <b>${taskRef(taskId)}</b> ${escapeHtml(task.title)}\nby ${mention(member)}`,
      );
    }
    return;
  }

  if (action === "assign" && arg) {
    const memberId = Number(arg);
    const updated = await updateTask(taskId, {
      assigneeIds: memberId > 0 ? [memberId] : [],
    });
    await ctx.answerCallbackQuery({ text: "👤 Assignee updated" });
    if (updated) {
      await ctx.editMessageText(formatTaskCard(updated, settings.timezone), {
        parse_mode: "HTML",
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
    await ctx.editMessageText(`🗑 Deleted <b>${taskRef(taskId)}</b>.`, {
      parse_mode: "HTML",
    });
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
    assigneeIds:
      payload.assigneeIds ??
      (payload.assigneeId != null && payload.assigneeId > 0
        ? [payload.assigneeId]
        : []),
    createdById: member?.id ?? null,
    dueAt,
  });

  await clearFlow(ctx.api, String(ctx.from!.id));

  const card = formatTaskCard(task, settings.timezone);
  try {
    const message = await postToBoard(ctx.api, card, taskKeyboard(task));
    await updateTask(task.id, { messageId: message.message_id });
  } catch {
    await sendFresh(
      ctx,
      card,
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
  await notifyAssignees(
    bot,
    task.assignees.map((person) => person.id),
    `🛠 Assigned to you: <b>${taskRef(task.id)}</b> ${escapeHtml(task.title)}`,
  );
  return true;
}
