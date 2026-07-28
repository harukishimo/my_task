import { describe, expect, it } from "vitest";
import { inputToTask, rowToTask, taskToRow, TASK_HEADERS } from "@/lib/sheets/mapper";

describe("Google Sheets mapper", () => {
  it("round-trips a task and recalculates priority", () => {
    const task = inputToTask({ title: "  シート確認  ", dueDate: "2026-07-27", isUrgent: true, isImportant: true }, new Date("2026-07-20T00:00:00.000Z"), "id-1");
    const mapped = rowToTask(taskToRow(task));
    expect(mapped?.title).toBe("シート確認");
    expect(mapped?.priority).toBe("P1");
    expect(mapped?.version).toBe(1);
  });
  it("ignores headers and empty rows", () => {
    expect(rowToTask([...TASK_HEADERS])).toBeNull();
    expect(rowToTask([])).toBeNull();
  });
  it("rejects malformed rows", () => {
    expect(() => rowToTask(["id-1", "title"])).toThrow();
  });
});
