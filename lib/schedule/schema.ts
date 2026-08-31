import { z } from "zod";
import { SCHEDULE_EVENT_COLORS } from "@/lib/schedule/colors";
import { isValidDateOnly } from "@/lib/tasks/date";
import { isValidTime, toMinutes } from "./mapper";

const colorSchema = z.enum(SCHEDULE_EVENT_COLORS);

const dateSchema = z.string().refine(isValidDateOnly, "実在する日付をYYYY-MM-DDで指定してください");
const timeSchema = z.string().refine(isValidTime, "時刻はHH:MM形式で指定してください");

function validateTimeRange(startTime: string | undefined, endTime: string | undefined, context: z.RefinementCtx) {
  if (startTime && endTime && toMinutes(endTime) <= toMinutes(startTime)) context.addIssue({ code: "custom", path: ["endTime"], message: "終了時刻は開始時刻より後にしてください" });
}

export const createScheduleSchema = z.object({
  scheduleDate: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  itemType: z.enum(["task", "event"]),
  taskId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1, "予定名を入力してください").max(200, "予定名は200文字以内です"),
  comment: z.string().trim().max(2000, "メモは2000文字以内です").optional().default(""),
  color: colorSchema.optional(),
}).strict().superRefine((value, context) => {
  validateTimeRange(value.startTime, value.endTime, context);
  if (value.itemType === "task" && !value.taskId) context.addIssue({ code: "custom", path: ["taskId"], message: "タスク予定にはタスクIDが必要です" });
  if (value.itemType === "event" && value.taskId) context.addIssue({ code: "custom", path: ["taskId"], message: "自由予定にタスクIDは指定できません" });
});

export const updateScheduleSchema = z.object({
  scheduleDate: dateSchema.optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  itemType: z.enum(["task", "event"]).optional(),
  taskId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  comment: z.string().trim().max(2000, "メモは2000文字以内です").optional(),
  color: colorSchema.optional(),
  version: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  validateTimeRange(value.startTime, value.endTime, context);
  if (value.itemType === "task" && !value.taskId) context.addIssue({ code: "custom", path: ["taskId"], message: "タスク予定にはタスクIDが必要です" });
  if (value.itemType === "event" && value.taskId) context.addIssue({ code: "custom", path: ["taskId"], message: "自由予定にタスクIDは指定できません" });
});

export type CreateSchedulePayload = z.infer<typeof createScheduleSchema>;
export type UpdateSchedulePayload = z.infer<typeof updateScheduleSchema>;
