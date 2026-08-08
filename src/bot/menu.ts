import { Keyboard } from "grammy";

export const MENU = {
  board: "📌 Board",
  task: "➕ New task",
  mine: "👤 My tasks",
  team: "👥 Team",
  help: "❓ Help",
} as const;

export function mainKeyboard() {
  return new Keyboard()
    .text(MENU.board)
    .primary()
    .text(MENU.task)
    .success()
    .row()
    .text(MENU.mine)
    .text(MENU.team)
    .row()
    .text(MENU.help)
    .resized()
    .persistent();
}

export function isMenuText(text: string): boolean {
  return Object.values(MENU).includes(text as (typeof MENU)[keyof typeof MENU]);
}
