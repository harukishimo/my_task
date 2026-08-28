import { describe, expect, it } from "vitest";
import { applyReviewFields, calculateReviewSchedule, formatDueLabel, fromDateTimeLocal, toDateTimeLocal } from "@/lib/tasks/reviews";

const thursdayTen = new Date("2026-08-27T01:00:00.000Z");
const fridayTen = new Date("2026-08-28T01:00:00.000Z");

describe("review schedule", () => {
  it("places today's 10:00 reminders on the nearest 15 minutes", () => {
    const schedule = calculateReviewSchedule({ dueDate: "2026-08-27" }, thursdayTen);
    expect(schedule.workHours).toBe(9);
    expect(schedule.reviewOutlineAt).toBe("2026-08-27T11:00:00+09:00");
    expect(schedule.reviewMidAt).toBe("2026-08-27T12:45:00+09:00");
    expect(schedule.reviewAlmostAt).toBe("2026-08-27T19:00:00+09:00");
  });

  it("clamps a due time after 19:00 to the end of the workday", () => {
    const late = calculateReviewSchedule({ dueDate: "2026-08-27", dueTime: "21:00" }, thursdayTen);
    const atEnd = calculateReviewSchedule({ dueDate: "2026-08-27", dueTime: "19:00" }, thursdayTen);
    expect(late).toEqual(atEnd);
  });

  it("stops remaining hours at an earlier due time", () => {
    const schedule = calculateReviewSchedule({ dueDate: "2026-08-27", dueTime: "14:00" }, thursdayTen);
    expect(schedule.workHours).toBe(4);
    expect(schedule.reviewOutlineAt).toBe("2026-08-27T10:30:00+09:00");
    expect(schedule.reviewMidAt).toBe("2026-08-27T11:15:00+09:00");
    expect(schedule.reviewAlmostAt).toBe("2026-08-27T14:00:00+09:00");
  });

  it("skips Saturday and Sunday for default tasks", () => {
    const schedule = calculateReviewSchedule({ dueDate: "2026-08-31" }, fridayTen);
    expect(schedule.workHours).toBe(18);
    expect(schedule.reviewOutlineAt).toBe("2026-08-28T11:45:00+09:00");
    expect(schedule.reviewAlmostAt).toBe("2026-08-31T19:00:00+09:00");
  });

  it("includes Saturday and Sunday for private tasks", () => {
    const schedule = calculateReviewSchedule({ dueDate: "2026-08-31", category: "private" }, fridayTen);
    expect(schedule.workHours).toBe(36);
    expect(schedule.reviewOutlineAt).toBe("2026-08-28T13:30:00+09:00");
    expect(schedule.reviewAlmostAt).toBe("2026-08-31T19:00:00+09:00");
  });

  it("returns empty review times when no work hours remain", () => {
    const schedule = calculateReviewSchedule({ dueDate: "2026-08-27" }, new Date("2026-08-27T10:00:00.000Z"));
    expect(schedule.workHours).toBe(0);
    expect(schedule.reviewOutlineAt).toBeNull();
  });

  it("converts Tokyo review times for datetime-local inputs", () => {
    expect(toDateTimeLocal("2026-08-27T11:00:00+09:00")).toBe("2026-08-27T11:00");
    expect(fromDateTimeLocal("2026-08-27T12:45")).toBe("2026-08-27T12:45:00+09:00");
  });

  it("formats due date and time for lists", () => {
    expect(formatDueLabel("2026-08-27", "19:00")).toBe("2026-08-27 19:00");
  });
});

describe("review field updates", () => {
  const current = {
    dueDate: "2026-08-27",
    dueTime: "19:00",
    category: "default" as const,
    workHours: 9,
    reviewOutlineAt: "2026-08-27T11:00:00+09:00",
    reviewMidAt: "2026-08-27T12:45:00+09:00",
    reviewAlmostAt: "2026-08-27T14:30:00+09:00",
    reviewManual: false,
  };

  it("keeps stored times when the manual flag is on", () => {
    const next = applyReviewFields(current, {
      reviewManual: true,
      reviewOutlineAt: "2026-08-27T11:15:00+09:00",
    }, thursdayTen);
    expect(next.reviewManual).toBe(true);
    expect(next.reviewOutlineAt).toBe("2026-08-27T11:15:00+09:00");
    expect(next.reviewMidAt).toBe("2026-08-27T12:45:00+09:00");
  });

  it("recalculates from the update time when the manual flag is off", () => {
    const next = applyReviewFields({ ...current, reviewManual: true }, {
      reviewManual: false,
      dueDate: "2026-08-27",
    }, thursdayTen);
    expect(next.reviewManual).toBe(false);
    expect(next.reviewOutlineAt).toBe("2026-08-27T11:00:00+09:00");
  });

  it("recalculates when due time or category changes and the manual flag is off", () => {
    const byTime = applyReviewFields(current, { dueTime: "14:00" }, thursdayTen);
    expect(byTime.workHours).toBe(4);
    const byCategory = applyReviewFields({ ...current, dueDate: "2026-08-31" }, { dueDate: "2026-08-31", category: "private" }, fridayTen);
    expect(byCategory.workHours).toBe(36);
  });
});
