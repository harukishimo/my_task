const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function todayInTokyo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidDateOnly(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function isOverdue(dueDate: string, today = todayInTokyo()): boolean {
  return dueDate < today;
}

export function isDueToday(dueDate: string, today = todayInTokyo()): boolean {
  return dueDate === today;
}

export function isDueByToday(dueDate: string, today = todayInTokyo()): boolean {
  return dueDate <= today;
}

export function isDueThisWeek(dueDate: string, now = new Date()): boolean {
  const today = todayInTokyo(now);
  const [year, month, day] = today.split("-").map(Number);
  const todayUtc = new Date(Date.UTC(year, month - 1, day));
  const weekday = todayUtc.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(todayUtc);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const first = formatUtcDate(monday);
  const last = formatUtcDate(sunday);
  return dueDate >= first && dueDate <= last;
}

export function overdueDays(dueDate: string, today = todayInTokyo()): number {
  if (dueDate >= today) return 0;
  const [dueYear, dueMonth, dueDay] = dueDate.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const due = Date.UTC(dueYear, dueMonth - 1, dueDay);
  const current = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.floor((current - due) / 86_400_000);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
