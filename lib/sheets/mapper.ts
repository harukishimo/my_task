import { calculatePriority } from "@/lib/tasks/priority";
import { calculateReviewSchedule, DEFAULT_DUE_TIME } from "@/lib/tasks/reviews";
import type { CreateTaskInput, Task } from "@/types/task";

export const TASK_HEADERS = [
  "id", "title", "due_date", "is_urgent", "is_important", "priority",
  "status", "completed_at", "is_deleted", "created_at", "updated_at", "version", "comment", "plan_date", "plan_order", "category",
  "work_hours", "review_outline_at", "review_mid_at", "review_almost_at", "review_manual", "due_time",
  "parent_task_id", "requires_request", "is_quick_task", "estimated_workdays",
] as const;

export const REVIEW_TASK_HEADERS = TASK_HEADERS.slice(0, 21);
export const CATEGORY_TASK_HEADERS = TASK_HEADERS.slice(0, 16);
export const PLAN_TASK_HEADERS = TASK_HEADERS.slice(0, 15);
export const COMMENT_TASK_HEADERS = TASK_HEADERS.slice(0, 13);
export const LEGACY_TASK_HEADERS = TASK_HEADERS.slice(0, 12);

export function taskToRow(task: Task): string[] {
  return [
    task.id,
    task.title,
    task.dueDate,
    String(task.isUrgent).toUpperCase(),
    String(task.isImportant).toUpperCase(),
    calculatePriority(task.isUrgent, task.isImportant),
    task.status,
    task.completedAt ?? "",
    String(task.isDeleted).toUpperCase(),
    task.createdAt,
    task.updatedAt,
    String(task.version),
    task.comment,
    task.planDate ?? "",
    task.planOrder === null ? "" : String(task.planOrder),
    task.category,
    task.workHours === 0 ? "0" : String(task.workHours),
    task.reviewOutlineAt ?? "",
    task.reviewMidAt ?? "",
    task.reviewAlmostAt ?? "",
    String(task.reviewManual).toUpperCase(),
    task.dueTime,
    task.parentTaskId ?? "",
    String(task.requiresRequest).toUpperCase(),
    String(task.isQuickTask).toUpperCase(),
    String(task.estimatedWorkdays),
  ];
}

export function rowToTask(row: string[], rowNumber?: number): Task | null {
  if (row.length === 0 || row.every((value) => value.trim() === "")) return null;
  if (row[0] === "id") return null;
  if (row.length < LEGACY_TASK_HEADERS.length) throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  const [id, title, dueDate, urgent, important, storedPriority, status, completedAt, deleted, createdAt, updatedAt, version, comment, planDate, planOrder, category, workHours, reviewOutlineAt, reviewMidAt, reviewAlmostAt, reviewManual, dueTime, parentTaskId, requiresRequest, isQuickTask, estimatedWorkdays] = row;
  void storedPriority;
  if (!id || !title || !dueDate || !createdAt || !updatedAt) throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  const isUrgent = parseBoolean(urgent);
  const isImportant = parseBoolean(important);
  if (status !== "todo" && status !== "done") throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  const numericVersion = Number(version);
  if (!Number.isSafeInteger(numericVersion) || numericVersion < 1) throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  const numericPlanOrder = planOrder?.trim() ? Number(planOrder) : null;
  if (numericPlanOrder !== null && (!Number.isSafeInteger(numericPlanOrder) || numericPlanOrder < 1)) throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  const normalizedCategory = category?.trim() || "default";
  if (normalizedCategory !== "default" && normalizedCategory !== "private") throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  return {
    id,
    title,
    comment: comment?.trim() ?? "",
    dueDate,
    dueTime: parseDueTime(dueTime),
    isUrgent,
    isImportant,
    priority: calculatePriority(isUrgent, isImportant),
    status,
    completedAt: completedAt || null,
    isDeleted: parseBoolean(deleted),
    planDate: planDate?.trim() || null,
    planOrder: numericPlanOrder,
    category: normalizedCategory,
    parentTaskId: parentTaskId?.trim() || null,
    requiresRequest: parseBoolean(requiresRequest ?? ""),
    isQuickTask: parseBoolean(isQuickTask ?? ""),
    estimatedWorkdays: parseWorkdays(estimatedWorkdays),
    workHours: parseWorkHours(workHours),
    reviewOutlineAt: reviewOutlineAt?.trim() || null,
    reviewMidAt: reviewMidAt?.trim() || null,
    reviewAlmostAt: reviewAlmostAt?.trim() || null,
    reviewManual: parseBoolean(reviewManual ?? ""),
    createdAt,
    updatedAt,
    version: numericVersion,
  };
}

export function inputToTask(input: CreateTaskInput, now = new Date(), id = crypto.randomUUID()): Task {
  const timestamp = now.toISOString();
  const dueTime = input.dueTime || DEFAULT_DUE_TIME;
  const category = input.category ?? "default";
  const reviewInput = { dueDate: input.dueDate, dueTime, category };
  return {
    id,
    title: input.title.trim(),
    comment: input.comment?.trim() ?? "",
    dueDate: input.dueDate,
    dueTime,
    isUrgent: input.isUrgent,
    isImportant: input.isImportant,
    priority: calculatePriority(input.isUrgent, input.isImportant),
    status: "todo",
    completedAt: null,
    isDeleted: false,
    planDate: null,
    planOrder: null,
    category,
    parentTaskId: input.parentTaskId ?? null,
    requiresRequest: input.requiresRequest ?? false,
    isQuickTask: input.isQuickTask ?? false,
    estimatedWorkdays: input.estimatedWorkdays ?? 1,
    ...(input.reviewManual
      ? {
          workHours: calculateReviewSchedule(reviewInput, now).workHours,
          reviewOutlineAt: input.reviewOutlineAt ?? null,
          reviewMidAt: input.reviewMidAt ?? null,
          reviewAlmostAt: input.reviewAlmostAt ?? null,
          reviewManual: true,
        }
      : { ...calculateReviewSchedule(reviewInput, now), reviewManual: false }),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

function parseDueTime(value: string | undefined): string {
  return value?.trim() || DEFAULT_DUE_TIME;
}

function parseWorkHours(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`INVALID_ROW`);
  return parsed;
}

function parseWorkdays(value: string | undefined): number {
  if (!value?.trim()) return 1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.25 || parsed > 365) throw new Error(`INVALID_ROW`);
  return parsed;
}

function parseBoolean(value: string): boolean {
  if (value === "TRUE" || value === "true") return true;
  if (value === "FALSE" || value === "false" || value === "") return false;
  throw new Error("INVALID_BOOLEAN");
}
