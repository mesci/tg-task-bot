import type { Api, InlineKeyboard } from "grammy";
import { formatDoneBoard, formatOpenBoard } from "@/bot/format";
import { boardKeyboard } from "@/bot/keyboards";
import { getSettings, updateSettings } from "@/lib/settings";
import { listAllDone, listOpenTasks } from "@/lib/tasks";

export async function renderOpenBoardText() {
  const settings = await getSettings();
  const open = await listOpenTasks();
  return formatOpenBoard({ open, timezone: settings.timezone });
}

export async function renderDoneBoardText() {
  const settings = await getSettings();
  const done = await listAllDone();
  return formatDoneBoard({ done, timezone: settings.timezone });
}

async function upsertBoardMessage(
  api: Api,
  chatId: string,
  messageId: number | null | undefined,
  text: string,
  thread: { message_thread_id?: number },
  replyMarkup?: InlineKeyboard,
): Promise<number> {
  if (messageId) {
    try {
      await api.editMessageText(chatId, messageId, text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
      return messageId;
    } catch {}
  }

  const message = await api.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    ...thread,
  });
  return message.message_id;
}

export async function syncBoard(api: Api): Promise<void> {
  const settings = await getSettings();
  if (!settings.chatId) return;

  const thread =
    settings.topicId != null ? { message_thread_id: settings.topicId } : {};

  const openText = await renderOpenBoardText();
  const doneText = await renderDoneBoardText();

  const boardMessageId = await upsertBoardMessage(
    api,
    settings.chatId,
    settings.boardMessageId,
    openText,
    thread,
    boardKeyboard(),
  );

  const doneBoardMessageId = await upsertBoardMessage(
    api,
    settings.chatId,
    settings.doneBoardMessageId,
    doneText,
    thread,
  );

  await updateSettings({ boardMessageId, doneBoardMessageId });
}

export async function recreateBoard(api: Api): Promise<void> {
  const settings = await getSettings();
  if (!settings.chatId) return;

  if (settings.boardMessageId) {
    try {
      await api.deleteMessage(settings.chatId, settings.boardMessageId);
    } catch {}
  }

  if (settings.doneBoardMessageId) {
    try {
      await api.deleteMessage(settings.chatId, settings.doneBoardMessageId);
    } catch {}
  }

  await updateSettings({ boardMessageId: null, doneBoardMessageId: null });
  await syncBoard(api);
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
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    ...thread,
  });
}
