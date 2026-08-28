import type { Task, TaskCategory, UpdateTaskInput } from "@/types/task";

const TIME_ZONE = "Asia/Tokyo";
const WORK_START_MINUTES = 10 * 60;
const WORK_END_MINUTES = 19 * 60;
const REVIEW_RATIOS = { outline: 0.1, mid: 0.3 } as const;

export const DEFAULT_DUE_TIME = "19:00";

export const REVIEW_LABELS = {
  outline: "大枠確認",
  mid: "半分目の進捗確認",
  almost: "8割確認",
} as const;

export type ReviewSchedule = {
  workHours: number;
  reviewOutlineAt: string | null;
  reviewMidAt: string | null;
  reviewAlmostAt: string | null;
};

export type ReviewCalculationInput = {
  dueDate: string;
  dueTime?: string;
  category?: TaskCategory;
};

type TokyoParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

export function calculateReviewSchedule(input: ReviewCalculationInput, now = new Date()): ReviewSchedule {
  const includeWeekends = input.category === "private";
  const start = snapToWorkStart(now, includeWeekends);
  const deadline = dueDeadline(input.dueDate, input.dueTime);
  const remainingMinutes = workMinutesBetween(start, deadline, includeWeekends);
  const workHours = Math.round((remainingMinutes / 60) * 100) / 100;
  if (remainingMinutes <= 0) {
    return { workHours: 0, reviewOutlineAt: null, reviewMidAt: null, reviewAlmostAt: null };
  }
  return {
    workHours,
    reviewOutlineAt: formatReviewDateTime(roundReviewTime(addWorkMinutes(start, remainingMinutes * REVIEW_RATIOS.outline, includeWeekends), start)),
    reviewMidAt: formatReviewDateTime(roundReviewTime(addWorkMinutes(start, remainingMinutes * REVIEW_RATIOS.mid, includeWeekends), start)),
    reviewAlmostAt: formatReviewDateTime(deadline),
  };
}

export function formatDueLabel(dueDate: string, dueTime = DEFAULT_DUE_TIME): string {
  return `${dueDate} ${dueTime || DEFAULT_DUE_TIME}`;
}

export function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const parts = tokyoParts(date);
  return `${ymd(parts)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function fromDateTimeLocal(value: string): string | null {
  if (!value.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00+09:00`;
}

export function applyReviewFields(
  current: Pick<Task, "dueDate" | "dueTime" | "category" | "workHours" | "reviewOutlineAt" | "reviewMidAt" | "reviewAlmostAt" | "reviewManual">,
  input: Pick<UpdateTaskInput, "dueDate" | "dueTime" | "category" | "reviewOutlineAt" | "reviewMidAt" | "reviewAlmostAt" | "reviewManual">,
  now = new Date(),
): ReviewSchedule & { reviewManual: boolean } {
  const dueDate = input.dueDate ?? current.dueDate;
  const dueTime = input.dueTime ?? current.dueTime;
  const category = input.category ?? current.category;
  if (input.reviewManual === false) {
    return { ...calculateReviewSchedule({ dueDate, dueTime, category }, now), reviewManual: false };
  }
  if (input.reviewManual === true || current.reviewManual) {
    return {
      workHours: current.workHours,
      reviewOutlineAt: input.reviewOutlineAt !== undefined ? input.reviewOutlineAt : current.reviewOutlineAt,
      reviewMidAt: input.reviewMidAt !== undefined ? input.reviewMidAt : current.reviewMidAt,
      reviewAlmostAt: input.reviewAlmostAt !== undefined ? input.reviewAlmostAt : current.reviewAlmostAt,
      reviewManual: true,
    };
  }
  if (
    (input.dueDate !== undefined && input.dueDate !== current.dueDate) ||
    (input.dueTime !== undefined && input.dueTime !== current.dueTime) ||
    (input.category !== undefined && input.category !== current.category)
  ) {
    return { ...calculateReviewSchedule({ dueDate, dueTime, category }, now), reviewManual: false };
  }
  return {
    workHours: current.workHours,
    reviewOutlineAt: current.reviewOutlineAt,
    reviewMidAt: current.reviewMidAt,
    reviewAlmostAt: current.reviewAlmostAt,
    reviewManual: false,
  };
}

function snapToWorkStart(now: Date, includeWeekends: boolean): Date {
  const parts = tokyoParts(now);
  if ((!includeWeekends && isWeekend(parts)) || minutesOfDay(parts) >= WORK_END_MINUTES) {
    return startOfWorkday(nextWorkday(parts, includeWeekends));
  }
  if (minutesOfDay(parts) < WORK_START_MINUTES) return startOfWorkday(parts);
  return tokyoDate(parts.year, parts.month, parts.day, parts.hour, parts.minute);
}

function dueDeadline(dueDate: string, dueTime = DEFAULT_DUE_TIME): Date {
  const [year, month, day] = dueDate.split("-").map(Number);
  const total = Math.min(parseTimeMinutes(dueTime), WORK_END_MINUTES);
  return tokyoDate(year, month, day, Math.floor(total / 60), total % 60);
}

function parseTimeMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return WORK_END_MINUTES;
  return Number(match[1]) * 60 + Number(match[2]);
}

function workMinutesBetween(start: Date, end: Date, includeWeekends: boolean): number {
  if (end.getTime() <= start.getTime()) return 0;
  let cursor = start;
  let total = 0;
  for (let step = 0; step < 400 && cursor.getTime() < end.getTime(); step += 1) {
    const parts = tokyoParts(cursor);
    if (!includeWeekends && isWeekend(parts)) {
      cursor = startOfWorkday(nextWorkday(parts, includeWeekends));
      continue;
    }
    const dayStart = startOfWorkday(parts);
    const dayEnd = workDayEnd(parts);
    const from = cursor.getTime() < dayStart.getTime() ? dayStart : cursor;
    const to = end.getTime() < dayEnd.getTime() ? end : dayEnd;
    if (to.getTime() > from.getTime()) total += (to.getTime() - from.getTime()) / 60_000;
    cursor = startOfWorkday(nextCalendarDay(parts));
  }
  return Math.max(0, total);
}

function addWorkMinutes(start: Date, minutes: number, includeWeekends: boolean): Date {
  let remaining = minutes;
  let cursor = start;
  for (let step = 0; step < 400 && remaining > 0; step += 1) {
    const parts = tokyoParts(cursor);
    if ((!includeWeekends && isWeekend(parts)) || minutesOfDay(parts) >= WORK_END_MINUTES) {
      cursor = startOfWorkday(nextWorkday(parts, includeWeekends));
      continue;
    }
    if (minutesOfDay(parts) < WORK_START_MINUTES) cursor = startOfWorkday(parts);
    const current = tokyoParts(cursor);
    const dayEnd = workDayEnd(current);
    const available = (dayEnd.getTime() - cursor.getTime()) / 60_000;
    if (remaining <= available) return new Date(cursor.getTime() + remaining * 60_000);
    remaining -= available;
    cursor = startOfWorkday(nextWorkday(tokyoParts(dayEnd), includeWeekends));
  }
  return cursor;
}

function roundReviewTime(date: Date, start: Date): Date {
  const rounded = roundToNearestQuarter(date);
  if (rounded.getTime() >= start.getTime()) return rounded;
  return nextQuarter(start);
}

function roundToNearestQuarter(date: Date): Date {
  const parts = tokyoParts(date);
  const roundedMinutes = Math.round((parts.hour * 60 + parts.minute + parts.second / 60) / 15) * 15;
  return tokyoDateFromMinutes(parts, roundedMinutes);
}

function nextQuarter(date: Date): Date {
  const parts = tokyoParts(date);
  const current = parts.hour * 60 + parts.minute + (parts.second > 0 ? 1 : 0);
  return tokyoDateFromMinutes(parts, Math.ceil(current / 15) * 15);
}

function tokyoDateFromMinutes(parts: TokyoParts, totalMinutes: number): Date {
  const extraDays = Math.floor(totalMinutes / (24 * 60));
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const next = extraDays === 0 ? parts : shiftDays(parts, extraDays);
  return tokyoDate(next.year, next.month, next.day, Math.floor(normalized / 60), normalized % 60);
}

function startOfWorkday(parts: Pick<TokyoParts, "year" | "month" | "day">): Date {
  return tokyoDate(parts.year, parts.month, parts.day, 10, 0);
}

function workDayEnd(parts: Pick<TokyoParts, "year" | "month" | "day">): Date {
  return tokyoDate(parts.year, parts.month, parts.day, 19, 0);
}

function nextWorkday(parts: TokyoParts, includeWeekends: boolean): TokyoParts {
  let next = nextCalendarDay(parts);
  if (includeWeekends) return next;
  while (isWeekend(next)) next = nextCalendarDay(next);
  return next;
}

function nextCalendarDay(parts: Pick<TokyoParts, "year" | "month" | "day">): TokyoParts {
  return shiftDays(parts, 1);
}

function shiftDays(parts: Pick<TokyoParts, "year" | "month" | "day">, days: number): TokyoParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 3, 0, 0));
  return tokyoParts(shifted);
}

function tokyoParts(date: Date): TokyoParts {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(format.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: values.weekday,
  };
}

function tokyoDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`);
}

function formatReviewDateTime(date: Date): string {
  const parts = tokyoParts(date);
  return `${ymd(parts)}T${pad(parts.hour)}:${pad(parts.minute)}:00+09:00`;
}

function ymd(parts: Pick<TokyoParts, "year" | "month" | "day">): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function minutesOfDay(parts: Pick<TokyoParts, "hour" | "minute">): number {
  return parts.hour * 60 + parts.minute;
}

function isWeekend(parts: Pick<TokyoParts, "weekday">): boolean {
  return parts.weekday === "Sat" || parts.weekday === "Sun";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
