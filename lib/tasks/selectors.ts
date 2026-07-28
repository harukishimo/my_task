import { isDueThisWeek, isDueToday, isOverdue, todayInTokyo } from "./date";
import type { Task } from "@/types/task";

export function activeTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !task.isDeleted && task.status === "todo");
}

export function completedTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !task.isDeleted && task.status === "done");
}

export function dueByToday(tasks: Task[], today = todayInTokyo()): Task[] {
  return activeTasks(tasks).filter((task) => task.dueDate <= today);
}

export function dashboardMetrics(tasks: Task[], now = new Date()) {
  const active = activeTasks(tasks);
  const today = todayInTokyo(now);
  const overdue = active.filter((task) => isOverdue(task.dueDate, today));
  const dueToday = active.filter((task) => isDueToday(task.dueDate, today));
  const p1 = active.filter((task) => task.priority === "P1");
  const thisWeek = active.filter((task) => isDueThisWeek(task.dueDate, now));
  return {
    overdue,
    dueToday,
    thisWeek,
    p1,
    counts: {
      overdue: overdue.length,
      dueToday: dueToday.length,
      thisWeek: thisWeek.length,
      p1: p1.length,
    },
  };
}

export function prioritySort(tasks: Task[]): Task[] {
  const rank = { P1: 1, P2: 2, P3: 3, P4: 4 } as const;
  return [...tasks].sort((a, b) =>
    rank[a.priority] - rank[b.priority] ||
    a.dueDate.localeCompare(b.dueDate) ||
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function dueDateSort(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt),
  );
}

export function priorityTasks(tasks: Task[], now = new Date()): Task[] {
  const metrics = dashboardMetrics(tasks, now);
  const candidates = [...metrics.overdue, ...metrics.dueToday, ...metrics.p1, ...activeTasks(tasks)];
  const unique = new Map(candidates.map((task) => [task.id, task]));
  return [...unique.values()]
    .sort((a, b) => {
      const today = todayInTokyo(now);
      const urgency = Number(isOverdue(b.dueDate, today)) - Number(isOverdue(a.dueDate, today));
      const due = Number(isDueToday(b.dueDate, today)) - Number(isDueToday(a.dueDate, today));
      const rank = a.priority.localeCompare(b.priority);
      return urgency || due || rank || a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt);
    })
    .slice(0, 5);
}
