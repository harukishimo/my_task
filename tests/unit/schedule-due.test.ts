import { describe, expect, it } from "vitest";
import { dueFieldsFromSchedule, scheduleRangeForTask, shouldSyncTaskDue, TASK_DAY_START_TIME } from "@/lib/tasks/schedule-due";

describe("schedule due sync", () => {
  it("pins task blocks to 09:00 and uses the chosen end as due time", () => {
    expect(TASK_DAY_START_TIME).toBe("09:00");
    expect(scheduleRangeForTask("15:00")).toEqual({ startTime: "09:00", endTime: "15:00" });
    expect(dueFieldsFromSchedule("2026-08-27", "15:00")).toEqual({
      dueDate: "2026-08-27",
      dueTime: "15:00",
    });
  });

  it("keeps the end after 09:00 when a slot is too early", () => {
    expect(scheduleRangeForTask("08:00")).toEqual({ startTime: "09:00", endTime: "09:30" });
    expect(scheduleRangeForTask("09:00")).toEqual({ startTime: "09:00", endTime: "09:30" });
  });

  it("syncs only task blocks that point at a task", () => {
    expect(shouldSyncTaskDue("task", "task-1")).toBe(true);
    expect(shouldSyncTaskDue("event", "task-1")).toBe(false);
    expect(shouldSyncTaskDue("task", null)).toBe(false);
  });
});
