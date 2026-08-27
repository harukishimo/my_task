import { toMinutes } from "@/lib/schedule/mapper";

export const TASK_DAY_START_TIME = "09:00";
export const DEFAULT_DAILY_BLOCK_MINUTES = 60;

const MIN_BLOCK_MINUTES = 30;
const MAX_END_MINUTES = 22 * 60;

function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function dailyBlockFromStart(startTime: string, durationMinutes = DEFAULT_DAILY_BLOCK_MINUTES): { startTime: string; endTime: string } {
  const startMinutes = toMinutes(startTime);
  const endMinutes = Math.min(MAX_END_MINUTES, Math.max(startMinutes + MIN_BLOCK_MINUTES, startMinutes + durationMinutes));
  return { startTime: minutesToTime(startMinutes), endTime: minutesToTime(endMinutes) };
}
