import { hasValidSession } from "@/lib/auth/session";
import { errorResponse, failure, isSameOrigin, jsonRequestHeaders, parseJsonBody, requestId, success } from "@/lib/api";
import { todayInTokyo } from "@/lib/tasks/date";
import { getScheduleRepository } from "@/lib/schedule/repository";
import { createScheduleSchema } from "@/lib/schedule/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId();
  try {
    if (!(await hasValidSession())) return failure("UNAUTHORIZED", "ログインが必要です。", 401, id);
    const date = new URL(request.url).searchParams.get("date") || todayInTokyo();
    const items = await getScheduleRepository().list(date);
    return success(items, 200, id);
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId();
  try {
    if (!(await hasValidSession())) return failure("UNAUTHORIZED", "ログインが必要です。", 401, id);
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "不正なリクエストです。", 403, id);
    if (!jsonRequestHeaders(request)) return failure("UNSUPPORTED_MEDIA_TYPE", "JSON形式で送信してください。", 415, id);
    const parsed = createScheduleSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return failure("VALIDATION_ERROR", "予定の入力内容を確認してください。", 400, id);
    const item = await getScheduleRepository().create(parsed.data);
    return success(item, 201, id);
  } catch (error) {
    return errorResponse(error, id);
  }
}
