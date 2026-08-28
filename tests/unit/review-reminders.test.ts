import { describe, expect, it } from "vitest";
import { dueScheduleOnDate, dueScheduleTitle, isDueSchedule, reviewReminderTitle, reviewRemindersOnDate } from "@/lib/tasks/review-reminders";
import type { Task } from "@/types/task";

function task(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    comment: "",
    dueDate: "2026-08-28",
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

describe("review reminders on the daily schedule", () => {
  it("formats reminders as schedule titles, not task names", () => {
    expect(reviewReminderTitle("大枠確認", "資料作成")).toBe("大枠確認：「資料作成」");
  });

  it("places today's three reviews as event blocks", () => {
    const items = reviewRemindersOnDate([
      task({
        id: "t1",
        title: "資料作成",
        reviewOutlineAt: "2026-08-28T17:30:00+09:00",
        reviewMidAt: "2026-08-28T17:45:00+09:00",
        reviewAlmostAt: "2026-08-28T18:15:00+09:00",
      }),
    ], "2026-08-28");

    expect(items.map((item) => item.title)).toEqual([
      "大枠確認：「資料作成」",
      "半分目の進捗確認：「資料作成」",
      "8割確認：「資料作成」",
    ]);
    expect(items.every((item) => item.itemType === "event")).toBe(true);
    expect(items.every((item) => item.taskId === null)).toBe(true);
    expect(items.map((item) => [item.startTime, item.endTime])).toEqual([
      ["17:30", "17:45"],
      ["17:45", "18:00"],
      ["18:15", "18:30"],
    ]);
  });

  it("omits reviews on other days and completed or deleted tasks", () => {
    const items = reviewRemindersOnDate([
      task({
        id: "other-day",
        title: "翌日",
        reviewOutlineAt: "2026-08-29T11:00:00+09:00",
        reviewMidAt: "2026-08-29T12:00:00+09:00",
        reviewAlmostAt: "2026-08-29T13:00:00+09:00",
      }),
      task({
        id: "done",
        title: "完了",
        status: "done",
        reviewOutlineAt: "2026-08-28T11:00:00+09:00",
      }),
      task({
        id: "gone",
        title: "削除",
        isDeleted: true,
        reviewOutlineAt: "2026-08-28T11:00:00+09:00",
      }),
    ], "2026-08-28");

    expect(items).toEqual([]);
  });

  it("places the last review at the stored 8割 time", () => {
    const items = reviewRemindersOnDate([
      task({
        id: "t1",
        title: "資料作成",
        reviewOutlineAt: "2026-08-28T11:00:00+09:00",
        reviewMidAt: "2026-08-28T12:45:00+09:00",
        reviewAlmostAt: "2026-08-28T14:30:00+09:00",
      }),
    ], "2026-08-28");

    expect(items.at(-1)).toMatchObject({
      title: "8割確認：「資料作成」",
      startTime: "14:30",
      endTime: "14:45",
    });
  });
});

describe("due date on the daily schedule", () => {
  it("shows the due date even when the three reminders are off", () => {
    const items = dueScheduleOnDate([
      task({ id: "t1", title: "資料作成", reviewManual: true }),
    ], "2026-08-28");

    expect(items).toHaveLength(1);
    expect(isDueSchedule(items[0])).toBe(true);
    expect(items[0]).toMatchObject({
      title: dueScheduleTitle("資料作成"),
      startTime: "19:00",
      endTime: "19:15",
      itemType: "task",
      taskId: "t1",
    });
    expect(dueScheduleTitle("資料作成")).toBe("完了期日：「資料作成」");
  });

  it("still shows the due date when review reminders exist", () => {
    const items = dueScheduleOnDate([
      task({
        id: "t1",
        title: "資料作成",
        reviewAlmostAt: "2026-08-28T14:30:00+09:00",
      }),
    ], "2026-08-28");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "完了期日：「資料作成」",
      startTime: "19:00",
    });
  });
});
