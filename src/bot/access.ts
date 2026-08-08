import type { Context } from "grammy";
import { getSettings } from "@/lib/settings";
import { isTeamAdmin, requireActiveMember } from "@/lib/members";

export function displayNameFromCtx(ctx: Context): string {
  const user = ctx.from;
  if (!user) return "Unknown";
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unknown";
}

export async function gateMember(ctx: Context) {
  const user = ctx.from;
  if (!user) return null;
  return requireActiveMember(String(user.id));
}

export async function gateAdmin(ctx: Context) {
  const user = ctx.from;
  if (!user) return false;
  return isTeamAdmin(String(user.id));
}

export async function isAllowedRoom(ctx: Context): Promise<boolean> {
  const chat = ctx.chat;
  if (!chat) return false;
  if (chat.type === "private") return true;

  const settings = await getSettings();
  if (!settings.chatId) return true;
  if (String(chat.id) !== settings.chatId) return false;

  if (settings.topicId == null) return true;

  const threadId = ctx.message?.message_thread_id ?? ctx.callbackQuery?.message?.message_thread_id;
  if (threadId == null) return false;
  return threadId === settings.topicId;
}
