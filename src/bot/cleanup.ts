import type { Api, Context } from "grammy";
import {
  clearDraft,
  getDraft,
  readPayload,
  setDraft,
  type DraftPayload,
} from "@/lib/drafts";

export async function deleteQuietly(
  api: Api,
  chatId: string | number,
  messageId?: number | null,
) {
  if (messageId == null) return;
  try {
    await api.deleteMessage(chatId, messageId);
  } catch {}
}

export async function scrubTrigger(ctx: Context) {
  const msg = ctx.message;
  if (!msg || !ctx.chat) return;
  await deleteQuietly(ctx.api, ctx.chat.id, msg.message_id);
}

export async function wipeStoredPrompt(api: Api, telegramId: string) {
  const draft = await getDraft(telegramId);
  if (!draft) return;
  const payload = readPayload(draft);
  if (payload.promptMessageId) {
    await deleteQuietly(api, draft.chatId, payload.promptMessageId);
  }
}

export async function sendFresh(
  ctx: Context,
  text: string,
  extra?: Parameters<Context["reply"]>[1],
  step = "idle",
  payloadPatch: DraftPayload = {},
  replacePayload = false,
) {
  const telegramId = String(ctx.from!.id);
  const draft = await getDraft(telegramId);
  const prev = draft ? readPayload(draft) : {};

  if (prev.promptMessageId && draft) {
    await deleteQuietly(ctx.api, draft.chatId, prev.promptMessageId);
  }

  const message = await ctx.reply(text, extra);

  await setDraft({
    telegramId,
    chatId: String(ctx.chat!.id),
    topicId:
      ctx.message?.message_thread_id ??
      ctx.callbackQuery?.message?.message_thread_id ??
      draft?.topicId ??
      null,
    step,
    payload: {
      ...(replacePayload ? {} : prev),
      ...payloadPatch,
      promptMessageId: message.message_id,
    },
  });

  return message;
}

export async function clearFlow(api: Api, telegramId: string) {
  await wipeStoredPrompt(api, telegramId);
  await clearDraft(telegramId);
}
