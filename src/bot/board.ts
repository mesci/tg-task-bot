import type { Api, InlineKeyboard } from "grammy";
import { formatBoard } from "@/bot/format";
import { boardKeyboard } from "@/bot/keyboards";
import { getSettings, updateSettings } from "@/lib/settings";
import { listOpenTasks, listRecentDone } from "@/lib/tasks";

export async function renderBoardText() {
  const settings = await getSettings();
  const open = await listOpenTasks();
  const done = await listRecentDone(6);
  return formatBoard({ open, done, timezone: settings.timezone });
}

export async function syncBoard(api: Api): Promise<void> {
  const settings = await getSettings();
  if (!settings.chatId) return;

  const text = await renderBoardText();
  const thread =
    settings.topicId != null ? { message_thread_id: settings.topicId } : {};

  if (settings.boardMessageId) {
    try {
      await api.editMessageText(
        settings.chatId,
        settings.boardMessageId,
        text,
        {
          parse_mode: "Markdown",
          reply_markup: boardKeyboard(),
        },
      );
      return;
    } catch {}
  }

  const message = await api.sendMessage(settings.chatId, text, {
    parse_mode: "Markdown",
    reply_markup: boardKeyboard(),
    ...thread,
  });

  await updateSettings({ boardMessageId: message.message_id });
}

export async function postToBoard(
  api: Api,
  text: string,
  replyMarkup?: InlineKeyboard,
) {
  const settings = await getSettings();
  if (!settings.chatId) {
    throw new Error("Board chat is not bound");
  }

  const thread =
    settings.topicId != null ? { message_thread_id: settings.topicId } : {};

  return api.sendMessage(settings.chatId, text, {
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
    ...thread,
  });
}
