import { parseScheduleEventColor } from "@/lib/schedule/colors";
import type { CreateScheduleItemInput, ScheduleItem, ScheduleItemType } from "@/types/schedule";

export const SCHEDULE_HEADERS = [
  "id", "schedule_date", "start_time", "end_time", "item_type", "task_id", "title", "comment", "sort_order", "is_deleted", "created_at", "updated_at", "version", "color",
] as const;

export const LEGACY_SCHEDULE_HEADERS = SCHEDULE_HEADERS.slice(0, 13);

export function isKnownScheduleHeader(headers: string[]): boolean {
  return LEGACY_SCHEDULE_HEADERS.every((header, index) => headers[index] === header);
}

export function scheduleToRow(item: ScheduleItem): string[] {
  return [
    item.id,
    item.scheduleDate,
    item.startTime,
    item.endTime,
    item.itemType,
    item.taskId ?? "",
    item.title,
    item.comment,
    String(item.sortOrder),
    String(item.isDeleted).toUpperCase(),
    item.createdAt,
    item.updatedAt,
    String(item.version),
    item.color,
  ];
}

export function rowToSchedule(row: string[], rowNumber?: number): ScheduleItem | null {
  if (row.length === 0 || row.every((value) => value.trim() === "")) return null;
  if (row[0] === "id") return null;
  if (row.length < LEGACY_SCHEDULE_HEADERS.length) throw new Error(`INVALID_SCHEDULE_ROW:${rowNumber ?? "unknown"}`);
  const [id, scheduleDate, startTime, endTime, itemType, taskId, title, comment, sortOrder, deleted, createdAt, updatedAt, version] = row;
  if (!id || !scheduleDate || !startTime || !endTime || !title || !createdAt || !updatedAt) throw new Error(`INVALID_SCHEDULE_ROW:${rowNumber ?? "unknown"}`);
  if (!isValidTime(startTime) || !isValidTime(endTime) || toMinutes(endTime) <= toMinutes(startTime)) throw new Error(`INVALID_SCHEDULE_ROW:${rowNumber ?? "unknown"}`);
  if (itemType !== "task" && itemType !== "event") throw new Error(`INVALID_SCHEDULE_ROW:${rowNumber ?? "unknown"}`);
  if (itemType === "task" && !taskId) throw new Error(`INVALID_SCHEDULE_ROW:${rowNumber ?? "unknown"}`);
  const numericSortOrder = Number(sortOrder);
  const numericVersion = Number(version);
  if (!Number.isSafeInteger(numericSortOrder) || numericSortOrder < 1 || !Number.isSafeInteger(numericVersion) || numericVersion < 1) throw new Error(`INVALID_SCHEDULE_ROW:${rowNumber ?? "unknown"}`);
  return {
    id,
    scheduleDate,
    startTime,
    endTime,
    itemType: itemType as ScheduleItemType,
    taskId: taskId?.trim() || null,
    title: title.trim(),
    comment: comment?.trim() ?? "",
    color: parseScheduleEventColor(row[13]),
    sortOrder: numericSortOrder,
    isDeleted: parseBoolean(deleted),
    createdAt,
    updatedAt,
    version: numericVersion,
  };
}

export function inputToSchedule(input: CreateScheduleItemInput, now = new Date(), id = crypto.randomUUID(), sortOrder = 1): ScheduleItem {
  const timestamp = now.toISOString();
  return {
    id,
    scheduleDate: input.scheduleDate,
    startTime: input.startTime,
    endTime: input.endTime,
    itemType: input.itemType,
    taskId: input.taskId ?? null,
    title: input.title.trim(),
    comment: input.comment?.trim() ?? "",
    color: parseScheduleEventColor(input.color),
    sortOrder,
    isDeleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

export function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseBoolean(value: string): boolean {
  if (value === "TRUE" || value === "true") return true;
  if (value === "FALSE" || value === "false" || value === "") return false;
  throw new Error("INVALID_BOOLEAN");
}
