import { describe, expect, it } from "vitest";
import { dailyBlockFromStart, TASK_DAY_START_TIME } from "@/lib/tasks/schedule-due";

describe("daily schedule blocks", () => {
  it("places a 60-minute block from the dropped start time", () => {
    expect(TASK_DAY_START_TIME).toBe("09:00");
    expect(dailyBlockFromStart("14:00")).toEqual({ startTime: "14:00", endTime: "15:00" });
    expect(dailyBlockFromStart(TASK_DAY_START_TIME)).toEqual({ startTime: "09:00", endTime: "10:00" });
  });

  it("keeps an existing duration when the block is moved", () => {
    expect(dailyBlockFromStart("11:00", 90)).toEqual({ startTime: "11:00", endTime: "12:30" });
  });
});
