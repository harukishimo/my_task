import type { Priority } from "@/types/task";

export const PRIORITY_LABELS: Record<Priority, string> = {
  P1: "今すぐやる",
  P2: "予定する",
  P3: "手早くやる",
  P4: "あとで",
};

export function calculatePriority(isUrgent: boolean, isImportant: boolean): Priority {
  if (isUrgent && isImportant) return "P1";
  if (!isUrgent && isImportant) return "P2";
  if (isUrgent && !isImportant) return "P3";
  return "P4";
}
