import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

type Db = LibSQLDatabase<typeof schema>;

declare global {
  var __taptopiaDb: Db | undefined;
  var __taptopiaClient: Client | undefined;
}

function createDb(): Db {
  const client =
    global.__taptopiaClient ??
    createClient({
      url: env.tursoDatabaseUrl(),
      authToken: env.tursoAuthToken(),
    });

  if (process.env.NODE_ENV !== "production") {
    global.__taptopiaClient = client;
  }

  return drizzle(client, { schema });
}

export function getDb(): Db {
  if (!global.__taptopiaDb) {
    global.__taptopiaDb = createDb();
  }
  return global.__taptopiaDb;
}

export async function ensureSchema(): Promise<void> {
  const client =
    global.__taptopiaClient ??
    createClient({
      url: env.tursoDatabaseUrl(),
      authToken: env.tursoAuthToken(),
    });

  if (process.env.NODE_ENV !== "production") {
    global.__taptopiaClient = client;
  }

  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT NOT NULL UNIQUE,
        username TEXT,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'normal',
        assignee_id INTEGER REFERENCES members(id),
        created_by_id INTEGER REFERENCES members(id),
        due_at INTEGER,
        blocked_reason TEXT,
        reminder_sent_at INTEGER,
        completed_at INTEGER,
        message_id INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT,
        topic_id INTEGER,
        board_message_id INTEGER,
        done_board_message_id INTEGER,
        done_cleared_at INTEGER,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        digest_enabled INTEGER NOT NULL DEFAULT 1,
        standup_enabled INTEGER NOT NULL DEFAULT 1,
        reminders_enabled INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS drafts (
        telegram_id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        topic_id INTEGER,
        step TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS focuses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL REFERENCES members(id),
        day TEXT NOT NULL,
        note TEXT NOT NULL,
        task_id INTEGER REFERENCES tasks(id),
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS task_assignees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id),
        member_id INTEGER NOT NULL REFERENCES members(id),
        UNIQUE(task_id, member_id)
      )`,
    ],
    "write",
  );

  try {
    await client.execute(
      "ALTER TABLE settings ADD COLUMN done_board_message_id INTEGER",
    );
  } catch {}

  try {
    await client.execute(
      "ALTER TABLE settings ADD COLUMN done_cleared_at INTEGER",
    );
  } catch {}

  try {
    await client.execute(`
      INSERT OR IGNORE INTO task_assignees (task_id, member_id)
      SELECT id, assignee_id FROM tasks
      WHERE assignee_id IS NOT NULL
    `);
  } catch {}
}

export { schema };
export type { Member, Task, Settings, Draft, Focus } from "@/lib/db/schema";
