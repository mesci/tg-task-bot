import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export async function getSettings() {
  const db = getDb();
  const rows = await db.select().from(schema.settings).limit(1);
  if (rows[0]) return rows[0];

  const inserted = await db
    .insert(schema.settings)
    .values({})
    .returning();
  return inserted[0];
}

export async function updateSettings(
  patch: Partial<{
    chatId: string | null;
    topicId: number | null;
    boardMessageId: number | null;
    doneBoardMessageId: number | null;
    timezone: string;
    digestEnabled: boolean;
    standupEnabled: boolean;
    remindersEnabled: boolean;
  }>,
) {
  const current = await getSettings();
  const db = getDb();
  const [updated] = await db
    .update(schema.settings)
    .set(patch)
    .where(eq(schema.settings.id, current.id))
    .returning();
  return updated;
}
