import { requireAdminApi } from "@/lib/admin-guard";
import { ensureSchema } from "@/lib/db";
import {
  createTask,
  deleteTask,
  listAllTasks,
  updateTask,
} from "@/lib/tasks";
import { getBot } from "@/bot";
import { syncBoard } from "@/bot/board";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();
  return Response.json({ tasks: await listAllTasks() });
}

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    priority?: "low" | "normal" | "high" | "urgent";
    assigneeId?: number | null;
    dueAt?: string | null;
  };

  if (!body.title?.trim()) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const task = await createTask({
    title: body.title,
    description: body.description ?? null,
    priority: body.priority ?? "normal",
    assigneeId: body.assigneeId ?? null,
    dueAt: body.dueAt ? new Date(body.dueAt) : null,
  });

  try {
    await syncBoard(getBot().api);
  } catch {}

  return Response.json({ task });
}

export async function PATCH(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();

  const body = (await request.json()) as {
    id?: number;
    title?: string;
    description?: string | null;
    status?: "todo" | "doing" | "blocked" | "done";
    priority?: "low" | "normal" | "high" | "urgent";
    assigneeId?: number | null;
    dueAt?: string | null;
    blockedReason?: string | null;
  };

  if (!body.id) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const task = await updateTask(body.id, {
    title: body.title,
    description: body.description,
    status: body.status,
    priority: body.priority,
    assigneeId: body.assigneeId,
    dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null,
    blockedReason: body.blockedReason,
  });

  try {
    await syncBoard(getBot().api);
  } catch {}

  return Response.json({ task });
}

export async function DELETE(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();

  const body = (await request.json()) as { id?: number };
  if (!body.id) {
    return Response.json({ ok: false }, { status: 400 });
  }

  await deleteTask(body.id);

  try {
    await syncBoard(getBot().api);
  } catch {}

  return Response.json({ ok: true });
}
