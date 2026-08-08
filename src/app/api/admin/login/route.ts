import {
  createAdminSession,
  verifyAdminSecret,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { secret?: string };
  if (!body.secret || !verifyAdminSecret(body.secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  await createAdminSession();
  return Response.json({ ok: true });
}
