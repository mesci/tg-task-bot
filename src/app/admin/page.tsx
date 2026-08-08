import { redirect } from "next/navigation";
import { AdminDashboard, type Overview } from "@/app/admin/admin-dashboard";
import { isAdminAuthenticated } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { listAllMembers } from "@/lib/members";
import { getSettings } from "@/lib/settings";
import { countByStatus, listAllTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  await ensureSchema();

  const [settings, members, tasks, counts] = await Promise.all([
    getSettings(),
    listAllMembers(),
    listAllTasks(),
    countByStatus(),
  ]);

  const initialData: Overview = {
    settings: {
      chatId: settings.chatId,
      topicId: settings.topicId,
      timezone: settings.timezone,
      digestEnabled: settings.digestEnabled,
      remindersEnabled: settings.remindersEnabled,
    },
    members: members.map((member) => ({
      id: member.id,
      telegramId: member.telegramId,
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      active: member.active,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      blockedReason: task.blockedReason,
      assignee: task.assignee
        ? {
            id: task.assignee.id,
            telegramId: task.assignee.telegramId,
            username: task.assignee.username,
            displayName: task.assignee.displayName,
            role: task.assignee.role,
            active: task.assignee.active,
          }
        : null,
    })),
    counts,
  };

  return <AdminDashboard initialData={initialData} />;
}
