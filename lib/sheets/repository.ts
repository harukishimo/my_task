import "server-only";

import type { sheets_v4 } from "googleapis";
import { getServerConfig } from "@/lib/server-config";
import { getSheetsClient } from "./client";
import { CATEGORY_TASK_HEADERS, COMMENT_TASK_HEADERS, LEGACY_TASK_HEADERS, PLAN_TASK_HEADERS, TASK_HEADERS, inputToTask, rowToTask, taskToRow } from "./mapper";
import { applyReviewFields } from "@/lib/tasks/reviews";
import { TaskConflictError, TaskNotFoundError, RepositoryUnavailableError } from "@/lib/tasks/errors";
import type { CreateTaskInput, Task, TaskRepository, UpdateTaskInput } from "@/types/task";
import { calculatePriority } from "@/lib/tasks/priority";

export class GoogleSheetsTaskRepository implements TaskRepository {
  private readonly sheets: sheets_v4.Sheets;
  private readonly config = getServerConfig();

  constructor() {
    this.sheets = getSheetsClient();
  }

  async list(options: { includeCompleted?: boolean } = {}): Promise<Task[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.googleSheetId,
        range: `${this.config.googleSheetTab}!A:U`,
        majorDimension: "ROWS",
      });
      const rows = response.data.values ?? [];
      const headers = rows[0] as string[] | undefined;
      const isCurrentHeaders = headers && TASK_HEADERS.every((header, index) => headers[index] === header);
      const isCategoryHeaders = headers && CATEGORY_TASK_HEADERS.every((header, index) => headers[index] === header);
      const isPlanHeaders = headers && PLAN_TASK_HEADERS.every((header, index) => headers[index] === header);
      const isCommentHeaders = headers && COMMENT_TASK_HEADERS.every((header, index) => headers[index] === header);
      const isLegacyHeaders = headers && LEGACY_TASK_HEADERS.every((header, index) => headers[index] === header);
      if (headers && !isCurrentHeaders && !isCategoryHeaders && !isPlanHeaders && !isCommentHeaders && !isLegacyHeaders) {
        throw new RepositoryUnavailableError("Google Sheets Tasks header is invalid");
      }
      const tasks: Task[] = [];
      rows.slice(1).forEach((row, index) => {
        try {
          const task = rowToTask(row as string[], index + 2);
          if (task && !task.isDeleted && (options.includeCompleted || task.status === "todo")) tasks.push(task);
        } catch {
          console.warn(JSON.stringify({ event: "invalid_sheet_row", row: index + 2 }));
        }
      });
      return tasks;
    } catch (error) {
      if (error instanceof RepositoryUnavailableError) throw error;
      throw new RepositoryUnavailableError("Google Sheets list failed");
    }
  }

  async findById(id: string): Promise<Task | null> {
    const tasks = await this.list({ includeCompleted: true });
    return tasks.find((task) => task.id === id) ?? null;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task = inputToTask(input);
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.googleSheetId,
        range: `${this.config.googleSheetTab}!A:U`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [taskToRow(task)] },
      });
      return task;
    } catch {
      throw new RepositoryUnavailableError("Google Sheets create failed");
    }
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const current = await this.findById(id);
    if (!current) throw new TaskNotFoundError("Task not found");
    if (current.version !== input.version) throw new TaskConflictError("Task version conflict");
    const next: Task = {
      ...current,
      ...input,
      title: input.title?.trim() ?? current.title,
      comment: input.comment?.trim() ?? current.comment,
      priority: calculatePriority(input.isUrgent ?? current.isUrgent, input.isImportant ?? current.isImportant),
      completedAt: input.status === "done" ? (current.completedAt ?? new Date().toISOString()) : input.status === "todo" ? null : current.completedAt,
      ...applyReviewFields(current, input),
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    const rowNumber = await this.findRowNumber(id);
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.googleSheetId,
        range: `${this.config.googleSheetTab}!A${rowNumber}:U${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [taskToRow(next)] },
      });
      return next;
    } catch {
      throw new RepositoryUnavailableError("Google Sheets update failed");
    }
  }

  async remove(id: string, version: number): Promise<void> {
    await this.update(id, { version, isDeleted: true });
  }

  private async findRowNumber(id: string): Promise<number> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.googleSheetId,
      range: `${this.config.googleSheetTab}!A:U`,
      majorDimension: "ROWS",
    });
    const rows = response.data.values ?? [];
    const index = rows.findIndex((row) => row[0] === id);
    if (index < 1) throw new TaskNotFoundError("Task not found");
    return index + 1;
  }
}

export async function ensureTaskHeaders(): Promise<void> {
  const config = getServerConfig();
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetId,
    range: `${config.googleSheetTab}!A1:U1`,
    valueInputOption: "RAW",
    requestBody: { values: [TASK_HEADERS as unknown as string[]] },
  });
}
