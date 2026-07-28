import { calculatePriority } from "@/lib/tasks/priority";
import type { CreateTaskInput, Task } from "@/types/task";

export const TASK_HEADERS = [
  "id", "title", "due_date", "is_urgent", "is_important", "priority",
  "status", "completed_at", "is_deleted", "created_at", "updated_at", "version", "comment",
] as const;

export const LEGACY_TASK_HEADERS = TASK_HEADERS.slice(0, -1);

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
  ];
}

export function rowToTask(row: string[], rowNumber?: number): Task | null {
  if (row.length === 0 || row.every((value) => value.trim() === "")) return null;
  if (row[0] === "id") return null;
  if (row.length < LEGACY_TASK_HEADERS.length) throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  const [id, title, dueDate, urgent, important, storedPriority, status, completedAt, deleted, createdAt, updatedAt, version, comment] = row;
  void storedPriority;
  if (!id || !title || !dueDate || !createdAt || !updatedAt) throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  const isUrgent = parseBoolean(urgent);
  const isImportant = parseBoolean(important);
  if (status !== "todo" && status !== "done") throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  const numericVersion = Number(version);
  if (!Number.isSafeInteger(numericVersion) || numericVersion < 1) throw new Error(`INVALID_ROW:${rowNumber ?? "unknown"}`);
  return {
    id,
    title,
    comment: comment?.trim() ?? "",
    dueDate,
    isUrgent,
    isImportant,
    priority: calculatePriority(isUrgent, isImportant),
    status,
    completedAt: completedAt || null,
    isDeleted: parseBoolean(deleted),
    createdAt,
    updatedAt,
    version: numericVersion,
  };
}

export function inputToTask(input: CreateTaskInput, now = new Date(), id = crypto.randomUUID()): Task {
  const timestamp = now.toISOString();
  return {
    id,
    title: input.title.trim(),
    comment: input.comment?.trim() ?? "",
    dueDate: input.dueDate,
    isUrgent: input.isUrgent,
    isImportant: input.isImportant,
    priority: calculatePriority(input.isUrgent, input.isImportant),
    status: "todo",
    completedAt: null,
    isDeleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

function parseBoolean(value: string): boolean {
  if (value === "TRUE" || value === "true") return true;
  if (value === "FALSE" || value === "false" || value === "") return false;
  throw new Error("INVALID_BOOLEAN");
}
