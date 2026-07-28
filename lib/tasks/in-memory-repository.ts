import { inputToTask } from "@/lib/sheets/mapper";
import { TaskConflictError, TaskNotFoundError } from "@/lib/tasks/errors";
import type { CreateTaskInput, Task, TaskRepository, UpdateTaskInput } from "@/types/task";
import { calculatePriority } from "./priority";

export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>();

  async list(options: { includeCompleted?: boolean } = {}): Promise<Task[]> {
    return [...this.tasks.values()].filter((task) => !task.isDeleted && (options.includeCompleted || task.status === "todo"));
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task = inputToTask(input);
    this.tasks.set(task.id, task);
    return task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const current = this.tasks.get(id);
    if (!current) throw new TaskNotFoundError("Task not found");
    if (current.version !== input.version) throw new TaskConflictError("Task version conflict");
    const next: Task = {
      ...current,
      ...input,
      title: input.title?.trim() ?? current.title,
      priority: calculatePriority(input.isUrgent ?? current.isUrgent, input.isImportant ?? current.isImportant),
      completedAt: input.status === "done" ? (current.completedAt ?? new Date().toISOString()) : input.status === "todo" ? null : current.completedAt,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    this.tasks.set(id, next);
    return next;
  }

  async remove(id: string, version: number): Promise<void> {
    await this.update(id, { version, isDeleted: true });
  }
}
