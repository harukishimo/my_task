import { z } from "zod";
import { isValidDateOnly } from "./date";

const dateSchema = z.string().refine(isValidDateOnly, "実在する日付をYYYY-MM-DDで指定してください");

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "タスク名を入力してください").max(200, "タスク名は200文字以内です"),
  dueDate: dateSchema,
  isUrgent: z.boolean(),
  isImportant: z.boolean(),
}).strict();

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  dueDate: dateSchema.optional(),
  isUrgent: z.boolean().optional(),
  isImportant: z.boolean().optional(),
  status: z.enum(["todo", "done"]).optional(),
  isDeleted: z.boolean().optional(),
  version: z.number().int().positive(),
}).strict();

export type CreateTaskPayload = z.infer<typeof createTaskSchema>;
export type UpdateTaskPayload = z.infer<typeof updateTaskSchema>;
