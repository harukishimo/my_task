import { describe, expect, it } from "vitest";
import { calculatePriority } from "@/lib/tasks/priority";
import { isDueByToday, isDueThisWeek, isDueToday, isOverdue, overdueDays } from "@/lib/tasks/date";
import { dashboardMetrics, priorityTasks } from "@/lib/tasks/selectors";
import type { Task } from "@/types/task";

const task = (overrides: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(), title: "task", comment: "", dueDate: "2026-07-27", isUrgent: false, isImportant: false,
  priority: "P4", status: "todo", completedAt: null, isDeleted: false, planDate: null, planOrder: null,
  createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z", version: 1, ...overrides,
});

describe("priority", () => {
  it.each([
    [true, true, "P1"], [false, true, "P2"], [true, false, "P3"], [false, false, "P4"],
  ])("calculates %s/%s as %s", (urgent, important, expected) => {
    expect(calculatePriority(urgent, important)).toBe(expected);
  });
});

describe("Tokyo date selectors", () => {
  it("uses the Tokyo calendar date around UTC midnight", () => {
    expect(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date("2026-07-26T15:00:00.000Z"))).toBe("2026-07-27");
  });
  it("classifies overdue and today without Date timezone conversion", () => {
    expect(isOverdue("2026-07-26", "2026-07-27")).toBe(true);
    expect(isDueToday("2026-07-27", "2026-07-27")).toBe(true);
    expect(isDueByToday("2026-07-27", "2026-07-27")).toBe(true);
    expect(overdueDays("2026-07-24", "2026-07-27")).toBe(3);
  });
  it("treats Monday through Sunday as one week", () => {
    expect(isDueThisWeek("2026-07-27", new Date("2026-07-27T02:00:00.000Z"))).toBe(true);
    expect(isDueThisWeek("2026-08-02", new Date("2026-07-27T02:00:00.000Z"))).toBe(true);
    expect(isDueThisWeek("2026-08-03", new Date("2026-07-27T02:00:00.000Z"))).toBe(false);
  });
});

describe("dashboard selectors", () => {
  it("excludes completed/deleted tasks and counts active work", () => {
    const tasks = [
      task({ id: "overdue", dueDate: "2026-07-26", isUrgent: true, isImportant: true, priority: "P1" }),
      task({ id: "today", dueDate: "2026-07-27" }),
      task({ id: "done", status: "done" }),
      task({ id: "deleted", isDeleted: true }),
    ];
    const metrics = dashboardMetrics(tasks, new Date("2026-07-27T02:00:00.000Z"));
    expect(metrics.counts.overdue).toBe(1);
    expect(metrics.counts.dueToday).toBe(1);
    expect(metrics.counts.p1).toBe(1);
  });
  it("prioritizes overdue, today, then priority and limits to five", () => {
    const tasks = Array.from({ length: 7 }, (_, index) => task({ id: String(index), dueDate: `2026-07-${String(20 + index).padStart(2, "0")}`, priority: "P4" }));
    expect(priorityTasks(tasks, new Date("2026-07-27T02:00:00.000Z"))).toHaveLength(5);
    expect(priorityTasks(tasks, new Date("2026-07-27T02:00:00.000Z"))[0].dueDate).toBe("2026-07-20");
  });
});
