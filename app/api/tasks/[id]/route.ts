import { hasValidSession } from "@/lib/auth/session";
import { errorResponse, failure, isSameOrigin, jsonRequestHeaders, parseJsonBody, requestId, success } from "@/lib/api";
import { getTaskRepository } from "@/lib/tasks/repository";
import { updateTaskSchema } from "@/lib/tasks/schema";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const id = requestId();
  try {
    if (!(await hasValidSession())) return failure("UNAUTHORIZED", "ログインが必要です。", 401, id);
    const task = await getTaskRepository().findById((await context.params).id);
    if (!task || task.isDeleted) return failure("NOT_FOUND", "対象のタスクが見つかりません。", 404, id);
    return success(task, 200, id);
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request, context: Context) {
  const id = requestId();
  try {
    if (!(await hasValidSession())) return failure("UNAUTHORIZED", "ログインが必要です。", 401, id);
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "不正なリクエストです。", 403, id);
    if (!jsonRequestHeaders(request)) return failure("UNSUPPORTED_MEDIA_TYPE", "JSON形式で送信してください。", 415, id);
    const parsed = updateTaskSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return failure("VALIDATION_ERROR", "入力内容を確認してください。", 400, id);
    const task = await getTaskRepository().update((await context.params).id, parsed.data);
    return success(task, 200, id);
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request, context: Context) {
  const id = requestId();
  try {
    if (!(await hasValidSession())) return failure("UNAUTHORIZED", "ログインが必要です。", 401, id);
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "不正なリクエストです。", 403, id);
    const version = Number(new URL(request.url).searchParams.get("version"));
    if (!Number.isSafeInteger(version) || version < 1) return failure("VALIDATION_ERROR", "更新番号が不正です。", 400, id);
    await getTaskRepository().remove((await context.params).id, version);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, id);
  }
}
