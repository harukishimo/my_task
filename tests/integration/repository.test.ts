import { describe, expect, it } from "vitest";
import { InMemoryTaskRepository } from "@/lib/tasks/in-memory-repository";

describe("TaskRepository contract", () => {
  it("creates, updates, completes, restores, and logically deletes", async () => {
    const repository = new InMemoryTaskRepository();
    const created = await repository.create({ title: "検証する", dueDate: "2026-07-27", isUrgent: false, isImportant: true });
    expect(created.priority).toBe("P2");
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
