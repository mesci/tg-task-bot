import { InlineKeyboard } from "grammy";
import type { Member } from "@/lib/db";
import type { TaskWithAssignee } from "@/lib/tasks";

export function withDismiss(
  ownerTelegramId: string,
  base?: InlineKeyboard,
): InlineKeyboard {
  const kb = base
    ? new InlineKeyboard(
        base.inline_keyboard.map((row) => row.map((button) => ({ ...button }))),
      )
    : new InlineKeyboard();
  return kb.row().text("🗑 Dismiss", `d:${ownerTelegramId}`).danger();
}

export function taskKeyboard(task: TaskWithAssignee): InlineKeyboard {
  const kb = new InlineKeyboard();
  const assigned = task.assignees.length > 0;

  if (task.status !== "done") {
    if (!assigned) {
      kb.text("✋ Claim", `t:${task.id}:claim`).primary().row();
    }

    kb.text("📋 Tasks", `t:${task.id}:tasks`).primary().row();

    if (task.status !== "todo") {
      kb.text("📋 Todo", `t:${task.id}:todo`);
    }
    kb.text("🔵 Doing", `t:${task.id}:doing`)
      .primary()
      .row();
    kb.text("🔴 Blocked", `t:${task.id}:blocked`)
      .danger()
      .text("✅ Done", `t:${task.id}:done`)
      .success()
      .row();
    kb.text("👥 Assign", `t:${task.id}:hand`)
      .text("⚡ Priority", `t:${task.id}:prio`)
      .text("📅 Due", `t:${task.id}:due`)
      .row();
  } else {
    kb.text("📋 Tasks", `t:${task.id}:tasks`).row();
    kb.text("↩️ Reopen", `t:${task.id}:todo`).primary().row();
  }

  kb.text("🗑 Delete", `t:${task.id}:delask`).danger();
  return kb;
}

export function confirmDeleteKeyboard(taskId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("🗑 Delete", `t:${taskId}:del`)
    .danger()
    .text("Keep", `t:${taskId}:open`)
    .success();
}

export function priorityKeyboard(taskId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("⬇️ Low", `t:${taskId}:prio:low`)
    .text("➖ Normal", `t:${taskId}:prio:normal`)
    .row()
    .text("⬆️ High", `t:${taskId}:prio:high`)
    .primary()
    .text("🔥 Urgent", `t:${taskId}:prio:urgent`)
    .danger()
    .row()
    .text("↩️ Back", `t:${taskId}:open`);
}

export function assigneeKeyboard(
  taskId: number,
  members: Member[],
  selectedIds: number[] = [],
): InlineKeyboard {
  const selected = new Set(selectedIds);
  const kb = new InlineKeyboard();
  members.forEach((member, index) => {
    const mark = selected.has(member.id) ? "✅ " : "";
    kb.text(
      `${mark}👤 ${member.displayName}`,
      `t:${taskId}:hand:${member.id}`,
    );
    if (index % 2 === 1) kb.row();
  });
  if (members.length % 2 === 1) kb.row();
  kb.text("👻 Clear", `t:${taskId}:hand:0`).row();
  kb.text("✅ Done", `t:${taskId}:hand:done`).success().row();
  kb.text("↩️ Back", `t:${taskId}:open`);
  return kb;
}

export function createPriorityKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⬇️ Low", "c:prio:low")
    .text("➖ Normal", "c:prio:normal")
    .row()
    .text("⬆️ High", "c:prio:high")
    .primary()
    .text("🔥 Urgent", "c:prio:urgent")
    .danger()
    .row()
    .text("❌ Cancel", "c:cancel")
    .danger();
}

export function createAssigneeKeyboard(
  members: Member[],
  selectedIds: number[] = [],
): InlineKeyboard {
  const selected = new Set(selectedIds);
  const kb = new InlineKeyboard();
  members.forEach((member, index) => {
    const mark = selected.has(member.id) ? "✅ " : "";
    kb.text(`${mark}👤 ${member.displayName}`, `c:assign:${member.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (members.length % 2 === 1) kb.row();
  kb.text("👻 Unassigned", "c:assign:0").row();
  kb.text("✅ Continue", "c:assign:done").success().row();
  kb.text("❌ Cancel", "c:cancel").danger();
  return kb;
}

export function boardKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Refresh", "board:refresh")
    .primary()
    .text("➕ New task", "board:new")
    .success()
    .row()
    .text("👤 My tasks", "board:mine")
    .text("🧹 Clear done", "board:clearask")
    .danger();
}

export function clearDoneKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🧹 Yes, clear done", "board:clear")
    .danger()
    .text("Keep", "board:clearcancel")
    .success();
}

export function helpKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📌 Board", "menu:board")
    .primary()
    .text("➕ New task", "menu:task")
    .success()
    .row()
    .text("👤 My tasks", "menu:mine")
    .text("👥 Team", "menu:team");
}

export function mineKeyboard(tasks: TaskWithAssignee[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const task of tasks.slice(0, 12)) {
    const mark =
      task.status === "doing"
        ? "🔵"
        : task.status === "blocked"
          ? "🔴"
          : "📋";
    const title =
      task.title.length > 28 ? `${task.title.slice(0, 28)}…` : task.title;
    kb.text(`${mark} #${task.id} ${title}`, `t:${task.id}:show`).row();
  }
  kb.text("➕ New task", "menu:task").success();
  return kb;
}
