import { eq } from "drizzle-orm";
import { getDb, schema, type Draft } from "@/lib/db";

export type DraftPayload = {
  title?: string;
  description?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  assigneeId?: number | null;
  dueAt?: string | null;
  taskId?: number;
  handoffFrom?: number;
  promptMessageId?: number;
};

export async function getDraft(telegramId: string): Promise<Draft | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.drafts)
    .where(eq(schema.drafts.telegramId, telegramId))
    .limit(1);
  return rows[0];
}

export function readPayload(draft: Draft): DraftPayload {
  try {
    return JSON.parse(draft.payload) as DraftPayload;
  } catch {
    return {};
  }
}

export async function setDraft(input: {
  telegramId: string;
  chatId: string;
  topicId?: number | null;
  step: string;
  payload?: DraftPayload;
}) {
  const db = getDb();
  const payload = JSON.stringify(input.payload ?? {});
  await db
    .insert(schema.drafts)
    .values({
      telegramId: input.telegramId,
      chatId: input.chatId,
      topicId: input.topicId ?? null,
      step: input.step,
      payload,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.drafts.telegramId,
      set: {
        chatId: input.chatId,
        topicId: input.topicId ?? null,
        step: input.step,
        payload,
        updatedAt: new Date(),
      },
    });
}

export async function clearDraft(telegramId: string) {
  const db = getDb();
  await db.delete(schema.drafts).where(eq(schema.drafts.telegramId, telegramId));
}
