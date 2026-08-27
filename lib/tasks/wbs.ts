import { REVIEW_LABELS } from "@/lib/tasks/reviews";
import { todayInTokyo } from "@/lib/tasks/date";
import type { Task } from "@/types/task";

export const WBS_DAY_WIDTH = 56;
const RANGE_PAD_BEFORE = 1;
const RANGE_PAD_AFTER = 2;
const MAX_DAYS = 60;

export type WbsMarkerKey = "outline" | "mid" | "almost";

export type WbsMarker = {
  key: WbsMarkerKey;
  label: string;
  at: string;
  date: string;
  offset: number;
};

export type WbsRow = {
  taskId: string;
  title: string;
  startDate: string;
  dueDate: string;
  barLeft: number;
  barWidth: number;
  markers: WbsMarker[];
};

export type WbsChart = {
  days: string[];
  today: string;
  todayOffset: number;
  rows: WbsRow[];
};

export function tokyoDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? null;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function calendarDaysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  return Math.round((Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000);
}

export function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  const length = Math.max(0, calendarDaysBetween(start, end));
  for (let index = 0; index <= length; index += 1) days.push(addCalendarDays(start, index));
  return days;
}

function dayFraction(value: string | null): number {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return (Number(parts.hour) * 60 + Number(parts.minute)) / (24 * 60);
}

function offsetFor(date: string, rangeStart: string, at?: string | null): number {
  return calendarDaysBetween(rangeStart, date) * WBS_DAY_WIDTH + dayFraction(at ?? null) * WBS_DAY_WIDTH;
}

export function clampDueDate(startDate: string, nextDueDate: string): string {
  return nextDueDate < startDate ? startDate : nextDueDate;
}

export function buildWbsChart(tasks: Task[], today = todayInTokyo()): WbsChart {
  const active = tasks.filter((task) => !task.isDeleted && task.status === "todo");
  const dates = [today];
  for (const task of active) {
    dates.push(tokyoDateOnly(task.createdAt) ?? task.dueDate, task.dueDate);
    for (const marker of [task.reviewOutlineAt, task.reviewMidAt, task.reviewAlmostAt]) {
      const date = tokyoDateOnly(marker);
      if (date) dates.push(date);
    }
  }
  dates.sort();
  let rangeStart = addCalendarDays(dates[0] ?? today, -RANGE_PAD_BEFORE);
  let rangeEnd = addCalendarDays(dates.at(-1) ?? today, RANGE_PAD_AFTER);
  if (calendarDaysBetween(rangeStart, rangeEnd) + 1 > MAX_DAYS) {
    rangeStart = addCalendarDays(today, -7);
    rangeEnd = addCalendarDays(rangeStart, MAX_DAYS - 1);
  }
  const days = enumerateDays(rangeStart, rangeEnd);
  const rows = [...active]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title, "ja"))
    .map((task) => {
      const created = tokyoDateOnly(task.createdAt) ?? task.dueDate;
      const startDate = created <= task.dueDate ? created : task.dueDate;
      const markers: WbsMarker[] = (
        [
          ["outline", REVIEW_LABELS.outline, task.reviewOutlineAt],
          ["mid", REVIEW_LABELS.mid, task.reviewMidAt],
          ["almost", REVIEW_LABELS.almost, task.reviewAlmostAt],
        ] as const
      ).flatMap(([key, label, at]) => {
        const date = tokyoDateOnly(at);
        if (!date || date < rangeStart || date > rangeEnd) return [];
        return [{ key, label, at: at as string, date, offset: offsetFor(date, rangeStart, at) }];
      });
      return {
        taskId: task.id,
        title: task.title,
        startDate,
        dueDate: task.dueDate,
        barLeft: offsetFor(startDate, rangeStart),
        barWidth: Math.max(WBS_DAY_WIDTH, (calendarDaysBetween(startDate, task.dueDate) + 1) * WBS_DAY_WIDTH),
        markers,
      };
    });
  return {
    days,
    today,
    todayOffset: days.includes(today) ? calendarDaysBetween(rangeStart, today) * WBS_DAY_WIDTH : -1,
    rows,
  };
}
