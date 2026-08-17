import { inputToSchedule, toMinutes } from "@/lib/schedule/mapper";
import { TaskConflictError, TaskNotFoundError } from "@/lib/tasks/errors";
import type { CreateScheduleItemInput, ScheduleItem, ScheduleRepository, UpdateScheduleItemInput } from "@/types/schedule";

export class InMemoryScheduleRepository implements ScheduleRepository {
  private items = new Map<string, ScheduleItem>();

  async list(scheduleDate: string): Promise<ScheduleItem[]> {
    return [...this.items.values()]
      .filter((item) => !item.isDeleted && item.scheduleDate === scheduleDate)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }

  async findById(id: string): Promise<ScheduleItem | null> {
    return this.items.get(id) ?? null;
  }

  async create(input: CreateScheduleItemInput): Promise<ScheduleItem> {
    const existing = await this.list(input.scheduleDate);
    const item = inputToSchedule(input, new Date(), undefined, existing.length + 1);
    this.items.set(item.id, item);
    return item;
  }

  async update(id: string, input: UpdateScheduleItemInput): Promise<ScheduleItem> {
    const current = this.items.get(id);
    if (!current || current.isDeleted) throw new TaskNotFoundError("Schedule item not found");
    if (current.version !== input.version) throw new TaskConflictError("Schedule item version conflict");
    const next: ScheduleItem = {
      ...current,
      ...input,
      title: input.title?.trim() ?? current.title,
      comment: input.comment?.trim() ?? current.comment,
      taskId: input.taskId === undefined ? current.taskId : input.taskId,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    this.items.set(id, next);
    return next;
  }

  async remove(id: string, version: number): Promise<void> {
    await this.update(id, { version, isDeleted: true });
  }
}
