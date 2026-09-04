import { and, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { getDb, schema, type Member, type Task } from "@/lib/db";

export type TaskWithAssignee = Task & {
  assignees: Member[];
  assignee: Member | null;
};

async function setTaskAssignees(
  taskId: number,
  memberIds: number[],
): Promise<void> {
  const db = getDb();
  const unique = [...new Set(memberIds.filter((id) => id > 0))];
  await db
    .delete(schema.taskAssignees)
    .where(eq(schema.taskAssignees.taskId, taskId));
  if (unique.length > 0) {
    await db.insert(schema.taskAssignees).values(
      unique.map((memberId) => ({ taskId, memberId })),
    );
  }
  await db
    .update(schema.tasks)
    .set({ assigneeId: unique[0] ?? null, updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId));
}

async function attachAssignees(rows: Task[]): Promise<TaskWithAssignee[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const taskIds = rows.map((row) => row.id);
  const links = await db
    .select()
    .from(schema.taskAssignees)
    .where(inArray(schema.taskAssignees.taskId, taskIds));

  const memberIds = [
    ...new Set([
      ...links.map((link) => link.memberId),
      ...rows.map((row) => row.assigneeId).filter(Boolean),
    ]),
  ] as number[];

  const people =
    memberIds.length > 0
      ? await db
          .select()
          .from(schema.members)
          .where(inArray(schema.members.id, memberIds))
      : [];
  const map = new Map(people.map((person) => [person.id, person]));

  const byTask = new Map<number, Member[]>();
  for (const link of links) {
    const person = map.get(link.memberId);
    if (!person) continue;
    const list = byTask.get(link.taskId) ?? [];
    list.push(person);
    byTask.set(link.taskId, list);
  }

  return rows.map((row) => {
    let assignees = byTask.get(row.id) ?? [];
    if (assignees.length === 0 && row.assigneeId) {
      const fallback = map.get(row.assigneeId);
      if (fallback) assignees = [fallback];
    }
    return {
      ...row,
      assignees,
      assignee: assignees[0] ?? null,
      assigneeId: assignees[0]?.id ?? null,
    };
  });
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

export async function listDoneForBoard(
  clearedAt?: Date | null,
): Promise<TaskWithAssignee[]> {
  const db = getDb();

  const rows = clearedAt
    ? await db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.status, "done"),
            sql`${schema.tasks.completedAt} > ${clearedAt.getTime()}`,
          ),
        )
        .orderBy(desc(schema.tasks.completedAt))
    : await db
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
  const linked = await db
    .select({ taskId: schema.taskAssignees.taskId })
    .from(schema.taskAssignees)
    .where(eq(schema.taskAssignees.memberId, memberId));
  const ids = [
    ...new Set([
      ...linked.map((row) => row.taskId),
    ]),
  ];

  const legacy = await db
    .select()
    .from(schema.tasks)
    .where(
      and(eq(schema.tasks.assigneeId, memberId), ne(schema.tasks.status, "done")),
    );

  const fromLinks =
    ids.length > 0
      ? await db
          .select()
          .from(schema.tasks)
          .where(
            and(inArray(schema.tasks.id, ids), ne(schema.tasks.status, "done")),
          )
      : [];

  const byId = new Map<number, Task>();
  for (const row of [...fromLinks, ...legacy]) {
    byId.set(row.id, row);
  }
  const rows = [...byId.values()].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
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
  assigneeIds?: number[];
  createdById?: number | null;
  dueAt?: Date | null;
}): Promise<TaskWithAssignee> {
  const db = getDb();
  const now = new Date();
  const assigneeIds =
    input.assigneeIds ??
    (input.assigneeId != null && input.assigneeId > 0
      ? [input.assigneeId]
      : []);
  const primary = assigneeIds[0] ?? null;

  const [created] = await db
    .insert(schema.tasks)
    .values({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority ?? "normal",
      assigneeId: primary,
      createdById: input.createdById ?? null,
      dueAt: input.dueAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await setTaskAssignees(created.id, assigneeIds);
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
    assigneeIds: number[];
    dueAt: Date | null;
    blockedReason: string | null;
    reminderSentAt: Date | null;
    completedAt: Date | null;
    messageId: number | null;
  }>,
): Promise<TaskWithAssignee | null> {
  const db = getDb();
  const { assigneeIds, assigneeId, ...rest } = patch;
  const next: Record<string, unknown> = {
    ...rest,
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

  if (assigneeIds !== undefined) {
    next.assigneeId = assigneeIds[0] ?? null;
  } else if (assigneeId !== undefined) {
    next.assigneeId = assigneeId;
  }

  const [updated] = await db
    .update(schema.tasks)
    .set(next)
    .where(eq(schema.tasks.id, id))
    .returning();
  if (!updated) return null;

  if (assigneeIds !== undefined) {
    await setTaskAssignees(id, assigneeIds);
  } else if (assigneeId !== undefined) {
    await setTaskAssignees(id, assigneeId && assigneeId > 0 ? [assigneeId] : []);
  }

  return getTask(id);
}

export async function addTaskAssignee(
  taskId: number,
  memberId: number,
): Promise<TaskWithAssignee | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  if (task.assignees.some((person) => person.id === memberId)) {
    return task;
  }
  return updateTask(taskId, {
    assigneeIds: [...task.assignees.map((person) => person.id), memberId],
  });
}

export async function deleteTask(id: number): Promise<boolean> {
  const db = getDb();
  await db
    .delete(schema.taskAssignees)
    .where(eq(schema.taskAssignees.taskId, id));
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
