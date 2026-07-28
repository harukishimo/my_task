import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ConfigurationError, RepositoryUnavailableError, TaskConflictError, TaskNotFoundError } from "@/lib/tasks/errors";

export function requestId(): string {
  return randomUUID();
}

/** Parse request JSON without turning malformed client input into a 500. */
export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function success<T>(data: T, status = 200, id = requestId()): NextResponse {
  return NextResponse.json({ data, meta: { requestId: id } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(error: unknown, id = requestId()): NextResponse {
  if (error instanceof TaskConflictError) return failure("CONFLICT", "別の端末で更新されました。最新データを読み込み、もう一度編集してください。", 409, id);
  if (error instanceof TaskNotFoundError) return failure("NOT_FOUND", "対象のタスクが見つかりません。", 404, id);
  if (error instanceof ConfigurationError) return failure("CONFIGURATION_ERROR", "アプリの設定が未完了です。所有者へ設定を確認してください。", 500, id);
  if (error instanceof RepositoryUnavailableError) return failure("SHEETS_ERROR", "データを保存できませんでした。時間を置いて再試行してください。", 502, id);
  console.error(JSON.stringify({ event: "api_error", requestId: id, error: error instanceof Error ? error.name : "unknown" }));
  return failure("INTERNAL_ERROR", "処理に失敗しました。時間を置いて再試行してください。", 500, id);
}

export function failure(code: string, message: string, status: number, id = requestId()): NextResponse {
  return NextResponse.json({ error: { code, message }, meta: { requestId: id } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestUrl = new URL(request.url);
    const requestHosts = [
      requestUrl.host,
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
    ].filter((value): value is string => Boolean(value));
    return requestHosts.includes(originHost);
  } catch {
    return false;
  }
}

export function jsonRequestHeaders(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}
