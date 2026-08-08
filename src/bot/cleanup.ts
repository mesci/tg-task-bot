import type { Api, Context } from "grammy";
import { threadIdFromCtx, threadOptions } from "@/bot/access";
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

export async function wipeStoredPrompt(
  api: Api,
  telegramId: string,
  exceptMessageId?: number | null,
) {
  const draft = await getDraft(telegramId);
  if (!draft) return;
  const payload = readPayload(draft);
  if (
    payload.promptMessageId != null &&
    payload.promptMessageId !== exceptMessageId
  ) {
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
  const chat = ctx.chat;
  if (!chat) {
    throw new Error("No chat in context");
  }

  const draft = await getDraft(telegramId);
  const prev = draft ? readPayload(draft) : {};

  const extraObj =
    extra && typeof extra === "object" ? (extra as Record<string, unknown>) : {};

  const message = await ctx.reply(text, {
    ...extraObj,
    ...threadOptions(ctx),
  } as Parameters<Context["reply"]>[1]);

  if (
    prev.promptMessageId != null &&
    prev.promptMessageId !== message.message_id
  ) {
    await deleteQuietly(ctx.api, draft!.chatId, prev.promptMessageId);
  }

  await setDraft({
    telegramId,
    chatId: String(chat.id),
    topicId: threadIdFromCtx(ctx) ?? draft?.topicId ?? null,
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
