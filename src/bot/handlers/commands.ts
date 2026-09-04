import type { Bot } from "grammy";
import {
  displayNameFromCtx,
  gateAdmin,
  gateMember,
  isAllowedRoom,
} from "@/bot/access";
import {
  cancelFlow,
  openTaskCard,
  sendHelp,
  showBoard,
  showMine,
  showTeam,
  startCreateTask,
} from "@/bot/actions";
import { recreateBoard, syncBoard } from "@/bot/board";
import { scrubTrigger, sendFresh } from "@/bot/cleanup";
import { clearDoneKeyboard, createPriorityKeyboard, taskKeyboard } from "@/bot/keyboards";
import { mainKeyboard } from "@/bot/menu";
import {
  findMemberById,
  listActiveMembers,
  upsertMember,
} from "@/lib/members";
import { CLEAR_DONE_KEEP_DAYS, clearDoneCutoff, getSettings, updateSettings } from "@/lib/settings";
import { getTask, listDoneForBoard, updateTask } from "@/lib/tasks";
import { formatTaskCard } from "@/bot/format";

export function registerCommands(bot: Bot) {
  bot.command("start", async (ctx) => {
    await sendHelp(ctx);
  });

  bot.command("help", async (ctx) => {
    await sendHelp(ctx);
  });

  bot.command("join", async (ctx) => {
    if (!(await isAllowedRoom(ctx)) && ctx.chat?.type !== "private") {
      return;
    }

    const user = ctx.from!;
    const members = await listActiveMembers();
    const existing = await gateMember(ctx);
    await scrubTrigger(ctx);

    if (members.length > 0 && !existing) {
      await ctx.reply(
        "🚫 Ask a team admin to add you from the admin panel.",
        { reply_markup: mainKeyboard() },
      );
      return;
    }

    const member = await upsertMember({
      telegramId: String(user.id),
      username: user.username ?? null,
      displayName: displayNameFromCtx(ctx),
      role: existing?.role ?? (members.length === 0 ? "admin" : "member"),
    });

    await ctx.reply(
      `✅ You're on the team as <b>${member.role}</b>.\nUse the menu below.`,
      { parse_mode: "HTML", reply_markup: mainKeyboard() },
    );
  });

  bot.command("bind", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") {
      await ctx.reply("🔗 Run this inside the team topic.");
      return;
    }

    const user = ctx.from!;
    let isAdmin = await gateAdmin(ctx);
    const members = await listActiveMembers();

    if (!isAdmin && members.length === 0) {
      await upsertMember({
        telegramId: String(user.id),
        username: user.username ?? null,
        displayName: displayNameFromCtx(ctx),
        role: "admin",
      });
      isAdmin = true;
    }

    if (!isAdmin) {
      await ctx.reply(
        "🚫 Admins only. Join first, or get added from the admin panel.",
      );
      return;
    }

    const topicId = ctx.message?.message_thread_id ?? null;
    await updateSettings({
      chatId: String(ctx.chat.id),
      topicId,
      boardMessageId: null,
      doneBoardMessageId: null,
    });

    await syncBoard(ctx.api);
    await ctx.reply(
      topicId != null
        ? `🔗 Bound to this topic (<code>${topicId}</code>).`
        : "🔗 Bound to this chat.",
      { parse_mode: "HTML", reply_markup: mainKeyboard() },
    );
  });

  bot.command("board", async (ctx) => {
    if (!(await isAllowedRoom(ctx))) return;
    await showBoard(ctx);
  });

  bot.command("clearboard", async (ctx) => {
    if (!(await isAllowedRoom(ctx)) && ctx.chat?.type !== "private") return;
    if (!(await gateAdmin(ctx))) {
      await ctx.reply("🚫 Admins only.");
      return;
    }

    await scrubTrigger(ctx);
    const settings = await getSettings();
    const visible = await listDoneForBoard(settings.doneClearedAt);
    const keepCutoff = clearDoneCutoff();
    const kept = visible.filter(
      (task) => task.completedAt && task.completedAt.getTime() > keepCutoff.getTime(),
    ).length;
    const hidden = Math.max(0, visible.length - kept);

    await ctx.reply(
      `🧹 Hide <b>${hidden}</b> completed task${hidden === 1 ? "" : "s"} older than ${CLEAR_DONE_KEEP_DAYS} days?\n<b>${kept}</b> from the last ${CLEAR_DONE_KEEP_DAYS} days stay on the board.\nHistory & weekly digest are unchanged.`,
      {
        parse_mode: "HTML",
        reply_markup: clearDoneKeyboard(),
      },
    );
  });

  bot.command("members", async (ctx) => {
    if (!(await isAllowedRoom(ctx))) return;
    await showTeam(ctx);
  });

  bot.command("mine", async (ctx) => {
    await showMine(ctx);
  });

  bot.command("task", async (ctx) => {
    if (!(await isAllowedRoom(ctx)) && ctx.chat?.type !== "private") return;

    const member = await gateMember(ctx);
    if (!member) {
      await ctx.reply("🚪 Join the team first.", {
        reply_markup: mainKeyboard(),
      });
      return;
    }

    const raw = ctx.match?.toString().trim() ?? "";
    if (/^\d+$/.test(raw)) {
      await openTaskCard(ctx, Number(raw));
      return;
    }

    if (raw.length > 0) {
      await scrubTrigger(ctx);
      await sendFresh(
        ctx,
        "⚡ Pick a priority:",
        { reply_markup: createPriorityKeyboard() },
        "create_priority",
        { title: raw },
        true,
      );
      return;
    }

    await startCreateTask(ctx);
  });

  bot.command("cancel", async (ctx) => {
    await cancelFlow(ctx);
  });
}

export async function refreshTaskMessage(
  bot: Bot,
  taskId: number,
  chatId: string,
  messageId: number,
) {
  const task = await getTask(taskId);
  if (!task) return;
  const settings = await getSettings();
  await bot.api.editMessageText(
    chatId,
    messageId,
    formatTaskCard(task, settings.timezone),
    {
      parse_mode: "HTML",
      reply_markup: taskKeyboard(task),
    },
  );
  await updateTask(taskId, { messageId });
}

export async function notifyAssignee(
  bot: Bot,
  assigneeId: number | null | undefined,
  text: string,
) {
  if (!assigneeId) return;
  await notifyAssignees(bot, [assigneeId], text);
}

export async function notifyAssignees(
  bot: Bot,
  assigneeIds: number[],
  text: string,
) {
  const unique = [...new Set(assigneeIds.filter((id) => id > 0))];
  for (const assigneeId of unique) {
    const member = await findMemberById(assigneeId);
    if (!member) continue;
    try {
      await bot.api.sendMessage(member.telegramId, text, {
        parse_mode: "HTML",
        reply_markup: mainKeyboard(),
      });
    } catch {}
  }
}
