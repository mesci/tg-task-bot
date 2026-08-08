import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dayKey } from "@/lib/time";
import { getSettings } from "@/lib/settings";

export async function setFocus(input: {
  memberId: number;
  note: string;
  taskId?: number | null;
}) {
  const settings = await getSettings();
  const day = dayKey(new Date(), settings.timezone);
  const db = getDb();

  const existing = await db
    .select()
    .from(schema.focuses)
    .where(
      and(eq(schema.focuses.memberId, input.memberId), eq(schema.focuses.day, day)),
    )
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(schema.focuses)
      .set({
        note: input.note.trim(),
        taskId: input.taskId ?? null,
      })
      .where(eq(schema.focuses.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(schema.focuses)
    .values({
      memberId: input.memberId,
      day,
      note: input.note.trim(),
      taskId: input.taskId ?? null,
    })
    .returning();
  return created;
}

export async function getFocusForDay(memberId: number, day?: string) {
  const settings = await getSettings();
  const key = day ?? dayKey(new Date(), settings.timezone);
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.focuses)
    .where(
      and(eq(schema.focuses.memberId, memberId), eq(schema.focuses.day, key)),
    )
    .limit(1);
  return rows[0];
}

export async function listFocusesToday() {
  const settings = await getSettings();
  const day = dayKey(new Date(), settings.timezone);
  const db = getDb();
  return db
    .select()
    .from(schema.focuses)
    .where(eq(schema.focuses.day, day));
}
