import { InlineKeyboard } from "grammy";
import type { Member, Task } from "@/lib/db";
import type { TaskWithAssignee } from "@/lib/tasks";

export function taskKeyboard(task: Task): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (task.status !== "done") {
    if (!task.assigneeId) {
      kb.text("✋ Claim", `t:${task.id}:claim`).primary().row();
    }

    kb.text("📋 ", `t:${task.id}:todo`)
      .text("🔵 Doing", `t:${task.id}:doing`)
      .primary()
      .row();
    kb.text("🔴 Blocked", `t:${task.id}:blocked`)
      .danger()
      .text("✅ Done", `t:${task.id}:done`)
      .success()
      .row();
    kb.text("🔁 Handoff", `t:${task.id}:hand`)
      .text("⚡ Priority", `t:${task.id}:prio`)
      .text("📅 Due", `t:${task.id}:due`)
      .row();
  } else {
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
  prefix: "assign" | "hand",
): InlineKeyboard {
  const kb = new InlineKeyboard();
  members.forEach((member, index) => {
    kb.text(`👤 ${member.displayName}`, `t:${taskId}:${prefix}:${member.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (members.length % 2 === 1) kb.row();
  if (prefix === "assign") {
    kb.text("👻 Unassigned", `t:${taskId}:assign:0`).row();
  }
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

export function createAssigneeKeyboard(members: Member[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  members.forEach((member, index) => {
    kb.text(`👤 ${member.displayName}`, `c:assign:${member.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (members.length % 2 === 1) kb.row();
  kb.text("👻 Unassigned", "c:assign:0").row();
  kb.text("❌ Cancel", "c:cancel").danger();
  return kb;
}

export function boardKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Refresh", "board:refresh")
    .primary()
    .text("➕ New task", "board:new")
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
