import { describe, expect, it } from "vitest";
import { InMemoryTaskRepository } from "@/lib/tasks/in-memory-repository";
import { InMemoryScheduleRepository } from "@/lib/schedule/in-memory-repository";

describe("TaskRepository contract", () => {
  it("stores the private category in the same task repository", async () => {
    const repository = new InMemoryTaskRepository();
    const created = await repository.create({ title: "個人用", dueDate: "2026-07-27", isUrgent: false, isImportant: false, category: "private" });
    expect(created.category).toBe("private");
    expect(await repository.list()).toEqual([created]);
  });

  it("creates, updates, completes, restores, and logically deletes", async () => {
    const repository = new InMemoryTaskRepository();
    const created = await repository.create({ title: "検証する", dueDate: "2026-07-27", isUrgent: false, isImportant: true });
    expect(created.priority).toBe("P2");
    expect(created.reviewManual).toBe(false);
    expect(created.dueTime).toBe("19:00");
    expect(created).toHaveProperty("workHours");
    const completed = await repository.update(created.id, { status: "done", version: created.version });
    expect(completed.completedAt).not.toBeNull();
    const restored = await repository.update(created.id, { status: "todo", version: completed.version });
    expect(restored.completedAt).toBeNull();
    await repository.remove(created.id, restored.version);
    expect(await repository.list({ includeCompleted: true })).toEqual([]);
  });

  it("rejects stale versions", async () => {
    const repository = new InMemoryTaskRepository();
    const created = await repository.create({ title: "競合", dueDate: "2026-07-27", isUrgent: false, isImportant: false });
    await expect(repository.update(created.id, { title: "先に更新", version: created.version })).resolves.toMatchObject({ version: 2 });
    await expect(repository.update(created.id, { title: "古い更新", version: created.version })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("ScheduleRepository contract", () => {
  it("creates, moves, lists, and removes a schedule item", async () => {
    const repository = new InMemoryScheduleRepository();
    const created = await repository.create({ scheduleDate: "2026-08-17", startTime: "09:00", endTime: "10:00", itemType: "event", title: "会議", color: "coral" });
    expect(created.color).toBe("coral");
    expect(await repository.list("2026-08-17")).toHaveLength(1);
    const moved = await repository.update(created.id, { startTime: "10:00", endTime: "11:00", version: created.version });
    expect(moved.startTime).toBe("10:00");
    await repository.remove(moved.id, moved.version);
    expect(await repository.list("2026-08-17")).toEqual([]);
  });
});
