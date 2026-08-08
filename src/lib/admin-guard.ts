import { isAdminAuthenticated } from "@/lib/auth";

export async function requireAdminApi() {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return null;
}
