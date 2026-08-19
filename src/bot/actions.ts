import type { Context } from "grammy";
import { gateAdmin, gateMember } from "@/bot/access";
import { recreateBoard, renderDoneBoardText, renderOpenBoardText } from "@/bot/board";
import {
  clearFlow,
  scrubTrigger,
  sendFresh,
  wipeStoredPrompt,
} from "@/bot/cleanup";
import {
  formatMine,
  formatTaskCard,
  helpText,
  teamText,
} from "@/bot/format";
import {
  boardKeyboard,
  helpKeyboard,
  mineKeyboard,
  taskKeyboard,
} from "@/bot/keyboards";
import { listActiveMembers } from "@/lib/members";
import { getSettings } from "@/lib/settings";
import { getTask, listTasksForMember } from "@/lib/tasks";

export async function sendHelp(ctx: Context) {
  await scrubTrigger(ctx);
  await sendFresh(
    ctx,
    helpText(),
    {
      parse_mode: "HTML",
      reply_markup: helpKeyboard(),
    },
    "idle",
    {},
    true,
  );
}

export async function showBoard(ctx: Context) {
  await scrubTrigger(ctx);

  if (!(await gateMember(ctx)) && !(await gateAdmin(ctx))) {
    await sendFresh(
      ctx,
      "🚪 Join the team first.",
      { reply_markup: helpKeyboard() },
      "idle",
      {},
      true,
    );
    return;
  }

  const settings = await getSettings();
  if (!settings.chatId) {
    await sendFresh(
      ctx,
      "🔗 An admin needs to bind the board room first.",
      { reply_markup: helpKeyboard() },
      "idle",
      {},
      true,
    );
    return;
  }

  await recreateBoard(ctx.api);

  if (ctx.chat?.type === "private") {
    const openText = await renderOpenBoardText();
    await sendFresh(
      ctx,
      openText,
      {
        parse_mode: "HTML",
        reply_markup: boardKeyboard(),
      },
      "idle",
      {},
      true,
    );
    await ctx.reply(await renderDoneBoardText(), {
      parse_mode: "HTML",
    });
    return;
  }

  if (ctx.from) {
    await wipeStoredPrompt(ctx.api, String(ctx.from.id));
  }
}

export async function showMine(ctx: Context) {
  await scrubTrigger(ctx);

  const member = await gateMember(ctx);
  if (!member) {
    await sendFresh(
      ctx,
      "🚪 You're not on the team yet.",
      { reply_markup: helpKeyboard() },
      "idle",
      {},
      true,
    );
    return;
  }

  const settings = await getSettings();
  const tasks = await listTasksForMember(member.id);
  await sendFresh(
    ctx,
    formatMine(member, tasks, settings.timezone),
    {
      parse_mode: "HTML",
      reply_markup: tasks.length > 0 ? mineKeyboard(tasks) : helpKeyboard(),
    },
    "idle",
    {},
    true,
  );
}

export async function showTeam(ctx: Context) {
  await scrubTrigger(ctx);
  const members = await listActiveMembers();
  await sendFresh(
    ctx,
    teamText(members),
    {
      parse_mode: "HTML",
      reply_markup: helpKeyboard(),
    },
    "idle",
    {},
    true,
  );
}

export async function startCreateTask(ctx: Context) {
  await scrubTrigger(ctx);

  const member = await gateMember(ctx);
  if (!member) {
    await sendFresh(
      ctx,
      "🚪 Join the team first.",
      { reply_markup: helpKeyboard() },
      "idle",
      {},
      true,
    );
    return;
  }

  await sendFresh(
    ctx,
    "🛠 <b>New task</b>\nWhat's the title?",
    { parse_mode: "HTML" },
    "create_title",
    {},
    true,
  );
}

export async function openTaskCard(ctx: Context, taskId: number) {
  await scrubTrigger(ctx);
  const task = await getTask(taskId);
  if (!task) {
    await sendFresh(ctx, "❓ Task not found.", undefined, "idle", {}, true);
    return;
  }
  const settings = await getSettings();
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

export async function cancelFlow(ctx: Context) {
  await scrubTrigger(ctx);
  if (ctx.from) {
    await clearFlow(ctx.api, String(ctx.from.id));
  }
  await sendFresh(
    ctx,
    "❌ Cancelled.",
    { reply_markup: helpKeyboard() },
    "idle",
    {},
    true,
  );
}
