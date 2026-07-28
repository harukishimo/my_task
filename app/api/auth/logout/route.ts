import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
