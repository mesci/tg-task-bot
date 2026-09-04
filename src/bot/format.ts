import {
  PRIORITY_EMOJI,
  PRIORITY_LABEL,
  STATUS_EMOJI,
  STATUS_LABEL,
  OPEN_STATUS_ORDER,
  escapeHtml,
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
  const who =
    task.assignees.length > 0
      ? task.assignees.map((person) => mention(person)).join(", ")
      : "<i>unassigned</i>";
  const due = task.dueAt
    ? ` · 📅 ${formatShortDate(task.dueAt, timezone)}`
    : "";
  const blocked =
    task.status === "blocked" && task.blockedReason
      ? `\n      <i>💬 ${escapeHtml(task.blockedReason)}</i>`
      : "";
  const prio =
    task.priority !== "normal" ? `${PRIORITY_EMOJI[task.priority]} ` : "";

  return `${STATUS_EMOJI[task.status]} <b>${taskRef(task.id)}</b> ${prio}${escapeHtml(task.title)}\n      👤 ${who}${due}${blocked}`;
}

export function formatOpenBoard(input: {
  open: TaskWithAssignee[];
  timezone: string;
}): string {
  const openCount = input.open.length;
  const lines: string[] = [
    "🟨 <b>TAPTOPIA BOARD</b>",
    `<i>${openCount} open task${openCount === 1 ? "" : "s"}</i>`,
    "",
  ];

  let hasContent = false;

  for (const status of OPEN_STATUS_ORDER) {
    const bucket = input.open.filter((task) => task.status === status);
    if (bucket.length === 0) continue;
    hasContent = true;
    lines.push(`${STATUS_LABEL[status]} <b>· ${bucket.length}</b>`);
    for (const task of bucket) {
      lines.push(formatTaskLine(task, input.timezone));
      lines.push("");
    }
  }

  if (!hasContent) {
    lines.push("✨ <i>Board is clear.</i>");
    lines.push("<i>Tap ➕ New task to start.</i>");
  }

  return lines.join("\n").trim();
}

export function formatDoneBoard(input: {
  done: TaskWithAssignee[];
  timezone: string;
}): string {
  const lines: string[] = [
    "✅ <b>TAPTOPIA DONE</b>",
    `<i>${input.done.length} completed</i>`,
    "",
  ];

  if (input.done.length === 0) {
    lines.push("<i>No completed tasks yet.</i>");
    return lines.join("\n").trim();
  }

  for (const task of input.done) {
    lines.push(formatTaskLine(task, input.timezone));
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function formatTaskCard(
  task: TaskWithAssignee,
  timezone: string,
): string {
  const lines = [
    `${STATUS_EMOJI[task.status]} <b>${taskRef(task.id)}</b>  ${escapeHtml(task.title)}`,
    "──────────────",
    `📊  ${STATUS_LABEL[task.status]}`,
    `⚡  ${PRIORITY_LABEL[task.priority]}`,
  ];

  if (task.description) {
    lines.push("");
    lines.push(`📝  ${escapeHtml(task.description)}`);
  }

  lines.push("");
  lines.push(
    `👤  ${
      task.assignees.length > 0
        ? task.assignees.map((person) => mention(person)).join(", ")
        : "<i>unassigned</i>"
    }`,
  );

  if (task.dueAt) {
    lines.push(`📅  ${formatDue(task.dueAt, timezone)}`);
  }

  if (task.status === "blocked" && task.blockedReason) {
    lines.push(`🚫  ${escapeHtml(task.blockedReason)}`);
  }

  return lines.join("\n");
}

export function formatMine(
  member: Member,
  tasks: TaskWithAssignee[],
  timezone: string,
): string {
  if (tasks.length === 0) {
    return [
      "👤 <b>Your tasks</b>",
      "",
      `Hey ${mention(member)} — inbox zero.`,
      "<i>Tap ➕ New task when you're ready.</i>",
    ].join("\n");
  }

  const lines = [
    `👤 <b>Your tasks</b> · ${mention(member)}`,
    `<i>${tasks.length} open</i>`,
    "",
  ];

  for (const task of tasks) {
    const due = task.dueAt
      ? ` · 📅 ${formatShortDate(task.dueAt, timezone)}`
      : "";
    lines.push(
      `${STATUS_EMOJI[task.status]} <b>${taskRef(task.id)}</b>  ${escapeHtml(task.title)}${due}`,
    );
  }

  lines.push("");
  lines.push("<i>Tap a task below to open it.</i>");
  return lines.join("\n");
}

export function helpText(): string {
  return [
    "🟨 <b>TAPTOPIA</b>",
    "Team tasks inside Telegram.",
    "",
    "Use the menu under the chat:",
    "📌 Board · ➕ New task · 👤 My tasks · 👥 Team",
    "",
    "Admins: /clearboard — hide done tasks older than 2 days",
  ].join("\n");
}

export function teamText(
  members: { role: string; username: string | null; displayName: string; telegramId: string }[],
): string {
  if (members.length === 0) {
    return "👥 <b>Team</b>\n\nNo members yet.";
  }

  const lines = ["👥 <b>Team</b>", ""];
  for (const member of members) {
    const badge = member.role === "admin" ? "⛑️" : "👤";
    lines.push(`${badge}  ${mention(member)}`);
  }
  return lines.join("\n");
}
