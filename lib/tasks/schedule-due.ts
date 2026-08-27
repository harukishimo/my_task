export function dueFieldsFromSchedule(scheduleDate: string, endTime: string): { dueDate: string; dueTime: string } {
  return { dueDate: scheduleDate, dueTime: endTime };
}

export function shouldSyncTaskDue(itemType: string, taskId: string | null | undefined): taskId is string {
  return itemType === "task" && Boolean(taskId);
}
