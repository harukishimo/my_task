import { z } from "zod";
import { isValidDateOnly, isValidTimeOnly } from "./date";
import { DEFAULT_DUE_TIME, fromDateTimeLocal } from "./reviews";

const dateSchema = z.string().refine(isValidDateOnly, "実在する日付をYYYY-MM-DDで指定してください");
const timeSchema = z.string().refine(isValidTimeOnly, "時刻はHH:mmで指定してください");
const categorySchema = z.enum(["default", "private"]);
const reviewDateTimeSchema = z.string().nullable().transform((value, ctx) => {
  if (value === null || value === "") return null;
  const normalized = fromDateTimeLocal(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "確認時刻はYYYY-MM-DDTHH:mmで指定してください" });
    return z.NEVER;
  }
  return normalized;
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "タスク名を入力してください").max(200, "タスク名は200文字以内です"),
  comment: z.string().trim().max(2000, "コメントは2000文字以内です").optional().default(""),
  dueDate: dateSchema,
  dueTime: timeSchema.optional().default(DEFAULT_DUE_TIME),
  isUrgent: z.boolean(),
  isImportant: z.boolean(),
  category: categorySchema.optional().default("default"),
  reviewOutlineAt: reviewDateTimeSchema.optional(),
  reviewMidAt: reviewDateTimeSchema.optional(),
  reviewAlmostAt: reviewDateTimeSchema.optional(),
  reviewManual: z.boolean().optional().default(false),
}).strict();

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  comment: z.string().trim().max(2000, "コメントは2000文字以内です").optional(),
  dueDate: dateSchema.optional(),
  dueTime: timeSchema.optional(),
  isUrgent: z.boolean().optional(),
  isImportant: z.boolean().optional(),
  status: z.enum(["todo", "done"]).optional(),
  isDeleted: z.boolean().optional(),
  planDate: dateSchema.nullable().optional(),
  planOrder: z.number().int().positive().nullable().optional(),
  category: categorySchema.optional(),
  reviewOutlineAt: reviewDateTimeSchema.optional(),
  reviewMidAt: reviewDateTimeSchema.optional(),
  reviewAlmostAt: reviewDateTimeSchema.optional(),
  reviewManual: z.boolean().optional(),
  version: z.number().int().positive(),
}).strict();

export type CreateTaskPayload = z.infer<typeof createTaskSchema>;
export type UpdateTaskPayload = z.infer<typeof updateTaskSchema>;
