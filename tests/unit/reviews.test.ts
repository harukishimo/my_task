import { describe, expect, it } from "vitest";
import { applyReviewFields, calculateReviewSchedule, fromDateTimeLocal, toDateTimeLocal } from "@/lib/tasks/reviews";

describe("review schedule", () => {
  it("places today's 8:00 reminders on the nearest 15 minutes", () => {
    const schedule = calculateReviewSchedule("2026-08-27", new Date("2026-08-26T23:00:00.000Z"));
    expect(schedule.workHours).toBe(8);
    expect(schedule.reviewOutlineAt).toBe("2026-08-27T08:45:00+09:00");
    expect(schedule.reviewMidAt).toBe("2026-08-27T10:30:00+09:00");
    expect(schedule.reviewAlmostAt).toBe("2026-08-27T12:00:00+09:00");
  });

  it("skips Saturday and Sunday when adding work hours", () => {
    const schedule = calculateReviewSchedule("2026-08-31", new Date("2026-08-27T23:00:00.000Z"));
    expect(schedule.workHours).toBe(16);
    expect(schedule.reviewOutlineAt).toBe("2026-08-28T09:30:00+09:00");
    expect(schedule.reviewAlmostAt).toBe("2026-08-28T16:00:00+09:00");
  });

  it("returns empty review times when no work hours remain", () => {
    const schedule = calculateReviewSchedule("2026-08-27", new Date("2026-08-27T08:00:00.000Z"));
    expect(schedule.workHours).toBe(0);
    expect(schedule.reviewOutlineAt).toBeNull();
  });

  it("converts Tokyo review times for datetime-local inputs", () => {
    expect(toDateTimeLocal("2026-08-27T08:45:00+09:00")).toBe("2026-08-27T08:45");
    expect(fromDateTimeLocal("2026-08-27T10:30")).toBe("2026-08-27T10:30:00+09:00");
  });
});

describe("review field updates", () => {
  const current = {
    dueDate: "2026-08-27",
    workHours: 8,
    reviewOutlineAt: "2026-08-27T08:45:00+09:00",
    reviewMidAt: "2026-08-27T10:30:00+09:00",
    reviewAlmostAt: "2026-08-27T12:00:00+09:00",
    reviewManual: false,
  };

  it("keeps stored times when the manual flag is on", () => {
    const next = applyReviewFields(current, {
      reviewManual: true,
      reviewOutlineAt: "2026-08-27T09:00:00+09:00",
    }, new Date("2026-08-26T23:00:00.000Z"));
    expect(next.reviewManual).toBe(true);
    expect(next.reviewOutlineAt).toBe("2026-08-27T09:00:00+09:00");
    expect(next.reviewMidAt).toBe("2026-08-27T10:30:00+09:00");
  });

  it("recalculates from the update time when the manual flag is off", () => {
    const next = applyReviewFields({ ...current, reviewManual: true }, {
      reviewManual: false,
      dueDate: "2026-08-27",
    }, new Date("2026-08-26T23:00:00.000Z"));
    expect(next.reviewManual).toBe(false);
    expect(next.reviewOutlineAt).toBe("2026-08-27T08:45:00+09:00");
  });
});
