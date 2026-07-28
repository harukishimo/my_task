import { hasValidSession } from "@/lib/auth/session";
import { errorResponse, failure, isSameOrigin, jsonRequestHeaders, parseJsonBody, requestId, success } from "@/lib/api";
import { getTaskRepository } from "@/lib/tasks/repository";
import { createTaskSchema } from "@/lib/tasks/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId();
  try {
    if (!(await hasValidSession())) return failure("UNAUTHORIZED", "ログインが必要です。", 401, id);
    const includeCompleted = new URL(request.url).searchParams.get("includeCompleted") === "true";
    const tasks = await getTaskRepository().list({ includeCompleted });
    return success(tasks, 200, id);
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
    const parsed = createTaskSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return failure("VALIDATION_ERROR", "入力内容を確認してください。", 400, id);
    const task = await getTaskRepository().create(parsed.data);
    return success(task, 201, id);
  } catch (error) {
    return errorResponse(error, id);
  }
}
