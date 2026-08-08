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

export function threadIdFromCtx(ctx: Context): number | undefined {
  const fromMsg = ctx.msg && "message_thread_id" in ctx.msg
    ? ctx.msg.message_thread_id
    : undefined;
  const fromCb = ctx.callbackQuery?.message &&
    "message_thread_id" in ctx.callbackQuery.message
    ? ctx.callbackQuery.message.message_thread_id
    : undefined;
  return fromMsg ?? fromCb ?? undefined;
}

export function threadOptions(ctx: Context): { message_thread_id?: number } {
  const threadId = threadIdFromCtx(ctx);
  return threadId != null ? { message_thread_id: threadId } : {};
}

export async function isAllowedRoom(ctx: Context): Promise<boolean> {
  const chat = ctx.chat;
  if (!chat) return false;
  if (chat.type === "private") return true;

  const settings = await getSettings();
  if (!settings.chatId) return true;
  if (String(chat.id) !== settings.chatId) return false;

  if (ctx.callbackQuery) return true;

  if (settings.topicId == null) return true;

  const threadId = threadIdFromCtx(ctx);
  if (threadId == null) return true;
  return threadId === settings.topicId;
}
