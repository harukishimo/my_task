import "server-only";

import type { sheets_v4 } from "googleapis";
import { getServerConfig } from "@/lib/server-config";
import { getSheetsClient } from "@/lib/sheets/client";
import { RepositoryUnavailableError, TaskConflictError, TaskNotFoundError } from "@/lib/tasks/errors";
import type { CreateScheduleItemInput, ScheduleItem, ScheduleRepository, UpdateScheduleItemInput } from "@/types/schedule";
import { inputToSchedule, isKnownScheduleHeader, rowToSchedule, scheduleToRow, SCHEDULE_HEADERS, toMinutes } from "./mapper";
import { InMemoryScheduleRepository } from "./in-memory-repository";

export class GoogleSheetsScheduleRepository implements ScheduleRepository {
  private readonly sheets: sheets_v4.Sheets;
  private readonly config = getServerConfig();

  constructor() {
    this.sheets = getSheetsClient();
  }

  async list(scheduleDate: string): Promise<ScheduleItem[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.googleSheetId,
        range: `${this.config.googleScheduleTab}!A:N`,
        majorDimension: "ROWS",
      });
      const rows = response.data.values ?? [];
      const headers = rows[0] as string[] | undefined;
      if (headers && !isKnownScheduleHeader(headers)) throw new RepositoryUnavailableError("Google Sheets ScheduleItems header is invalid");
      const items: ScheduleItem[] = [];
      rows.slice(1).forEach((row, index) => {
        try {
          const item = rowToSchedule(row as string[], index + 2);
          if (item && !item.isDeleted && item.scheduleDate === scheduleDate) items.push(item);
        } catch {
          console.warn(JSON.stringify({ event: "invalid_schedule_row", row: index + 2 }));
        }
      });
      return items.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
    } catch (error) {
      if (error instanceof RepositoryUnavailableError) throw error;
      throw new RepositoryUnavailableError("Google Sheets schedule list failed");
    }
  }

  async findById(id: string): Promise<ScheduleItem | null> {
    const rows = await this.readRows();
    for (const [index, row] of rows.slice(1).entries()) {
      try {
        const item = rowToSchedule(row as string[], index + 2);
        if (item?.id === id) return item;
      } catch {
        // Invalid rows are ignored consistently with list().
      }
    }
    return null;
  }

  async create(input: CreateScheduleItemInput): Promise<ScheduleItem> {
    const sortOrder = (await this.list(input.scheduleDate)).length + 1;
    const item = inputToSchedule(input, new Date(), undefined, sortOrder);
    try {
      await this.writeHeaders();
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.googleSheetId,
        range: `${this.config.googleScheduleTab}!A:N`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [scheduleToRow(item)] },
      });
      return item;
    } catch {
      throw new RepositoryUnavailableError("Google Sheets schedule create failed");
    }
  }

  async update(id: string, input: UpdateScheduleItemInput): Promise<ScheduleItem> {
    const current = await this.findById(id);
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
    const rowNumber = await this.findRowNumber(id);
    try {
      await this.writeHeaders();
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.googleSheetId,
        range: `${this.config.googleScheduleTab}!A${rowNumber}:N${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [scheduleToRow(next)] },
      });
      return next;
    } catch {
      throw new RepositoryUnavailableError("Google Sheets schedule update failed");
    }
  }

  async remove(id: string, version: number): Promise<void> {
    const current = await this.findById(id);
    if (!current) throw new TaskNotFoundError("Schedule item not found");
    await this.update(id, { version, isDeleted: true });
  }

  private async readRows(): Promise<string[][]> {
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.config.googleSheetId, range: `${this.config.googleScheduleTab}!A:N`, majorDimension: "ROWS" });
    return (response.data.values ?? []) as string[][];
  }

  private async writeHeaders(): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.googleSheetId,
      range: `${this.config.googleScheduleTab}!A1:N1`,
      valueInputOption: "RAW",
      requestBody: { values: [SCHEDULE_HEADERS as unknown as string[]] },
    });
  }

  private async findRowNumber(id: string): Promise<number> {
    const rows = await this.readRows();
    const index = rows.findIndex((row) => row[0] === id);
    if (index < 1) throw new TaskNotFoundError("Schedule item not found");
    return index + 1;
  }
}

const globalForScheduleRepository = globalThis as typeof globalThis & { scheduleRepository?: ScheduleRepository };

export function getScheduleRepository(): ScheduleRepository {
  if (globalForScheduleRepository.scheduleRepository) return globalForScheduleRepository.scheduleRepository;
  const useMemory = process.env.TASK_STORE_MODE === "memory" || (!process.env.GOOGLE_SHEET_ID && process.env.NODE_ENV !== "production");
  const repository = useMemory ? new InMemoryScheduleRepository() : new GoogleSheetsScheduleRepository();
  globalForScheduleRepository.scheduleRepository = repository;
  return repository;
}

export async function ensureScheduleHeaders(): Promise<void> {
  const config = getServerConfig();
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetId,
    range: `${config.googleScheduleTab}!A1:N1`,
    valueInputOption: "RAW",
    requestBody: { values: [SCHEDULE_HEADERS as unknown as string[]] },
  });
}
