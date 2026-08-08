import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  mention,
  taskRef,
} from "@/lib/labels";
import type { Member } from "@/lib/db";
import type { TaskWithAssignee } from "@/lib/tasks";
import { formatDue, formatShortDate } from "@/lib/time";

function priorityMark(priority: string): string {
  if (priority === "urgent") return "!";
  if (priority === "high") return "↑";
  if (priority === "low") return "↓";
  return "";
}

export function formatTaskLine(
  task: TaskWithAssignee,
  timezone: string,
): string {
  const mark = priorityMark(task.priority);
  const who = task.assignee ? mention(task.assignee) : "_unassigned_";
  const due = task.dueAt ? ` · ${formatShortDate(task.dueAt, timezone)}` : "";
  const blocked =
    task.status === "blocked" && task.blockedReason
      ? ` — ${task.blockedReason}`
      : "";
  return `• ${taskRef(task.id)} ${mark ? `${mark} ` : ""}*${escapeMarkdown(task.title)}* — ${who}${due}${blocked}`;
}

export function formatBoard(input: {
  open: TaskWithAssignee[];
  done: TaskWithAssignee[];
  timezone: string;
}): string {
  const lines: string[] = ["*taptopia board*", ""];

  for (const status of STATUS_ORDER) {
    const bucket =
      status === "done"
        ? input.done
        : input.open.filter((task) => task.status === status);
    if (bucket.length === 0) continue;
    lines.push(`*${STATUS_LABEL[status]}*`);
    for (const task of bucket.slice(0, status === "done" ? 6 : 20)) {
      lines.push(formatTaskLine(task, input.timezone));
    }
    lines.push("");
  }

  if (lines.length === 2) {
    lines.push("_No open tasks. Use /task to create one._");
  }

  lines.push("_/task · /mine · /today · /board_");
  return lines.join("\n").trim();
}

export function formatTaskCard(
  task: TaskWithAssignee,
  timezone: string,
): string {
  const lines = [
    `*${taskRef(task.id)} ${escapeMarkdown(task.title)}*`,
    `${STATUS_LABEL[task.status]} · ${PRIORITY_LABEL[task.priority]}`,
  ];

  if (task.description) {
    lines.push("");
    lines.push(escapeMarkdown(task.description));
  }

  lines.push("");
  lines.push(
    `Assignee: ${task.assignee ? mention(task.assignee) : "_unassigned_"}`,
  );

  if (task.dueAt) {
    lines.push(`Due: ${formatDue(task.dueAt, timezone)}`);
  }

  if (task.status === "blocked" && task.blockedReason) {
    lines.push(`Blocked: ${escapeMarkdown(task.blockedReason)}`);
  }

  return lines.join("\n");
}

export function formatMine(
  member: Member,
  tasks: TaskWithAssignee[],
  timezone: string,
): string {
  if (tasks.length === 0) {
    return `*Your tasks*\n\nNothing open for ${mention(member)}.`;
  }

  const lines = [`*Your tasks* · ${mention(member)}`, ""];
  for (const task of tasks) {
    lines.push(
      `• ${taskRef(task.id)} *${escapeMarkdown(task.title)}* · ${STATUS_LABEL[task.status]}${task.dueAt ? ` · ${formatShortDate(task.dueAt, timezone)}` : ""}`,
    );
  }
  return lines.join("\n");
}

export function formatToday(input: {
  member: Member;
  focusNote?: string | null;
  tasks: TaskWithAssignee[];
  timezone: string;
}): string {
  const lines = [`*Today* · ${mention(input.member)}`, ""];
  lines.push(
    input.focusNote
      ? `Focus: *${escapeMarkdown(input.focusNote)}*`
      : "Focus: _not set · /focus_",
  );
  lines.push("");

  if (input.tasks.length === 0) {
    lines.push("No open tasks.");
  } else {
    for (const task of input.tasks) {
      lines.push(formatTaskLine(task, input.timezone));
    }
  }

  return lines.join("\n");
}

export function escapeMarkdown(value: string): string {
  return value.replace(/([_*`\[])/g, "\\$1");
}

export function helpText(): string {
  return [
    "*taptopia*",
    "Team coordination inside Telegram.",
    "",
    "*Everyone*",
    "/board — live board",
    "/task — create a task",
    "/mine — your open tasks",
    "/today — focus + your work",
    "/focus — set today's focus",
    "/standup — post a short check-in",
    "/task 12 — open task card",
    "",
    "*On task cards*",
    "Claim · Doing · Blocked · Done · Handoff · Edit · Delete",
    "",
    "*Admins*",
    "/bind — bind this topic as the board room",
    "/join — add yourself to the team",
    "/members — list team",
  ].join("\n");
}
