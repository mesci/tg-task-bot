import type { Api, Context } from "grammy";
import { renderBoardText, syncBoard } from "@/bot/board";
import {
  formatMine,
  formatTaskCard,
  helpText,
  teamText,
} from "@/bot/format";
import {
  boardKeyboard,
  createPriorityKeyboard,
  helpKeyboard,
  mineKeyboard,
  taskKeyboard,
} from "@/bot/keyboards";
import { mainKeyboard } from "@/bot/menu";
import { setDraft } from "@/lib/drafts";
import { gateAdmin, gateMember } from "@/bot/access";
import { listActiveMembers } from "@/lib/members";
import { getSettings } from "@/lib/settings";
import { getTask, listTasksForMember } from "@/lib/tasks";

export async function sendHelp(ctx: Context) {
  await ctx.reply(helpText(), {
    parse_mode: "HTML",
    reply_markup: helpKeyboard(),
  });
  await ctx.reply("Menu stays under the chat ↓", {
    reply_markup: mainKeyboard(),
  });
}

export async function showBoard(ctx: Context) {
  if (!(await gateMember(ctx)) && !(await gateAdmin(ctx))) {
    await ctx.reply("🚪 Join the team first.", {
      reply_markup: mainKeyboard(),
    });
    return;
  }

  const settings = await getSettings();
  if (!settings.chatId) {
    await ctx.reply("🔗 An admin needs to bind the board room first.", {
      reply_markup: mainKeyboard(),
    });
    return;
  }

  await syncBoard(ctx.api);

  if (ctx.chat?.type === "private") {
    const text = await renderBoardText();
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: boardKeyboard(),
    });
  } else {
    await ctx.reply("📌 Board updated.", {
      reply_markup: mainKeyboard(),
    });
  }
}

export async function showMine(ctx: Context) {
  const member = await gateMember(ctx);
  if (!member) {
    await ctx.reply("🚪 You're not on the team yet.", {
      reply_markup: mainKeyboard(),
    });
    return;
  }

  const settings = await getSettings();
  const tasks = await listTasksForMember(member.id);
  await ctx.reply(formatMine(member, tasks, settings.timezone), {
    parse_mode: "HTML",
    reply_markup: tasks.length > 0 ? mineKeyboard(tasks) : helpKeyboard(),
  });
}

export async function showTeam(ctx: Context) {
  const members = await listActiveMembers();
  await ctx.reply(teamText(members), {
    parse_mode: "HTML",
    reply_markup: mainKeyboard(),
  });
}

export async function startCreateTask(ctx: Context) {
  const member = await gateMember(ctx);
  if (!member) {
    await ctx.reply("🚪 Join the team first.", {
      reply_markup: mainKeyboard(),
    });
    return;
  }

  await setDraft({
    telegramId: String(ctx.from!.id),
    chatId: String(ctx.chat!.id),
    topicId:
      ctx.message?.message_thread_id ??
      ctx.callbackQuery?.message?.message_thread_id ??
      null,
    step: "create_title",
    payload: {},
  });

  await ctx.reply("🛠 <b>New task</b>\nWhat's the title?", {
    parse_mode: "HTML",
  });
}

export async function openTaskCard(ctx: Context, taskId: number) {
  const task = await getTask(taskId);
  if (!task) {
    await ctx.reply("❓ Task not found.");
    return;
  }
  const settings = await getSettings();
  await ctx.reply(formatTaskCard(task, settings.timezone), {
    parse_mode: "HTML",
    reply_markup: taskKeyboard(task),
  });
}

export async function editToTaskCard(
  ctx: Context,
  taskId: number,
) {
  const task = await getTask(taskId);
  if (!task) return;
  const settings = await getSettings();
  await ctx.editMessageText(formatTaskCard(task, settings.timezone), {
    parse_mode: "HTML",
    reply_markup: taskKeyboard(task),
  });
}

export async function replyWithPriorityPicker(api: Api, chatId: number | string) {
  await api.sendMessage(chatId, "⚡ Pick a priority:", {
    reply_markup: createPriorityKeyboard(),
  });
}
