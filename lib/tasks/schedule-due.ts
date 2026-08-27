import { toMinutes } from "@/lib/schedule/mapper";

export const TASK_DAY_START_TIME = "09:00";

const MIN_TASK_END_MINUTES = 9 * 60 + 30;
const MAX_TASK_END_MINUTES = 22 * 60;

function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function scheduleRangeForTask(endTime: string): { startTime: string; endTime: string } {
  const endMinutes = Math.min(MAX_TASK_END_MINUTES, Math.max(MIN_TASK_END_MINUTES, toMinutes(endTime)));
  return { startTime: TASK_DAY_START_TIME, endTime: minutesToTime(endMinutes) };
}

export function dueFieldsFromSchedule(scheduleDate: string, endTime: string): { dueDate: string; dueTime: string } {
  return { dueDate: scheduleDate, dueTime: scheduleRangeForTask(endTime).endTime };
}

export function shouldSyncTaskDue(itemType: string, taskId: string | null | undefined): taskId is string {
  return itemType === "task" && Boolean(taskId);
}
