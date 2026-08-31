import { describe, expect, it } from "vitest";
import { inputToSchedule, rowToSchedule, scheduleToRow, SCHEDULE_HEADERS } from "@/lib/schedule/mapper";

describe("Schedule mapper", () => {
  it("round-trips a free event", () => {
    const item = inputToSchedule({ scheduleDate: "2026-08-17", startTime: "12:00", endTime: "13:00", itemType: "event", title: "昼食", comment: "外で食べる" }, new Date("2026-08-16T00:00:00.000Z"), "schedule-1", 1);
    expect(rowToSchedule(scheduleToRow(item))).toMatchObject({ id: "schedule-1", title: "昼食", itemType: "event", taskId: null, startTime: "12:00", endTime: "13:00", color: "lavender" });
  });

  it("round-trips a chosen event color and treats a missing column as lavender", () => {
    const item = inputToSchedule({ scheduleDate: "2026-08-17", startTime: "15:00", endTime: "16:00", itemType: "event", title: "会議", color: "amber" }, new Date("2026-08-16T00:00:00.000Z"), "schedule-2", 1);
    expect(item.color).toBe("amber");
    expect(rowToSchedule(scheduleToRow(item))?.color).toBe("amber");
    expect(rowToSchedule(scheduleToRow(item).slice(0, 13))?.color).toBe("lavender");
  });

  it("ignores headers and rejects an invalid time range", () => {
    expect(rowToSchedule([...SCHEDULE_HEADERS])).toBeNull();
    const item = inputToSchedule({ scheduleDate: "2026-08-17", startTime: "10:00", endTime: "11:00", itemType: "task", taskId: "task-1", title: "タスク" });
    expect(() => rowToSchedule(scheduleToRow({ ...item, endTime: "09:00" }))).toThrow();
  });
});
