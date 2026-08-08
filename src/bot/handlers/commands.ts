import type { Bot } from "grammy";
import {
  displayNameFromCtx,
  gateAdmin,
  gateMember,
  isAllowedRoom,
} from "@/bot/access";
import { renderBoardText, syncBoard } from "@/bot/board";
import { formatMine, formatTaskCard, helpText } from "@/bot/format";
import {
  boardKeyboard,
  createPriorityKeyboard,
  taskKeyboard,
} from "@/bot/keyboards";
import { clearDraft, setDraft } from "@/lib/drafts";
import {
  findMemberById,
  listActiveMembers,
  upsertMember,
} from "@/lib/members";
import { getSettings, updateSettings } from "@/lib/settings";
import { getTask, listTasksForMember, updateTask } from "@/lib/tasks";
import { mention } from "@/lib/labels";

export function registerCommands(bot: Bot) {
  bot.command("start", async (ctx) => {
    await clearDraft(String(ctx.from!.id));
    await ctx.reply(helpText(), { parse_mode: "Markdown" });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(helpText(), { parse_mode: "Markdown" });
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
      `✅ You're on the taptopia team as *${member.role}*.`,
      { parse_mode: "Markdown" },
    );
  });

  bot.command("bind", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") {
      await ctx.reply("🔗 Run /bind inside the team topic.");
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
        "🚫 Admins only. Run /join first, or get added from the admin panel.",
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
        ? `🔗 Bound to this topic (\`${topicId}\`).`
        : "🔗 Bound to this chat.",
      { parse_mode: "Markdown" },
    );
  });

  bot.command("board", async (ctx) => {
    if (!(await isAllowedRoom(ctx))) return;
    if (!(await gateMember(ctx)) && !(await gateAdmin(ctx))) {
      await ctx.reply("🚪 Join the team first with /join.");
      return;
    }

    const settings = await getSettings();
    if (!settings.chatId) {
      await ctx.reply("🔗 An admin needs to /bind the board room first.");
      return;
    }

    await syncBoard(ctx.api);

    if (ctx.chat?.type === "private") {
      const text = await renderBoardText();
      await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: boardKeyboard(),
      });
    } else {
      await ctx.reply("📌 Board updated.");
    }
  });

  bot.command("members", async (ctx) => {
    if (!(await isAllowedRoom(ctx))) return;
    const members = await listActiveMembers();
    if (members.length === 0) {
      await ctx.reply("👥 No members yet.");
      return;
    }
    const lines = members.map((member) => {
      const badge = member.role === "admin" ? "👑" : "👤";
      return `${badge} ${mention(member)}`;
    });
    await ctx.reply(["👥 *Team*", "", ...lines].join("\n"), {
      parse_mode: "Markdown",
    });
  });

  bot.command("mine", async (ctx) => {
    const member = await gateMember(ctx);
    if (!member) {
      await ctx.reply("🚪 You're not on the team yet.");
      return;
    }
    const settings = await getSettings();
    const tasks = await listTasksForMember(member.id);
    await ctx.reply(formatMine(member, tasks, settings.timezone), {
      parse_mode: "Markdown",
    });
  });

  bot.command("task", async (ctx) => {
    if (!(await isAllowedRoom(ctx)) && ctx.chat?.type !== "private") return;

    const member = await gateMember(ctx);
    if (!member) {
      await ctx.reply("🚪 Join the team first with /join, or ask an admin.");
      return;
    }

    const raw = ctx.match?.toString().trim() ?? "";
    if (/^\d+$/.test(raw)) {
      const task = await getTask(Number(raw));
      if (!task) {
        await ctx.reply("❓ Task not found.");
        return;
      }
      const settings = await getSettings();
      await ctx.reply(formatTaskCard(task, settings.timezone), {
        parse_mode: "Markdown",
        reply_markup: taskKeyboard(task),
      });
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

    await setDraft({
      telegramId: String(ctx.from!.id),
      chatId: String(ctx.chat!.id),
      topicId: ctx.message?.message_thread_id ?? null,
      step: "create_title",
      payload: {},
    });
    await ctx.reply("🛠 What's the task title?");
  });

  bot.command("cancel", async (ctx) => {
    await clearDraft(String(ctx.from!.id));
    await ctx.reply("❌ Cancelled.");
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
      parse_mode: "Markdown",
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
      parse_mode: "Markdown",
    });
  } catch {}
}
