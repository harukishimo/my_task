import type { Task } from "@/types/task";

export type ExecutionPriority = 1 | 2 | 3 | 4;

export const EXECUTION_PRIORITY_LABELS: Record<ExecutionPriority, string> = {
  1: "依頼を先に出す",
  2: "10分以内に終わらせる",
  3: "3営業日以内に分解する",
  4: "期日が近い順に進める",
};

export function isDecompositionRequired(task: Pick<Task, "estimatedWorkdays">): boolean {
  return task.estimatedWorkdays >= 3;
}

export function executionPriority(task: Pick<Task, "requiresRequest" | "isQuickTask" | "estimatedWorkdays">): ExecutionPriority {
  if (task.requiresRequest) return 1;
  if (task.isQuickTask) return 2;
  if (isDecompositionRequired(task)) return 3;
  return 4;
}

export function executionPrioritySort(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const rank = executionPriority(a) - executionPriority(b);
    if (rank !== 0) return rank;
    return a.dueDate.localeCompare(b.dueDate)
      || a.dueTime.localeCompare(b.dueTime)
      || a.priority.localeCompare(b.priority)
      || a.createdAt.localeCompare(b.createdAt)
      || a.title.localeCompare(b.title, "ja");
  });
}
