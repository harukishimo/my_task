import type { ScheduleItem } from "@/types/schedule";
import type { Task } from "@/types/task";
import { REVIEW_LABELS, toDateTimeLocal } from "@/lib/tasks/reviews";

export const REVIEW_REMINDER_ID_PREFIX = "review:";
export const DUE_SCHEDULE_ID_PREFIX = "due:";
const REVIEW_DURATION_MINUTES = 15;

const REVIEW_KEYS = [
  ["outline", REVIEW_LABELS.outline, (task: Task) => task.reviewOutlineAt],
  ["mid", REVIEW_LABELS.mid, (task: Task) => task.reviewMidAt],
  ["almost", REVIEW_LABELS.almost, (task: Task) => task.reviewAlmostAt],
] as const;

export function reviewReminderTitle(label: string, taskTitle: string): string {
  return `${label}：「${taskTitle}」`;
}

export function dueScheduleTitle(taskTitle: string): string {
  return `完了期日：「${taskTitle}」`;
}

export function isReviewReminder(item: Pick<ScheduleItem, "id">): boolean {
  return item.id.startsWith(REVIEW_REMINDER_ID_PREFIX);
}

export function isDueSchedule(item: Pick<ScheduleItem, "id">): boolean {
  return item.id.startsWith(DUE_SCHEDULE_ID_PREFIX);
}

export function isDerivedSchedule(item: Pick<ScheduleItem, "id">): boolean {
  return isReviewReminder(item) || isDueSchedule(item);
}

export function reviewReminderTaskId(itemId: string): string | null {
  const match = itemId.match(/^review:([^:]+):(outline|mid|almost)$/);
  return match?.[1] ?? null;
}

export function dueScheduleTaskId(itemId: string): string | null {
  const match = itemId.match(/^due:(.+)$/);
  return match?.[1] ?? null;
}

export function derivedScheduleTaskId(itemId: string): string | null {
  return reviewReminderTaskId(itemId) ?? dueScheduleTaskId(itemId);
}

export function reviewRemindersOnDate(tasks: Task[], date: string): ScheduleItem[] {
  return tasks.flatMap((task) => {
    if (task.isDeleted || task.status !== "todo") return [];
    return REVIEW_KEYS.flatMap(([key, label, readAt]) => {
      const parsed = parseReviewAt(readAt(task));
      if (!parsed || parsed.date !== date) return [];
      const endTime = addMinutesToTime(parsed.time, REVIEW_DURATION_MINUTES);
      if (!endTime) return [];
      return [{
        id: `${REVIEW_REMINDER_ID_PREFIX}${task.id}:${key}`,
        scheduleDate: date,
        startTime: parsed.time,
        endTime,
        itemType: "event" as const,
        taskId: null,
        title: reviewReminderTitle(label, task.title),
        comment: "",
        sortOrder: 0,
        isDeleted: false,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        version: 1,
      }];
    });
  }).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title, "ja"));
}

export function dueScheduleOnDate(tasks: Task[], date: string): ScheduleItem[] {
  return tasks.flatMap((task) => {
    if (task.isDeleted || task.status !== "todo" || task.dueDate !== date) return [];
    const endTime = addMinutesToTime(task.dueTime, REVIEW_DURATION_MINUTES);
    if (!endTime) return [];
    return [{
      id: `${DUE_SCHEDULE_ID_PREFIX}${task.id}`,
      scheduleDate: date,
      startTime: task.dueTime,
      endTime,
      itemType: "task" as const,
      taskId: task.id,
      title: dueScheduleTitle(task.title),
      comment: "",
      sortOrder: 0,
      isDeleted: false,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      version: 1,
    }];
  }).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title, "ja"));
}

function parseReviewAt(value: string | null): { date: string; time: string } | null {
  const local = toDateTimeLocal(value);
  if (!local) return null;
  const [date, time] = local.split("T");
  if (!date || !time) return null;
  return { date, time };
}

function addMinutesToTime(time: string, minutes: number): string | null {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  if (total <= hour * 60 + minute || total > 23 * 60 + 59) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
