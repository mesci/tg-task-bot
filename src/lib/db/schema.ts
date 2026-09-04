import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["todo", "doing", "blocked", "done"] })
    .notNull()
    .default("todo"),
  priority: text("priority", { enum: ["low", "normal", "high", "urgent"] })
    .notNull()
    .default("normal"),
  assigneeId: integer("assignee_id").references(() => members.id),
  createdById: integer("created_by_id").references(() => members.id),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  blockedReason: text("blocked_reason"),
  reminderSentAt: integer("reminder_sent_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  messageId: integer("message_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const taskAssignees = sqliteTable("task_assignees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id"),
  topicId: integer("topic_id"),
  boardMessageId: integer("board_message_id"),
  doneBoardMessageId: integer("done_board_message_id"),
  doneClearedAt: integer("done_cleared_at", { mode: "timestamp_ms" }),
  timezone: text("timezone").notNull().default("UTC"),
  digestEnabled: integer("digest_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  standupEnabled: integer("standup_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  remindersEnabled: integer("reminders_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
});

export const drafts = sqliteTable("drafts", {
  telegramId: text("telegram_id").primaryKey(),
  chatId: text("chat_id").notNull(),
  topicId: integer("topic_id"),
  step: text("step").notNull(),
  payload: text("payload").notNull().default("{}"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const focuses = sqliteTable("focuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  day: text("day").notNull(),
  note: text("note").notNull(),
  taskId: integer("task_id").references(() => tasks.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Member = typeof members.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type Focus = typeof focuses.$inferSelect;
