export type ScheduleItemType = "task" | "event";

export type ScheduleItem = {
  id: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  itemType: ScheduleItemType;
  taskId: string | null;
  title: string;
  comment: string;
  sortOrder: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreateScheduleItemInput = {
  scheduleDate: string;
  startTime: string;
  endTime: string;
  itemType: ScheduleItemType;
  taskId?: string | null;
  title: string;
  comment?: string;
};

export type UpdateScheduleItemInput = Partial<CreateScheduleItemInput> & {
  isDeleted?: boolean;
  version: number;
};

export type ScheduleRepository = {
  list(scheduleDate: string): Promise<ScheduleItem[]>;
  findById(id: string): Promise<ScheduleItem | null>;
  create(input: CreateScheduleItemInput): Promise<ScheduleItem>;
  update(id: string, input: UpdateScheduleItemInput): Promise<ScheduleItem>;
  remove(id: string, version: number): Promise<void>;
};
