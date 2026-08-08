import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE = "taptopia_admin";

function secretKey() {
  return new TextEncoder().encode(env.sessionSecret());
}

export async function createAdminSession(): Promise<void> {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;

  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export function verifyAdminSecret(input: string): boolean {
  return input === env.adminSecret();
}

export function verifyCronRequest(header: string | null): boolean {
  const secret = env.cronSecret();
  if (!secret) return process.env.NODE_ENV !== "production";
  return header === `Bearer ${secret}`;
}
