import { describe, expect, it } from "vitest";
import { addCalendarDays, buildWbsChart, WBS_DAY_WIDTH } from "@/lib/tasks/wbs";
import type { Task } from "@/types/task";

function task(overrides: Partial<Task> & Pick<Task, "id" | "title" | "dueDate">): Task {
  return {
    comment: "",
    dueTime: "19:00",
    isUrgent: false,
    isImportant: false,
    priority: "P4",
    status: "todo",
    completedAt: null,
    isDeleted: false,
    planDate: null,
    planOrder: null,
    category: "default",
    workHours: 0,
    reviewOutlineAt: null,
    reviewMidAt: null,
    reviewAlmostAt: null,
    reviewManual: false,
    createdAt: "2026-08-20T01:00:00.000Z",
    updatedAt: "2026-08-20T01:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

describe("WBS chart layout", () => {
  it("stacks tasks on the vertical axis and days on the horizontal axis", () => {
    const chart = buildWbsChart([
      task({
        id: "a",
        title: "資料",
        dueDate: "2026-08-25",
        createdAt: "2026-08-20T01:00:00.000Z",
        reviewOutlineAt: "2026-08-21T11:00:00+09:00",
        reviewMidAt: "2026-08-22T12:00:00+09:00",
        reviewAlmostAt: "2026-08-23T15:00:00+09:00",
      }),
    ], "2026-08-21");

    expect(chart.days[0]).toBe("2026-08-19");
    expect(chart.days.at(-1)).toBe("2026-08-27");
    expect(chart.rows).toHaveLength(1);
    expect(chart.rows[0].startDate).toBe("2026-08-20");
    expect(chart.rows[0].dueDate).toBe("2026-08-25");
    expect(chart.rows[0].barWidth).toBe(6 * WBS_DAY_WIDTH);
    expect(chart.rows[0].markers.map((marker) => marker.key)).toEqual(["outline", "mid", "almost"]);
    expect(chart.rows[0].markers[0].date).toBe("2026-08-21");
  });

  it("moves the due date by whole days when the bar is stretched", () => {
    expect(addCalendarDays("2026-08-25", 3)).toBe("2026-08-28");
    expect(addCalendarDays("2026-08-01", -1)).toBe("2026-07-31");
  });
});
