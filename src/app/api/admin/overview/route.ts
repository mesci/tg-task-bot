import { requireAdminApi } from "@/lib/admin-guard";
import { ensureSchema } from "@/lib/db";
import { listAllMembers } from "@/lib/members";
import { getSettings } from "@/lib/settings";
import { countByStatus, listAllTasks } from "@/lib/tasks";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  await ensureSchema();
  const [settings, members, tasks, counts] = await Promise.all([
    getSettings(),
    listAllMembers(),
    listAllTasks(),
    countByStatus(),
  ]);

  return Response.json({
    settings,
    members,
    tasks,
    counts,
  });
}
