import { requireAdminApi } from "@/lib/admin-guard";
import { ensureSchema } from "@/lib/db";
import {
  listAllMembers,
  setMemberActive,
  setMemberRole,
  upsertMember,
} from "@/lib/members";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();
  return Response.json({ members: await listAllMembers() });
}

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();

  const body = (await request.json()) as {
    telegramId?: string;
    username?: string;
    displayName?: string;
    role?: "admin" | "member";
  };

  if (!body.telegramId || !body.displayName) {
    return Response.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const member = await upsertMember({
    telegramId: body.telegramId.trim(),
    username: body.username?.replace(/^@/, "") || null,
    displayName: body.displayName.trim(),
    role: body.role ?? "member",
  });

  return Response.json({ member });
}

export async function PATCH(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureSchema();

  const body = (await request.json()) as {
    id?: number;
    active?: boolean;
    role?: "admin" | "member";
  };

  if (!body.id) {
    return Response.json({ ok: false }, { status: 400 });
  }

  let member = null;
  if (typeof body.active === "boolean") {
    member = await setMemberActive(body.id, body.active);
  }
  if (body.role) {
    member = await setMemberRole(body.id, body.role);
  }

  return Response.json({ member });
}
