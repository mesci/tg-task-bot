import { and, asc, eq } from "drizzle-orm";
import { getDb, schema, type Member } from "@/lib/db";

export async function listActiveMembers(): Promise<Member[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.members)
    .where(eq(schema.members.active, true))
    .orderBy(asc(schema.members.displayName));
}

export async function listAllMembers(): Promise<Member[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.members)
    .orderBy(asc(schema.members.displayName));
}

export async function findMemberByTelegramId(
  telegramId: string,
): Promise<Member | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.telegramId, telegramId))
    .limit(1);
  return rows[0];
}

export async function findMemberById(id: number): Promise<Member | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.id, id))
    .limit(1);
  return rows[0];
}

export async function findMemberByUsername(
  username: string,
): Promise<Member | undefined> {
  const db = getDb();
  const normalized = username.replace(/^@/, "").toLowerCase();
  const rows = await db.select().from(schema.members);
  return rows.find(
    (member) => member.username?.toLowerCase() === normalized && member.active,
  );
}

export async function upsertMember(input: {
  telegramId: string;
  username?: string | null;
  displayName: string;
  role?: "admin" | "member";
}): Promise<Member> {
  const existing = await findMemberByTelegramId(input.telegramId);
  const db = getDb();

  if (existing) {
    const [updated] = await db
      .update(schema.members)
      .set({
        username: input.username ?? existing.username,
        displayName: input.displayName,
        role: input.role ?? existing.role,
        active: true,
      })
      .where(eq(schema.members.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(schema.members)
    .values({
      telegramId: input.telegramId,
      username: input.username ?? null,
      displayName: input.displayName,
      role: input.role ?? "member",
    })
    .returning();
  return created;
}

export async function setMemberActive(id: number, active: boolean) {
  const db = getDb();
  const [updated] = await db
    .update(schema.members)
    .set({ active })
    .where(eq(schema.members.id, id))
    .returning();
  return updated;
}

export async function setMemberRole(id: number, role: "admin" | "member") {
  const db = getDb();
  const [updated] = await db
    .update(schema.members)
    .set({ role })
    .where(eq(schema.members.id, id))
    .returning();
  return updated;
}

export async function requireActiveMember(telegramId: string) {
  const member = await findMemberByTelegramId(telegramId);
  if (!member || !member.active) return null;
  return member;
}

export async function isTeamAdmin(telegramId: string) {
  const member = await findMemberByTelegramId(telegramId);
  return Boolean(member?.active && member.role === "admin");
}

export async function countActiveAdmins() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.members)
    .where(and(eq(schema.members.active, true), eq(schema.members.role, "admin")));
  return rows.length;
}
