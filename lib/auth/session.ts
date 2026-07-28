import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getAuthConfig } from "@/lib/server-config";

export const SESSION_COOKIE = "task_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthConfig().sessionSecret);
}

export async function createSessionToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ kind: "task-session" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE)
    .sign(secretKey());
}

export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.kind === "task-session";
  } catch {
    return false;
  }
}

export async function requireSession(): Promise<void> {
  if (!(await hasValidSession())) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
}

export async function setSessionCookie(): Promise<void> {
  const token = await createSessionToken();
  (await cookies()).set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
