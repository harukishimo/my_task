export type Priority = "P1" | "P2" | "P3" | "P4";
export type TaskStatus = "todo" | "done";
export type TaskCategory = "default" | "private";

export type Task = {
  id: string;
  title: string;
  comment: string;
  dueDate: string;
  dueTime: string;
  isUrgent: boolean;
  isImportant: boolean;
  priority: Priority;
  status: TaskStatus;
  completedAt: string | null;
  isDeleted: boolean;
  planDate: string | null;
  planOrder: number | null;
  category: TaskCategory;
  workHours: number;
  reviewOutlineAt: string | null;
  reviewMidAt: string | null;
  reviewAlmostAt: string | null;
  reviewManual: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreateTaskInput = {
  title: string;
  comment?: string;
  dueDate: string;
  dueTime?: string;
  isUrgent: boolean;
  isImportant: boolean;
  category?: TaskCategory;
  reviewOutlineAt?: string | null;
  reviewMidAt?: string | null;
  reviewAlmostAt?: string | null;
  reviewManual?: boolean;
};

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  status?: TaskStatus;
  isDeleted?: boolean;
  planDate?: string | null;
  planOrder?: number | null;
  category?: TaskCategory;
  workHours?: number;
  reviewOutlineAt?: string | null;
  reviewMidAt?: string | null;
  reviewAlmostAt?: string | null;
  reviewManual?: boolean;
  version: number;
};

export type TaskRepository = {
  list(options?: { includeCompleted?: boolean }): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, input: UpdateTaskInput): Promise<Task>;
  remove(id: string, version: number): Promise<void>;
};
