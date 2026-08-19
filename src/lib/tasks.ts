import { and, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { getDb, schema, type Member, type Task } from "@/lib/db";

export type TaskWithAssignee = Task & {
  assignee: Member | null;
};

async function attachAssignees(rows: Task[]): Promise<TaskWithAssignee[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = [
    ...new Set(rows.map((row) => row.assigneeId).filter(Boolean) as number[]),
  ];
  const people =
    ids.length > 0
      ? await db
          .select()
          .from(schema.members)
          .where(inArray(schema.members.id, ids))
      : [];
  const map = new Map(people.map((person) => [person.id, person]));
  return rows.map((row) => ({
    ...row,
    assignee: row.assigneeId ? (map.get(row.assigneeId) ?? null) : null,
  }));
}

export async function listOpenTasks(): Promise<TaskWithAssignee[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(ne(schema.tasks.status, "done"))
    .orderBy(desc(schema.tasks.updatedAt));
  return attachAssignees(rows);
}

export async function listRecentDone(limit = 8): Promise<TaskWithAssignee[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.status, "done"))
    .orderBy(desc(schema.tasks.completedAt))
    .limit(limit);
  return attachAssignees(rows);
}

export async function listAllDone(): Promise<TaskWithAssignee[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.status, "done"))
    .orderBy(desc(schema.tasks.completedAt));
  return attachAssignees(rows);
}

export async function listAllTasks(): Promise<TaskWithAssignee[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .orderBy(desc(schema.tasks.updatedAt));
  return attachAssignees(rows);
}

export async function listTasksForMember(
  memberId: number,
): Promise<TaskWithAssignee[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(
      and(eq(schema.tasks.assigneeId, memberId), ne(schema.tasks.status, "done")),
    )
    .orderBy(desc(schema.tasks.updatedAt));
  return attachAssignees(rows);
}

export async function getTask(id: number): Promise<TaskWithAssignee | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const [task] = await attachAssignees(rows);
  return task;
}

export async function createTask(input: {
  title: string;
  description?: string | null;
  priority?: Task["priority"];
  assigneeId?: number | null;
  createdById?: number | null;
  dueAt?: Date | null;
}): Promise<TaskWithAssignee> {
  const db = getDb();
  const now = new Date();
  const [created] = await db
    .insert(schema.tasks)
    .values({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority ?? "normal",
      assigneeId: input.assigneeId ?? null,
      createdById: input.createdById ?? null,
      dueAt: input.dueAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const task = await getTask(created.id);
  return task!;
}

export async function updateTask(
  id: number,
  patch: Partial<{
    title: string;
    description: string | null;
    status: Task["status"];
    priority: Task["priority"];
    assigneeId: number | null;
    dueAt: Date | null;
    blockedReason: string | null;
    reminderSentAt: Date | null;
    completedAt: Date | null;
    messageId: number | null;
  }>,
): Promise<TaskWithAssignee | null> {
  const db = getDb();
  const next = {
    ...patch,
    updatedAt: new Date(),
  };

  if (patch.status === "done" && !patch.completedAt) {
    next.completedAt = new Date();
  }
  if (patch.status && patch.status !== "done") {
    next.completedAt = null;
  }
  if (patch.status && patch.status !== "blocked") {
    next.blockedReason = patch.blockedReason ?? null;
  }

  const [updated] = await db
    .update(schema.tasks)
    .set(next)
    .where(eq(schema.tasks.id, id))
    .returning();
  if (!updated) return null;
  return getTask(id);
}

export async function deleteTask(id: number): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(schema.tasks)
    .where(eq(schema.tasks.id, id))
    .returning();
  return deleted.length > 0;
}

export async function listTasksNeedingReminder(
  withinHours: number,
): Promise<TaskWithAssignee[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() + withinHours * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(
      and(
        ne(schema.tasks.status, "done"),
        isNotNull(schema.tasks.dueAt),
        sql`${schema.tasks.dueAt} <= ${cutoff.getTime()}`,
        or(
          sql`${schema.tasks.reminderSentAt} IS NULL`,
          sql`${schema.tasks.reminderSentAt} < ${schema.tasks.dueAt}`,
        ),
      ),
    );
  return attachAssignees(rows);
}

export async function listCompletedSince(since: Date): Promise<TaskWithAssignee[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.status, "done"),
        isNotNull(schema.tasks.completedAt),
        sql`${schema.tasks.completedAt} >= ${since.getTime()}`,
      ),
    )
    .orderBy(desc(schema.tasks.completedAt));
  return attachAssignees(rows);
}

export async function countByStatus() {
  const open = await listOpenTasks();
  const counts = { todo: 0, doing: 0, blocked: 0, done: 0 };
  for (const task of open) {
    counts[task.status] += 1;
  }
  const done = await listRecentDone(100);
  counts.done = done.length;
  return counts;
}
