import type { ScheduleEventColor } from "@/types/schedule";

export const SCHEDULE_EVENT_COLORS = ["lavender", "sky", "amber", "coral", "rose", "slate"] as const satisfies readonly ScheduleEventColor[];

export type { ScheduleEventColor };

export const DEFAULT_SCHEDULE_EVENT_COLOR: ScheduleEventColor = "lavender";

export const SCHEDULE_EVENT_COLOR_LABELS: Record<ScheduleEventColor, string> = {
  lavender: "ラベンダー",
  sky: "スカイ",
  amber: "アンバー",
  coral: "コーラル",
  rose: "ローズ",
  slate: "グレー",
};

export function isScheduleEventColor(value: string): value is ScheduleEventColor {
  return (SCHEDULE_EVENT_COLORS as readonly string[]).includes(value);
}

export function parseScheduleEventColor(value: string | null | undefined): ScheduleEventColor {
  const trimmed = value?.trim() ?? "";
  return isScheduleEventColor(trimmed) ? trimmed : DEFAULT_SCHEDULE_EVENT_COLOR;
}
