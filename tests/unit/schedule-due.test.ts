import { describe, expect, it } from "vitest";
import { dueFieldsFromSchedule, shouldSyncTaskDue } from "@/lib/tasks/schedule-due";

describe("schedule due sync", () => {
  it("uses the block end time as the task due time", () => {
    expect(dueFieldsFromSchedule("2026-08-27", "15:00")).toEqual({
      dueDate: "2026-08-27",
      dueTime: "15:00",
    });
  });

  it("syncs only task blocks that point at a task", () => {
    expect(shouldSyncTaskDue("task", "task-1")).toBe(true);
    expect(shouldSyncTaskDue("event", "task-1")).toBe(false);
    expect(shouldSyncTaskDue("task", null)).toBe(false);
  });
});
