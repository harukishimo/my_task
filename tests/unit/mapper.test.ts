import { describe, expect, it } from "vitest";
import { inputToTask, rowToTask, taskToRow, TASK_HEADERS } from "@/lib/sheets/mapper";

describe("Google Sheets mapper", () => {
  it("round-trips a task and recalculates priority", () => {
    const task = inputToTask({ title: "  シート確認  ", comment: "  補足メモ  ", dueDate: "2026-07-27", isUrgent: true, isImportant: true, category: "private" }, new Date("2026-07-20T00:00:00.000Z"), "id-1");
    const mapped = rowToTask(taskToRow(task));
    expect(mapped?.title).toBe("シート確認");
    expect(mapped?.comment).toBe("補足メモ");
    expect(mapped?.priority).toBe("P1");
    expect(mapped?.category).toBe("private");
    expect(mapped?.dueTime).toBe("19:00");
    expect(mapped?.reviewManual).toBe(false);
    expect(mapped?.reviewOutlineAt).toBeTruthy();
    expect(mapped?.version).toBe(1);
  });
  it("round-trips today's execution plan fields", () => {
    const task = inputToTask({ title: "段取り", dueDate: "2026-08-10", isUrgent: false, isImportant: true }, new Date("2026-08-10T00:00:00.000Z"), "id-plan");
    const planned = { ...task, planDate: "2026-08-10", planOrder: 2 };
    expect(rowToTask(taskToRow(planned))).toMatchObject({ planDate: "2026-08-10", planOrder: 2 });
  });
  it("keeps legacy rows valid with an empty comment", () => {
    const task = inputToTask({ title: "旧形式", dueDate: "2026-07-27", isUrgent: false, isImportant: false }, new Date("2026-07-20T00:00:00.000Z"), "id-legacy");
    const legacy = rowToTask(taskToRow(task).slice(0, 13));
    expect(legacy?.comment).toBe("");
    expect(legacy?.category).toBe("default");
    expect(legacy?.dueTime).toBe("19:00");
  });
  it("defaults missing due_time on older review rows", () => {
    const task = inputToTask({ title: "時刻なし", dueDate: "2026-08-27", isUrgent: false, isImportant: false }, new Date("2026-08-27T01:00:00.000Z"), "id-time");
    const withoutTime = rowToTask(taskToRow(task).slice(0, 21));
    expect(withoutTime?.dueTime).toBe("19:00");
  });
  it("ignores headers and empty rows", () => {
    expect(rowToTask([...TASK_HEADERS])).toBeNull();
    expect(rowToTask([])).toBeNull();
  });
  it("rejects malformed rows", () => {
    expect(() => rowToTask(["id-1", "title"])).toThrow();
  });
});
