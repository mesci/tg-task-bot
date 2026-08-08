import type { Bot } from "grammy";
import { isAllowedRoom } from "@/bot/access";
import {
  sendHelp,
  showBoard,
  showMine,
  showTeam,
  startCreateTask,
} from "@/bot/actions";
import { MENU, isMenuText } from "@/bot/menu";

export function registerMenu(bot: Bot) {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (!isMenuText(text)) {
      await next();
      return;
    }

    if (!(await isAllowedRoom(ctx)) && ctx.chat.type !== "private") {
      return;
    }

    if (text === MENU.board) {
      await showBoard(ctx);
      return;
    }
    if (text === MENU.task) {
      await startCreateTask(ctx);
      return;
    }
    if (text === MENU.mine) {
      await showMine(ctx);
      return;
    }
    if (text === MENU.team) {
      await showTeam(ctx);
      return;
    }
    if (text === MENU.help) {
      await sendHelp(ctx);
      return;
    }

    await next();
  });
}
