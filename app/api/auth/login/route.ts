import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, failure, parseJsonBody, requestId } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyPassphrase } from "@/lib/auth/password";
import { getAuthConfig } from "@/lib/server-config";

const loginSchema = z.object({ passphrase: z.string().min(1).max(500) }).strict();

export async function POST(request: Request) {
  const id = requestId();
  try {
    const body = loginSchema.safeParse(await parseJsonBody(request));
    if (!body.success) return failure("VALIDATION_ERROR", "パスフレーズを入力してください。", 400, id);
    const config = getAuthConfig();
    if (!verifyPassphrase(body.data.passphrase, config.appPassphraseHash)) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return failure("INVALID_CREDENTIALS", "パスフレーズが正しくありません。", 401, id);
    }
    await setSessionCookie();
    return NextResponse.json({ data: { authenticated: true }, meta: { requestId: id } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, id);
  }
}
