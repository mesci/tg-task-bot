import {
  PRIORITY_EMOJI,
  PRIORITY_LABEL,
  STATUS_EMOJI,
  STATUS_LABEL,
  STATUS_ORDER,
  mention,
  taskRef,
} from "@/lib/labels";
import type { Member } from "@/lib/db";
import type { TaskWithAssignee } from "@/lib/tasks";
import { formatDue, formatShortDate } from "@/lib/time";

export function formatTaskLine(
  task: TaskWithAssignee,
  timezone: string,
): string {
  const who = task.assignee ? mention(task.assignee) : "_unassigned_";
  const due = task.dueAt
    ? ` · 📅 ${formatShortDate(task.dueAt, timezone)}`
    : "";
  const blocked =
    task.status === "blocked" && task.blockedReason
      ? `\n    💬 ${escapeMarkdown(task.blockedReason)}`
      : "";
  const prio =
    task.priority !== "normal" ? `${PRIORITY_EMOJI[task.priority]} ` : "";

  return `${STATUS_EMOJI[task.status]} ${taskRef(task.id)} ${prio}*${escapeMarkdown(task.title)}*\n    👤 ${who}${due}${blocked}`;
}

export function formatBoard(input: {
  open: TaskWithAssignee[];
  done: TaskWithAssignee[];
  timezone: string;
}): string {
  const lines: string[] = ["🎯 *TapTopia Board*", ""];

  for (const status of STATUS_ORDER) {
    const bucket =
      status === "done"
        ? input.done
        : input.open.filter((task) => task.status === status);
    if (bucket.length === 0) continue;
    lines.push(`${STATUS_LABEL[status]}`);
    for (const task of bucket.slice(0, status === "done" ? 6 : 20)) {
      lines.push(formatTaskLine(task, input.timezone));
      lines.push("");
    }
  }

  if (lines.length === 2) {
    lines.push("_No open tasks yet._");
    lines.push("_Tap *New task* or send /task_");
  }

  lines.push("────────────");
  lines.push("🛠 /task   👤 /mine   📌 /board");
  return lines.join("\n").trim();
}

export function formatTaskCard(
  task: TaskWithAssignee,
  timezone: string,
): string {
  const lines = [
    `${STATUS_EMOJI[task.status]} *${taskRef(task.id)} ${escapeMarkdown(task.title)}*`,
    "",
    `📊 ${STATUS_LABEL[task.status]}`,
    `⚡ ${PRIORITY_LABEL[task.priority]}`,
  ];

  if (task.description) {
    lines.push("");
    lines.push(`📝 ${escapeMarkdown(task.description)}`);
  }

  lines.push("");
  lines.push(
    `👤 ${task.assignee ? mention(task.assignee) : "_unassigned_"}`,
  );

  if (task.dueAt) {
    lines.push(`📅 ${formatDue(task.dueAt, timezone)}`);
  }

  if (task.status === "blocked" && task.blockedReason) {
    lines.push(`🚫 ${escapeMarkdown(task.blockedReason)}`);
  }

  return lines.join("\n");
}

export function formatMine(
  member: Member,
  tasks: TaskWithAssignee[],
  timezone: string,
): string {
  if (tasks.length === 0) {
    return `👤 *Your tasks*\n\nNothing open for ${mention(member)}.\n_Create one with /task_`;
  }

  const lines = [`👤 *Your tasks* · ${mention(member)}`, ""];
  for (const task of tasks) {
    const due = task.dueAt
      ? ` · 📅 ${formatShortDate(task.dueAt, timezone)}`
      : "";
    lines.push(
      `${STATUS_EMOJI[task.status]} ${taskRef(task.id)} *${escapeMarkdown(task.title)}*${due}`,
    );
  }
  lines.push("", `_Open a card: /task ${tasks[0].id}_`);
  return lines.join("\n");
}

export function escapeMarkdown(value: string): string {
  return value.replace(/([_*`\[])/g, "\\$1");
}

export function helpText(): string {
  return [
    "🎯 *taptopia*",
    "Team tasks, right inside Telegram.",
    "",
    "*Commands*",
    "📌 /board — live board",
    "🛠 /task — create a task",
    "🛠 /task 12 — open task #12",
    "👤 /mine — your open tasks",
    "👥 /members — team list",
    "❌ /cancel — cancel current flow",
    "",
    "*Task buttons*",
    "✋ Claim · 🔵 Doing · 🔴 Blocked · ✅ Done",
    "🔁 Handoff · ⚡ Priority · 📅 Due · 🗑 Delete",
    "",
    "*Setup*",
    "🔗 /bind — bind this topic",
    "🚪 /join — join the team",
  ].join("\n");
}
