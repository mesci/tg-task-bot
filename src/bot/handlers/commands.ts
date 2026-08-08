import type { Bot } from "grammy";
import {
  displayNameFromCtx,
  gateAdmin,
  gateMember,
  isAllowedRoom,
} from "@/bot/access";
import {
  openTaskCard,
  sendHelp,
  showBoard,
  showMine,
  showTeam,
  startCreateTask,
} from "@/bot/actions";
import { syncBoard } from "@/bot/board";
import { createPriorityKeyboard, taskKeyboard } from "@/bot/keyboards";
import { mainKeyboard } from "@/bot/menu";
import { clearDraft, setDraft } from "@/lib/drafts";
import {
  findMemberById,
  listActiveMembers,
  upsertMember,
} from "@/lib/members";
import { getSettings, updateSettings } from "@/lib/settings";
import { getTask, updateTask } from "@/lib/tasks";
import { formatTaskCard } from "@/bot/format";

export function registerCommands(bot: Bot) {
  bot.command("start", async (ctx) => {
    await clearDraft(String(ctx.from!.id));
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
      await setDraft({
        telegramId: String(ctx.from!.id),
        chatId: String(ctx.chat!.id),
        topicId: ctx.message?.message_thread_id ?? null,
        step: "create_priority",
        payload: { title: raw },
      });
      await ctx.reply("⚡ Pick a priority:", {
        reply_markup: createPriorityKeyboard(),
      });
      return;
    }

    await startCreateTask(ctx);
  });

  bot.command("cancel", async (ctx) => {
    await clearDraft(String(ctx.from!.id));
    await ctx.reply("❌ Cancelled.", { reply_markup: mainKeyboard() });
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
  const member = await findMemberById(assigneeId);
  if (!member) return;
  try {
    await bot.api.sendMessage(member.telegramId, text, {
      parse_mode: "HTML",
      reply_markup: mainKeyboard(),
    });
  } catch {}
}
