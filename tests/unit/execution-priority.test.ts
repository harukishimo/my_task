import { describe, expect, it } from "vitest";
import { executionPriority, executionPrioritySort, isDecompositionRequired } from "@/lib/tasks/execution-priority";
import type { Task } from "@/types/task";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(), title: "task", comment: "", dueDate: "2026-09-12", dueTime: "19:00", isUrgent: false, isImportant: false,
    priority: "P4", status: "todo", completedAt: null, isDeleted: false, planDate: null, planOrder: null, category: "default",
    parentTaskId: null, requiresRequest: false, isQuickTask: false, estimatedWorkdays: 1,
    workHours: 0, reviewOutlineAt: null, reviewMidAt: null, reviewAlmostAt: null, reviewManual: false,
    createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z", version: 1, ...overrides,
  };
}

describe("single-task execution priority", () => {
  it("uses request, quick, decomposition, then due-date priority", () => {
    expect(executionPriority(task({ requiresRequest: true }))).toBe(1);
    expect(executionPriority(task({ isQuickTask: true }))).toBe(2);
    expect(executionPriority(task({ estimatedWorkdays: 3 }))).toBe(3);
    expect(executionPriority(task({ estimatedWorkdays: 2.75 }))).toBe(4);
  });

  it("recognizes a three-business-day task as requiring decomposition", () => {
    expect(isDecompositionRequired(task({ estimatedWorkdays: 3 }))).toBe(true);
    expect(isDecompositionRequired(task({ estimatedWorkdays: 2.99 }))).toBe(false);
  });

  it("sorts tasks by article priority before due date", () => {
    const sorted = executionPrioritySort([
      task({ id: "due", dueDate: "2026-09-10" }),
      task({ id: "quick", isQuickTask: true }),
      task({ id: "request", requiresRequest: true }),
      task({ id: "split", estimatedWorkdays: 3 }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["request", "quick", "split", "due"]);
  });
});
