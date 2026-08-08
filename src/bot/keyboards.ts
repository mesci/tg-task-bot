import { InlineKeyboard } from "grammy";
import type { Member } from "@/lib/db";
import type { Task } from "@/lib/db";

export function taskKeyboard(task: Task): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (task.status !== "done") {
    if (!task.assigneeId) {
      kb.text("Claim", `t:${task.id}:claim`).row();
    }
    kb.text("Todo", `t:${task.id}:todo`)
      .text("Doing", `t:${task.id}:doing`)
      .text("Blocked", `t:${task.id}:blocked`)
      .row();
    kb.text("Done", `t:${task.id}:done`).row();
    kb.text("Handoff", `t:${task.id}:hand`)
      .text("Priority", `t:${task.id}:prio`)
      .text("Due", `t:${task.id}:due`)
      .row();
  } else {
    kb.text("Reopen", `t:${task.id}:todo`).row();
  }

  kb.text("Delete", `t:${task.id}:delask`);
  return kb;
}

export function confirmDeleteKeyboard(taskId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("Delete", `t:${taskId}:del`)
    .text("Cancel", `t:${taskId}:open`);
}

export function priorityKeyboard(taskId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("Low", `t:${taskId}:prio:low`)
    .text("Normal", `t:${taskId}:prio:normal`)
    .row()
    .text("High", `t:${taskId}:prio:high`)
    .text("Urgent", `t:${taskId}:prio:urgent`)
    .row()
    .text("Back", `t:${taskId}:open`);
}

export function assigneeKeyboard(
  taskId: number,
  members: Member[],
  prefix: "assign" | "hand",
): InlineKeyboard {
  const kb = new InlineKeyboard();
  members.forEach((member, index) => {
    kb.text(member.displayName, `t:${taskId}:${prefix}:${member.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (members.length % 2 === 1) kb.row();
  if (prefix === "assign") {
    kb.text("Unassigned", `t:${taskId}:assign:0`).row();
  }
  kb.text("Back", `t:${taskId}:open`);
  return kb;
}

export function createPriorityKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Low", "c:prio:low")
    .text("Normal", "c:prio:normal")
    .row()
    .text("High", "c:prio:high")
    .text("Urgent", "c:prio:urgent")
    .row()
    .text("Cancel", "c:cancel");
}

export function createAssigneeKeyboard(members: Member[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  members.forEach((member, index) => {
    kb.text(member.displayName, `c:assign:${member.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (members.length % 2 === 1) kb.row();
  kb.text("Unassigned", "c:assign:0").row();
  kb.text("Cancel", "c:cancel");
  return kb;
}

export function boardKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Refresh", "board:refresh")
    .text("New task", "board:new");
}
