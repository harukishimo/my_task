"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Priority, Task, TaskCategory } from "@/types/task";
import type { CreateScheduleItemInput, ScheduleItem } from "@/types/schedule";
import { calculatePriority, PRIORITY_LABELS } from "@/lib/tasks/priority";
import { dashboardMetrics, dueDateSort, prioritySort, priorityTasks } from "@/lib/tasks/selectors";
import { overdueDays, todayInTokyo } from "@/lib/tasks/date";
import { calculateReviewSchedule, DEFAULT_DUE_TIME, formatDueLabel, REVIEW_LABELS, toDateTimeLocal } from "@/lib/tasks/reviews";
import { dailyBlockFromStart, TASK_DAY_START_TIME } from "@/lib/tasks/schedule-due";
import { isReviewReminder, reviewReminderTaskId, reviewRemindersOnDate } from "@/lib/tasks/review-reminders";
import LogoMark from "@/app/_components/logo-mark";
import WbsView from "@/app/_components/wbs-view";

type View = "dashboard" | "all" | "due" | "matrix" | "plan" | "wbs" | "private";
type NewTaskDefaults = Pick<Task, "isUrgent" | "isImportant"> & { category?: TaskCategory };

const PRIORITY_DEFAULTS: Record<Priority, NewTaskDefaults> = {
  P1: { isUrgent: true, isImportant: true },
  P2: { isUrgent: false, isImportant: true },
  P3: { isUrgent: true, isImportant: false },
  P4: { isUrgent: false, isImportant: false },
};

const MATRIX_QUADRANTS: Array<{ priority: Priority; urgent: boolean; important: boolean; label: string; sub: string }> = [
  { priority: "P1", urgent: true, important: true, label: "今すぐやる", sub: "緊急 × 重要" },
  { priority: "P2", urgent: false, important: true, label: "予定する", sub: "非緊急 × 重要" },
  { priority: "P3", urgent: true, important: false, label: "手早くやる", sub: "緊急 × 非重要" },
  { priority: "P4", urgent: false, important: false, label: "あとで", sub: "非緊急 × 非重要" },
];

const navItems: Array<{ href: string; view: View; label: string; icon: string }> = [
  { href: "/dashboard", view: "dashboard", label: "ダッシュボード", icon: "⌂" },
  { href: "/all", view: "all", label: "TODO ALL", icon: "☷" },
  { href: "/due", view: "due", label: "今日まで", icon: "◷" },
  { href: "/matrix", view: "matrix", label: "マトリクス", icon: "⊞" },
  { href: "/plan", view: "plan", label: "今日の段取り", icon: "≡" },
  { href: "/wbs", view: "wbs", label: "WBS", icon: "▦" },
  { href: "/private", view: "private", label: "プライベート", icon: "◇" },
];

export default function TaskApp({ view }: { view: View }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [newTaskDefaults, setNewTaskDefaults] = useState<NewTaskDefaults>(PRIORITY_DEFAULTS.P4);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sort, setSort] = useState<"due" | "priority">("due");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mutationVersion = useRef(0);

  const loadTasks = useCallback(async () => {
    const requestVersion = mutationVersion.current;
    setLoading(true);
    try {
      const response = await fetch("/api/tasks?includeCompleted=true", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "タスクを読み込めませんでした。");
      if (requestVersion === mutationVersion.current) setTasks(body.data ?? []);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "タスクを読み込めませんでした。" });
    } finally {
      setLoading(false);
    }
  }, [router]);

  // This effect synchronizes the client view with the protected server API on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadTasks(); }, [loadTasks]);

  // The persisted preference is read once after hydration to avoid server/client markup differences.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarCollapsed(window.localStorage.getItem("task-sidebar-collapsed") === "true");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("task-sidebar-collapsed", String(next));
      return next;
    });
  }

  function openNewTask(defaults: NewTaskDefaults = PRIORITY_DEFAULTS.P4) {
    setNewTaskDefaults(defaults);
    setEditing({} as Task);
  }

  function openTask(task: Task) {
    setEditing(task);
  }

  async function saveTask(input: { title: string; comment: string; dueDate: string; dueTime: string; isUrgent: boolean; isImportant: boolean; category: TaskCategory; reviewOutlineAt: string; reviewMidAt: string; reviewAlmostAt: string; reviewManual: boolean }, task?: Task) {
    mutationVersion.current += 1;
    const response = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
      method: task ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task ? { ...input, version: task.version } : input),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error?.message ?? "保存できませんでした。");
    setTasks((current) => task ? current.map((item) => item.id === task.id ? body.data : item) : [body.data, ...current]);
    setEditing(null);
    setNotice({ type: "success", text: task ? "タスクを更新しました。" : "タスクを追加しました。" });
  }

  async function patchTask(task: Task, update: Record<string, unknown>, successText?: string | null): Promise<boolean> {
    mutationVersion.current += 1;
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...update, version: task.version }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "更新できませんでした。");
      setTasks((current) => current.map((item) => item.id === task.id ? body.data : item));
      if (successText) setNotice({ type: "success", text: successText });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "更新できませんでした。" });
      await loadTasks();
      return false;
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`「${task.title}」を削除しますか？`)) return;
    mutationVersion.current += 1;
    try {
      const response = await fetch(`/api/tasks/${task.id}?version=${task.version}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "削除できませんでした。");
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setNotice({ type: "success", text: "タスクを削除しました。" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "削除できませんでした。" });
      await loadTasks();
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const active = useMemo(() => tasks.filter((task) => !task.isDeleted && task.status === "todo"), [tasks]);
  const completed = useMemo(() => tasks.filter((task) => !task.isDeleted && task.status === "done"), [tasks]);
  const privateActive = useMemo(() => active.filter((task) => task.category === "private"), [active]);
  const privateCompleted = useMemo(() => completed.filter((task) => task.category === "private"), [completed]);
  const metrics = useMemo(() => dashboardMetrics(tasks), [tasks]);

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="sidebar" id="task-sidebar">
        <div className="sidebar-brand"><LogoMark small /><div className="sidebar-brand-copy"><strong>わたしの<br />タスク管理</strong><span>ONE PERSON / ONE SYSTEM</span></div><button className="sidebar-toggle" onClick={toggleSidebar} aria-controls="task-sidebar" aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? "サイドバーを展開" : "サイドバーを格納"} title={sidebarCollapsed ? "サイドバーを展開" : "サイドバーを格納"}>{sidebarCollapsed ? "→" : "←"}</button></div>
        <nav aria-label="メインナビゲーション">
          {navItems.map((item) => <Link key={item.href} className={view === item.view ? "nav-link active" : "nav-link"} href={item.href}><span className="nav-link-icon" aria-hidden="true">{item.icon}</span><span className="nav-link-label">{item.label}</span></Link>)}
        </nav>
        <div className="sidebar-bottom"><p>今日もひとつずつ。</p><button className="logout-button" onClick={logout} aria-label="ログアウト"><span aria-hidden="true">↪</span><span className="logout-label">ログアウト</span></button></div>
      </aside>
      <main className="main-content">
        <header className="mobile-header"><LogoMark small /><strong>わたしのタスク管理</strong><button className="icon-button" onClick={logout} aria-label="ログアウト">↪</button></header>
        {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.type === "success" ? "✓" : "!"}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="通知を閉じる">×</button></div>}
        {loading ? <LoadingState /> : <>
          {view === "dashboard" && <DashboardView tasks={tasks} metrics={metrics} onQuickAdd={openNewTask} onEdit={openTask} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} />}
          {view === "all" && <AllView active={active} completed={completed} showCompleted={showCompleted} setShowCompleted={setShowCompleted} sort={sort} setSort={setSort} onEdit={openTask} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} onRestore={(task) => patchTask(task, { status: "todo" }, "タスクを復元しました。")} onDelete={deleteTask} onAdd={openNewTask} />}
          {view === "private" && <AllView active={privateActive} completed={privateCompleted} showCompleted={showCompleted} setShowCompleted={setShowCompleted} sort={sort} setSort={setSort} onEdit={openTask} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} onRestore={(task) => patchTask(task, { status: "todo" }, "タスクを復元しました。")} onDelete={deleteTask} onAdd={() => openNewTask({ ...PRIORITY_DEFAULTS.P4, category: "private" })} heading="プライベートタスク" eyebrow="PRIVATE TASKS" emptyText="プライベートタスクはありません。" />}
          {view === "due" && <DueView tasks={tasks} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} onEdit={openTask} />}
          {view === "matrix" && <MatrixView tasks={active} onMove={(task, isUrgent, isImportant) => patchTask(task, { isUrgent, isImportant }, "優先度マトリクスを更新しました。")} onEdit={openTask} onAdd={(priority) => openNewTask(PRIORITY_DEFAULTS[priority])} />}
          {view === "plan" && <PlanningView tasks={tasks} onEdit={openTask} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} onAdd={() => openNewTask(PRIORITY_DEFAULTS.P4)} />}
          {view === "wbs" && <WbsView tasks={active} onEdit={openTask} onStretchDue={(task, dueDate) => { void patchTask(task, { dueDate }, "期日を更新しました。"); }} onAdd={() => openNewTask(PRIORITY_DEFAULTS.P4)} />}
        </>}
      </main>
      {editing && <TaskModal task={editing.id ? editing : undefined} initialValues={editing.id ? undefined : newTaskDefaults} onClose={() => setEditing(null)} onSave={saveTask} onComplete={editing.id ? (task) => patchTask(task, { status: task.status === "done" ? "todo" : "done" }, task.status === "done" ? "タスクを未完了に戻しました。" : "タスクを完了しました。") : undefined} />}
      <nav className="mobile-nav" aria-label="モバイルナビゲーション">{navItems.map((item) => <Link key={item.href} className={view === item.view ? "mobile-nav-link active" : "mobile-nav-link"} href={item.href}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></Link>)}</nav>
    </div>
  );
}

function LoadingState() { return <div className="content-wrap"><div className="page-heading skeleton-line wide" /><div className="metric-grid">{[1, 2, 3, 4].map((item) => <div className="skeleton-card" key={item} />)}</div><div className="panel skeleton-panel" /></div>; }

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>; }

function DashboardView({ tasks, metrics, onQuickAdd, onEdit, onComplete }: { tasks: Task[]; metrics: ReturnType<typeof dashboardMetrics>; onQuickAdd: () => void; onEdit: (task: Task) => void; onComplete: (task: Task) => void }) {
  const today = todayInTokyo();
  const priorities = priorityTasks(tasks);
  return <div className="content-wrap"><PageHeading eyebrow="MONDAY / OVERVIEW" title="今日の全体像" description={`${today.replaceAll("-", ".")} — まずは、ひとつだけ。`} action={<button className="primary-button" onClick={onQuickAdd}>＋ タスクを追加</button>} />
    <div className="metric-grid">{[
      ["期限切れ", metrics.counts.overdue, "overdue", "/due"], ["今日が期限", metrics.counts.dueToday, "today", "/due"], ["今週が期限", metrics.counts.thisWeek, "week", "/all"], ["P1 / 最重要", metrics.counts.p1, "p1", "/matrix"],
    ].map(([label, count, tone, href]) => <Link href={href as string} className={`metric-card ${tone}`} key={label as string}><span>{label}</span><strong>{count as number}</strong><small>件を確認する →</small></Link>)}</div>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">NEXT ACTIONS</p><h2>優先して着手するタスク</h2></div><Link href="/all" className="text-link">すべて見る →</Link></div>{priorities.length === 0 ? <EmptyState text="未完了タスクはありません。新しいタスクを追加して始めましょう。" /> : <TaskList tasks={priorities} onEdit={onEdit} onComplete={onComplete} />}</section>
  </div>;
}

function AllView({ active, completed, showCompleted, setShowCompleted, sort, setSort, onEdit, onComplete, onRestore, onDelete, onAdd, heading = "TODO ALL", eyebrow = "ALL TASKS", emptyText = "未完了タスクはありません。" }: { active: Task[]; completed: Task[]; showCompleted: boolean; setShowCompleted: (value: boolean) => void; sort: "due" | "priority"; setSort: (value: "due" | "priority") => void; onEdit: (task: Task) => void; onComplete: (task: Task) => void; onRestore: (task: Task) => void; onDelete: (task: Task) => void; onAdd: () => void; heading?: string; eyebrow?: string; emptyText?: string }) {
  const ordered = sort === "due" ? dueDateSort(active) : prioritySort(active);
  return <div className="content-wrap"><PageHeading eyebrow={eyebrow} title={heading} description={`${active.length}件の未完了タスク`} action={<button className="primary-button" onClick={onAdd}>＋ タスクを追加</button>} /><section className="panel"><div className="toolbar"><div className="segmented"><button className={sort === "due" ? "selected" : ""} onClick={() => setSort("due")}>期日順</button><button className={sort === "priority" ? "selected" : ""} onClick={() => setSort("priority")}>優先度順</button></div><label className="toggle"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /><span>完了済みを表示</span></label></div>{ordered.length === 0 && !showCompleted ? <EmptyState text={emptyText} /> : <TaskList tasks={showCompleted ? [...ordered, ...completed] : ordered} onEdit={onEdit} onComplete={onComplete} onRestore={onRestore} onDelete={onDelete} showCompleted={showCompleted} />}</section></div>;
}

function DueView({ tasks, onComplete, onEdit }: { tasks: Task[]; onComplete: (task: Task) => void; onEdit: (task: Task) => void }) {
  const today = todayInTokyo();
  const due = tasks.filter((task) => !task.isDeleted && task.status === "todo" && task.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = due.filter((task) => task.dueDate < today);
  const dueToday = due.filter((task) => task.dueDate === today);
  return <div className="content-wrap"><PageHeading eyebrow="FOCUS / TODAY" title="今日まで" description="期限切れと、本日期限のタスク" /><div className="due-summary"><div><span>期限切れ</span><strong>{overdue.length}</strong></div><div><span>今日</span><strong>{dueToday.length}</strong></div></div>{due.length === 0 ? <section className="panel"><EmptyState text="今日までのタスクはありません。" /></section> : <>{overdue.length > 0 && <DueSection title="期限切れ" subtitle="日付を越えているタスク" tasks={overdue} onComplete={onComplete} onEdit={onEdit} />} {dueToday.length > 0 && <DueSection title="今日が期限" subtitle="今日中に判断するタスク" tasks={dueToday} onComplete={onComplete} onEdit={onEdit} />}</>}</div>;
}

function DueSection({ title, subtitle, tasks, onComplete, onEdit }: { title: string; subtitle: string; tasks: Task[]; onComplete: (task: Task) => void; onEdit: (task: Task) => void }) { return <section className="panel due-section"><div className="panel-header"><div><h2>{title}</h2><p className="muted">{subtitle}</p></div><span className="count-pill">{tasks.length}件</span></div><TaskList tasks={tasks} onEdit={onEdit} onComplete={onComplete} showOverdue /></section>; }

const SCHEDULE_SLOT_PREFIX = "schedule-slot:";
const SCHEDULE_ITEM_PREFIX = "schedule-item:";
const SCHEDULE_START_MINUTES = 7 * 60;
const SCHEDULE_END_MINUTES = 22 * 60;
const SCHEDULE_SLOT_MINUTES = 30;
const SCHEDULE_SLOT_HEIGHT = 44;
const SCHEDULE_SLOTS = Array.from({ length: (SCHEDULE_END_MINUTES - SCHEDULE_START_MINUTES) / SCHEDULE_SLOT_MINUTES }, (_, index) => minutesToTime(SCHEDULE_START_MINUTES + index * SCHEDULE_SLOT_MINUTES));

function planCollisionDetection(args: Parameters<typeof pointerWithin>[0]) {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
}

function PlanningView({ tasks, onEdit, onComplete, onAdd }: { tasks: Task[]; onEdit: (task: Task) => void; onComplete: (task: Task) => void; onAdd: () => void }) {
  const today = todayInTokyo();
  const activeTasks = tasks.filter((task) => !task.isDeleted && task.status === "todo");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [scheduleEditor, setScheduleEditor] = useState<{ item?: ScheduleItem; task?: Task; startTime?: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const response = await fetch(`/api/schedule?date=${today}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "今日のスケジュールを読み込めませんでした。");
      setScheduleItems(body.data ?? []);
    } catch (error) {
      setScheduleMessage({ type: "error", text: error instanceof Error ? error.message : "今日のスケジュールを読み込めませんでした。" });
    } finally {
      setScheduleLoading(false);
    }
  }, [today, setScheduleItems, setScheduleLoading, setScheduleMessage]);

  // Schedule data is scoped to this page/date and loaded independently from task data.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSchedule(); }, [loadSchedule]);

  const taskById = new Map(activeTasks.map((task) => [task.id, task]));
  const reminderItems = reviewRemindersOnDate(activeTasks, today);
  const timelineItems = [...scheduleItems, ...reminderItems];
  const scheduledTaskIds = new Set(scheduleItems.filter((item) => item.itemType === "task").map((item) => item.taskId).filter((id): id is string => Boolean(id)));
  const unscheduled = activeTasks.filter((task) => !scheduledTaskIds.has(task.id));
  const draggingTask = draggingId ? taskById.get(draggingId) : undefined;

  async function saveSchedule(input: CreateScheduleItemInput, item?: ScheduleItem) {
    setScheduleSaving(true);
    setScheduleMessage(null);
    try {
      const response = await fetch(item ? `/api/schedule/${item.id}` : "/api/schedule", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item ? { ...input, version: item.version } : input),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "予定を保存できませんでした。");
      const saved = body.data as ScheduleItem;
      setScheduleItems((current) => item ? current.map((entry) => entry.id === item.id ? saved : entry) : [...current, saved]);
      setScheduleEditor(null);
      setScheduleMessage({ type: "success", text: item ? "予定を更新しました。" : "予定を追加しました。" });
    } catch (error) {
      setScheduleMessage({ type: "error", text: error instanceof Error ? error.message : "予定を保存できませんでした。" });
      throw error;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function deleteSchedule(item: ScheduleItem) {
    if (!window.confirm(`「${item.title}」をスケジュールから外しますか？`)) return;
    setScheduleSaving(true);
    try {
      const response = await fetch(`/api/schedule/${item.id}?version=${item.version}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "予定を削除できませんでした。");
      setScheduleItems((current) => current.filter((entry) => entry.id !== item.id));
      setScheduleEditor(null);
      setScheduleMessage({ type: "success", text: "予定をスケジュールから外しました。" });
    } catch (error) {
      setScheduleMessage({ type: "error", text: error instanceof Error ? error.message : "予定を削除できませんでした。" });
      await loadSchedule();
    } finally {
      setScheduleSaving(false);
    }
  }

  async function scheduleTask(task: Task, startTime = TASK_DAY_START_TIME) {
    const existing = scheduleItems.find((item) => item.itemType === "task" && item.taskId === task.id);
    const duration = existing ? Math.max(SCHEDULE_SLOT_MINUTES, toMinutes(existing.endTime) - toMinutes(existing.startTime)) : 60;
    const range = dailyBlockFromStart(startTime, duration);
    await saveSchedule({ scheduleDate: today, startTime: range.startTime, endTime: range.endTime, itemType: "task", taskId: task.id, title: task.title, comment: existing?.comment || task.comment }, existing);
  }

  async function moveSchedule(item: ScheduleItem, startTime: string) {
    const duration = Math.max(SCHEDULE_SLOT_MINUTES, toMinutes(item.endTime) - toMinutes(item.startTime));
    const range = dailyBlockFromStart(startTime, duration);
    await saveSchedule({ scheduleDate: item.scheduleDate, startTime: range.startTime, endTime: range.endTime, itemType: item.itemType, taskId: item.taskId, title: item.title, comment: item.comment }, item);
  }

  async function resizeSchedule(item: ScheduleItem, endTime: string) {
    if (toMinutes(endTime) <= toMinutes(item.startTime)) return;
    await saveSchedule({ scheduleDate: item.scheduleDate, startTime: item.startTime, endTime, itemType: item.itemType, taskId: item.taskId, title: item.title, comment: item.comment }, item);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!overId.startsWith(SCHEDULE_SLOT_PREFIX)) return;
    const slotTime = overId.slice(SCHEDULE_SLOT_PREFIX.length);
    if (activeId.startsWith(SCHEDULE_ITEM_PREFIX)) {
      const item = scheduleItems.find((entry) => entry.id === activeId.slice(SCHEDULE_ITEM_PREFIX.length));
      if (item) void moveSchedule(item, slotTime).catch(() => undefined);
      return;
    }
    const task = taskById.get(activeId);
    if (task) void scheduleTask(task, slotTime).catch(() => undefined);
  }

  return (
    <div className="content-wrap planning-page">
      <PageHeading eyebrow="TODAY / PLAN" title="今日の段取り" description={`${unscheduled.length}件の未配置タスクと、今日の時間割を決める。`} action={<div className="planning-heading-actions"><button className="primary-button" onClick={onAdd}>＋ タスクを追加</button><button className="secondary-button" onClick={() => setScheduleEditor({ startTime: "09:00" })}>＋ 予定を追加</button></div>} />
      {scheduleMessage && <div className={`schedule-message ${scheduleMessage.type}`} role="status">{scheduleMessage.text}<button type="button" onClick={() => setScheduleMessage(null)} aria-label="スケジュール通知を閉じる">×</button></div>}
      <DndContext sensors={sensors} collisionDetection={planCollisionDetection} onDragStart={({ active }) => setDraggingId(String(active.id))} onDragCancel={() => setDraggingId(null)} onDragEnd={handleDragEnd}>
        <PlanningSourceMatrix
          tasks={unscheduled}
          disabled={scheduleSaving}
          onEdit={onEdit}
          onSchedule={(task) => void scheduleTask(task).catch(() => undefined)}
        />
        <ScheduleTimeline items={timelineItems} tasks={tasks} loading={scheduleLoading} saving={scheduleSaving} onAdd={() => setScheduleEditor({ startTime: "09:00" })} onEdit={(item) => setScheduleEditor({ item, task: item.taskId ? tasks.find((task) => task.id === item.taskId) : undefined })} onOpenTask={onEdit} onDelete={deleteSchedule} onResize={(item, endTime) => void resizeSchedule(item, endTime).catch(() => undefined)} onComplete={onComplete} />
        <DragOverlay>{draggingTask ? <PlanTaskPreview task={draggingTask} /> : null}</DragOverlay>
      </DndContext>
      <p className="planning-hint">タスクを時間帯へドラッグすると、今日のスケジュールに60分で入ります。期日は変わりません。下端をドラッグして長さを変えられます。</p>
      {scheduleEditor && <ScheduleModal key={scheduleEditor.item?.id ?? scheduleEditor.task?.id ?? "new-event"} editor={scheduleEditor} onClose={() => setScheduleEditor(null)} onSave={saveSchedule} onDelete={deleteSchedule} saving={scheduleSaving} />}
    </div>
  );
}

function PlanningSourceMatrix({ tasks, disabled, onEdit, onSchedule }: { tasks: Task[]; disabled: boolean; onEdit: (task: Task) => void; onSchedule: (task: Task) => void }) {
  return (
    <section className="planning-panel planning-matrix-panel" aria-labelledby="unplanned-title">
      <div className="planning-panel-header"><div><p className="eyebrow">SOURCE TASKS</p><h2 id="unplanned-title">未計画タスク</h2></div><span className="count-pill">{tasks.length}件</span></div>
      <div className="matrix-legend planning-matrix-legend"><span>緊急度 <b>高 ↑</b></span><span>重要度 <b>高 →</b></span></div>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="matrix-grid planning-matrix-grid">
          {MATRIX_QUADRANTS.map((quadrant) => {
            const items = tasks.filter((task) => task.priority === quadrant.priority);
            return (
              <section key={quadrant.priority} className={`quadrant quadrant-${quadrant.priority.toLowerCase()}`}>
                <div className="quadrant-heading">
                  <div><span className="priority-badge">{quadrant.priority}</span><h2>{quadrant.label}</h2><p>{quadrant.sub}</p></div>
                  <strong>{items.length}</strong>
                </div>
                {items.length === 0 ? <p className="quadrant-empty">未計画のタスクはありません</p> : (
                  <div className="quadrant-tasks">
                    {items.map((task) => <PlanTaskCard key={task.id} task={task} disabled={disabled} onEdit={onEdit} onSchedule={() => onSchedule(task)} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </SortableContext>
    </section>
  );
}

function PlanTaskCard({ task, disabled = false, onEdit, onSchedule }: { task: Task; disabled?: boolean; onEdit: (task: Task) => void; onSchedule?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  return (
    <article ref={setNodeRef} style={style} className="plan-task-card" data-plan-task-id={task.id} data-plan-task-title={task.title}>
      <button type="button" className="plan-drag-handle" disabled={disabled} {...attributes} {...listeners} aria-label={`${task.title}をドラッグ`}>⠿</button>
      <button type="button" className="plan-task-content" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}>
        <strong title={task.title}>{truncateText(task.title, 34)}</strong>
        <span className="plan-task-meta"><b className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}</b>{formatDueLabel(task.dueDate, task.dueTime)}</span>
        {task.comment && <small title={task.comment}>{truncateText(task.comment, 52)}</small>}
      </button>
      <div className="plan-task-actions"><button type="button" className="plan-schedule-button" onClick={onSchedule} disabled={disabled} aria-label={`${task.title}を時間割へ追加`}>◷</button></div>
    </article>
  );
}

function PlanTaskPreview({ task }: { task: Task }) {
  return <div className="plan-task-card drag-preview"><span className="plan-drag-handle">⠿</span><div className="plan-task-content"><strong>{truncateText(task.title, 34)}</strong><span className="plan-task-meta"><b className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}</b>{formatDueLabel(task.dueDate, task.dueTime)}</span></div></div>;
}

function ScheduleTimeline({ items, tasks, loading, saving, onAdd, onEdit, onOpenTask, onDelete, onResize, onComplete }: { items: ScheduleItem[]; tasks: Task[]; loading: boolean; saving: boolean; onAdd: () => void; onEdit: (item: ScheduleItem) => void; onOpenTask: (task: Task) => void; onDelete: (item: ScheduleItem) => void; onResize: (item: ScheduleItem, endTime: string) => void; onComplete: (task: Task) => void }) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const layouts = getScheduleLayouts(items);
  return (
    <section className="schedule-panel" aria-labelledby="schedule-title">
      <div className="schedule-panel-header"><div><p className="eyebrow">TIME BLOCKS</p><h2 id="schedule-title">今日のスケジュール</h2><p className="muted">タスク、自由予定、確認リマインドを同じ時間軸で見る。</p></div><button type="button" className="secondary-button" onClick={onAdd}>＋ 予定を追加</button></div>
      {loading ? <div className="schedule-loading">時間割を読み込んでいます…</div> : <div className="schedule-grid-scroll" role="region" aria-label="今日の時間割。スクロールできます" tabIndex={0}>
        <div className="schedule-grid" style={{ gridTemplateRows: `repeat(${SCHEDULE_SLOTS.length}, ${SCHEDULE_SLOT_HEIGHT}px)` }}>
          {SCHEDULE_SLOTS.map((time, index) => <ScheduleSlot key={time} time={time} row={index + 1} />)}
          <div className="schedule-block-layer">
            {layouts.map(({ item, startIndex, span, column, columnCount }) => {
              const reminderTask = reviewReminderTaskId(item.id);
              const task = item.taskId ? taskById.get(item.taskId) : reminderTask ? taskById.get(reminderTask) : undefined;
              const displayTitle = isReviewReminder(item) ? item.title : (task?.title ?? item.title);
              return <ScheduleBlock key={item.id} item={item} title={displayTitle} task={isReviewReminder(item) ? undefined : task} startIndex={startIndex} span={span} column={column} columnCount={columnCount} disabled={saving} onEdit={() => (isReviewReminder(item) && task ? onOpenTask(task) : onEdit(item))} onDelete={() => onDelete(item)} onResize={(endTime) => onResize(item, endTime)} onComplete={onComplete} />;
            })}
          </div>
        </div>
      </div>}
      {!loading && items.length === 0 && <p className="schedule-empty">予定はまだありません。タスクをここへドラッグするか、自由予定を追加できます。</p>}
    </section>
  );
}

function ScheduleSlot({ time, row }: { time: string; row: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${SCHEDULE_SLOT_PREFIX}${time}` });
  return <div ref={setNodeRef} style={{ gridRow: row }} className={`schedule-slot ${isOver ? "drop-active" : ""}`}><span>{time.endsWith(":00") ? time : ""}</span></div>;
}

type ScheduleLayout = { item: ScheduleItem; startIndex: number; span: number; column: number; columnCount: number };

function getScheduleLayouts(items: ScheduleItem[]): ScheduleLayout[] {
  const candidates = items
    .map((item) => {
      const startMinutes = toMinutes(item.startTime);
      const endMinutes = toMinutes(item.endTime);
      const startIndex = Math.floor((startMinutes - SCHEDULE_START_MINUTES) / SCHEDULE_SLOT_MINUTES);
      const endIndex = Math.ceil((endMinutes - SCHEDULE_START_MINUTES) / SCHEDULE_SLOT_MINUTES);
      if (startIndex < 0 || startIndex >= SCHEDULE_SLOTS.length) return null;
      return { item, startMinutes, endMinutes, startIndex, span: Math.max(1, Math.min(SCHEDULE_SLOTS.length - startIndex, endIndex - startIndex)) };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || a.item.sortOrder - b.item.sortOrder || a.item.id.localeCompare(b.item.id));

  const layouts: ScheduleLayout[] = [];
  let group: ScheduleLayout[] = [];
  let columnEndMinutes: number[] = [];
  let groupEndMinutes = Number.NEGATIVE_INFINITY;

  function finishGroup() {
    const columnCount = columnEndMinutes.length;
    for (const layout of group) layout.columnCount = columnCount;
    group = [];
    columnEndMinutes = [];
    groupEndMinutes = Number.NEGATIVE_INFINITY;
  }

  for (const candidate of candidates) {
    if (group.length > 0 && candidate.startMinutes >= groupEndMinutes) finishGroup();
    let column = columnEndMinutes.findIndex((endMinutes) => endMinutes <= candidate.startMinutes);
    if (column < 0) {
      column = columnEndMinutes.length;
      columnEndMinutes.push(candidate.endMinutes);
    } else {
      columnEndMinutes[column] = candidate.endMinutes;
    }
    const layout: ScheduleLayout = { item: candidate.item, startIndex: candidate.startIndex, span: candidate.span, column, columnCount: 0 };
    group.push(layout);
    layouts.push(layout);
    groupEndMinutes = Math.max(groupEndMinutes, candidate.endMinutes);
  }
  finishGroup();
  return layouts;
}

function ScheduleBlock({ item, title, task, startIndex, span, column, columnCount, disabled, onEdit, onDelete, onResize, onComplete }: { item: ScheduleItem; title: string; task?: Task; startIndex: number; span: number; column: number; columnCount: number; disabled: boolean; onEdit: () => void; onDelete: () => void; onResize: (endTime: string) => void; onComplete: (task: Task) => void }) {
  const isTask = item.itemType === "task";
  const isReview = isReviewReminder(item);
  const [liveSpan, setLiveSpan] = useState<number | null>(null);
  const resizeOrigin = useRef<{ y: number; span: number } | null>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${SCHEDULE_ITEM_PREFIX}${item.id}`, disabled: disabled || isReview });
  const displaySpan = liveSpan ?? span;
  const columnWidth = 100 / columnCount;
  const startMinutes = toMinutes(item.startTime);
  const endMinutes = toMinutes(item.endTime);
  const top = isReview ? ((startMinutes - SCHEDULE_START_MINUTES) / SCHEDULE_SLOT_MINUTES) * SCHEDULE_SLOT_HEIGHT + 2 : startIndex * SCHEDULE_SLOT_HEIGHT + 3;
  const height = isReview ? Math.max(22, ((endMinutes - startMinutes) / SCHEDULE_SLOT_MINUTES) * SCHEDULE_SLOT_HEIGHT - 4) : undefined;
  const style = { top: `${top}px`, height: isReview ? `${height}px` : `calc(${displaySpan * SCHEDULE_SLOT_HEIGHT}px - 6px)`, left: `${column * columnWidth}%`, width: `calc(${columnWidth}% - var(--schedule-block-gap))`, transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.35 : 1 };

  function spanFromPointer(clientY: number) {
    const origin = resizeOrigin.current;
    if (!origin) return span;
    const delta = Math.round((clientY - origin.y) / SCHEDULE_SLOT_HEIGHT);
    return Math.max(1, Math.min(SCHEDULE_SLOTS.length - startIndex, origin.span + delta));
  }

  function handleResizePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    resizeOrigin.current = { y: event.clientY, span };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeOrigin.current) return;
    setLiveSpan(spanFromPointer(event.clientY));
  }

  function handleResizePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeOrigin.current) return;
    const nextSpan = spanFromPointer(event.clientY);
    resizeOrigin.current = null;
    setLiveSpan(null);
    const endTime = minutesToTime(SCHEDULE_START_MINUTES + (startIndex + nextSpan) * SCHEDULE_SLOT_MINUTES);
    if (endTime !== item.endTime) onResize(endTime);
  }

  return <article ref={setNodeRef} style={style} className={`schedule-block ${isTask ? "task" : "event"}${isReview ? " review" : ""}`} {...(isReview ? {} : attributes)} {...(isReview ? {} : listeners)} title={isReview ? "確認リマインド。クリックするとタスクを開けます。" : "ドラッグして時間帯を動かせます。下端で長さを変えられます。"} onClick={isReview ? onEdit : undefined}>
    <div className="schedule-block-main"><span>{item.startTime}–{isReview ? item.endTime : minutesToTime(SCHEDULE_START_MINUTES + (startIndex + displaySpan) * SCHEDULE_SLOT_MINUTES)}</span><strong>{truncateText(title, 38)}</strong>{item.comment && <small>{truncateText(item.comment, 52)}</small>}</div>
    <div className="schedule-block-actions"><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onEdit(); }} aria-label={isReview ? `${title}のタスクを開く` : `${title}の予定を編集`}>✎</button>{task && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onComplete(task); }} aria-label={`${title}を完了にする`}>○</button>}{!isReview && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDelete(); }} aria-label={`${title}の予定を削除`}>×</button>}</div>
    {!isReview && <button type="button" className="schedule-block-resize" aria-label={`${title}の時間幅を変更`} disabled={disabled} onPointerDown={handleResizePointerDown} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={() => { resizeOrigin.current = null; setLiveSpan(null); }} />}
  </article>;
}

function ScheduleModal({ editor, onClose, onSave, onDelete, saving }: { editor: { item?: ScheduleItem; task?: Task; startTime?: string }; onClose: () => void; onSave: (input: CreateScheduleItemInput, item?: ScheduleItem) => Promise<void>; onDelete: (item: ScheduleItem) => Promise<void>; saving: boolean }) {
  const item = editor.item;
  const task = editor.task;
  const isTask = item?.itemType === "task" || Boolean(task);
  const [title, setTitle] = useState(item?.title ?? task?.title ?? "");
  const [comment, setComment] = useState(item?.comment ?? "");
  const [startTime, setStartTime] = useState(item?.startTime ?? editor.startTime ?? TASK_DAY_START_TIME);
  const [endTime, setEndTime] = useState(item?.endTime ?? addMinutesToTime(editor.startTime ?? TASK_DAY_START_TIME, 60));
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSave({ scheduleDate: item?.scheduleDate ?? todayInTokyo(), startTime, endTime, itemType: isTask ? "task" : "event", taskId: isTask ? (item?.taskId ?? task?.id ?? null) : null, title, comment }, item);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "予定を保存できませんでした。");
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
      <div className="modal-header"><div><p className="eyebrow">{isTask ? "TASK BLOCK" : "FREE EVENT"}</p><h2 id="schedule-modal-title">{item ? "予定を編集" : isTask ? "タスクを時間割へ追加" : "自由予定を追加"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="閉じる">×</button></div>
      <form onSubmit={submit}>
        <label htmlFor="schedule-title">予定名</label>
        <input id="schedule-title" aria-label="予定名" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required disabled={isTask} autoFocus={!isTask} />
        {isTask && <p className="schedule-linked-task">今日のスケジュールに載せています。タスクの期日は変わりません。</p>}
        <div className="schedule-time-fields"><div><label htmlFor="schedule-start">開始</label><input id="schedule-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></div><div><label htmlFor="schedule-end">終了</label><input id="schedule-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></div></div>
        <label htmlFor="schedule-comment">メモ</label>
        <textarea id="schedule-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3} placeholder="会議のURL、持ち物、補足など" />
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="modal-actions">{item && <button type="button" className="complete-button schedule-delete-button" onClick={() => void onDelete(item)} disabled={saving}>スケジュールから外す</button>}<button type="button" className="secondary-button" onClick={onClose} disabled={saving}>キャンセル</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "保存中…" : "予定を保存"}</button></div>
      </form>
    </section>
  </div>;
}

function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function addMinutesToTime(time: string, amount: number): string {
  const [hours, minutes] = time.split(":").map(Number);
  return minutesToTime(hours * 60 + minutes + amount);
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const MATRIX_TITLE_MAX_LENGTH = 20;
const MATRIX_COMMENT_MAX_LENGTH = 36;

function truncateText(value: string, maxLength: number) {
  const characters = Array.from(value);
  return characters.length > maxLength ? `${characters.slice(0, maxLength).join("")}...` : value;
}

function MatrixView({ tasks, onMove, onEdit, onAdd }: { tasks: Task[]; onMove: (task: Task, isUrgent: boolean, isImportant: boolean) => void; onEdit: (task: Task) => void; onAdd: (priority: Priority) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);

  return (
    <div className="content-wrap">
      <PageHeading eyebrow="URGENT / IMPORTANT" title="優先度マトリクス" description="タスクを置く場所で、次の一手を決める。" />
      <div className="matrix-legend"><span>緊急度 <b>高 ↑</b></span><span>重要度 <b>高 →</b></span></div>
      <div className="matrix-grid">
        {MATRIX_QUADRANTS.map((quadrant) => {
          const items = tasks.filter((task) => task.priority === quadrant.priority);
          return (
            <section
              key={quadrant.priority}
              className={`quadrant quadrant-${quadrant.priority.toLowerCase()}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const task = tasks.find((item) => item.id === dragging);
                if (task) onMove(task, quadrant.urgent, quadrant.important);
                setDragging(null);
              }}
            >
              <div className="quadrant-heading">
                <div><span className="priority-badge">{quadrant.priority}</span><h2>{quadrant.label}</h2><p>{quadrant.sub}</p></div>
                <div className="quadrant-heading-actions"><button type="button" className="quadrant-add-button" onClick={() => onAdd(quadrant.priority)} aria-label={`${quadrant.priority}にタスクを追加`}>＋ 追加</button><strong>{items.length}</strong></div>
              </div>
              {items.length === 0 ? <p className="quadrant-empty">ここにタスクを置く</p> : (
                <div className="quadrant-tasks">
                  {items.map((task) => (
                    <article className="matrix-task" draggable onDragStart={() => setDragging(task.id)} onDragEnd={() => setDragging(null)} key={task.id}>
                      <button type="button" className="matrix-task-content" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}>
                        <strong title={task.title}>{truncateText(task.title, MATRIX_TITLE_MAX_LENGTH)}</strong>
                        <span>{formatDueLabel(task.dueDate, task.dueTime)}</span>
                        {task.comment && <span className="matrix-task-comment" title={task.comment}>{truncateText(task.comment, MATRIX_COMMENT_MAX_LENGTH)}</span>}
                      </button>
                      <div className="matrix-actions">
                        <select aria-label={`${task.title}の移動先`} value={task.priority} onChange={(event) => { const target = MATRIX_QUADRANTS.find((item) => item.priority === event.target.value); if (target) onMove(task, target.urgent, target.important); }}>
                          <option value="P1">P1 今すぐやる</option><option value="P2">P2 予定する</option><option value="P3">P3 手早くやる</option><option value="P4">P4 あとで</option>
                        </select>
                        <button className="icon-button" onClick={() => onEdit(task)} aria-label={`${task.title}を編集`}>✎</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="matrix-hint">PCではタスクをドラッグ、タッチ端末では「移動先」メニューから象限を変更できます。</p>
    </div>
  );
}

function TaskList({ tasks, onEdit, onComplete, onRestore, onDelete, showCompleted = false, showOverdue = false }: { tasks: Task[]; onEdit: (task: Task) => void; onComplete?: (task: Task) => void; onRestore?: (task: Task) => void; onDelete?: (task: Task) => void; showCompleted?: boolean; showOverdue?: boolean }) { return <div className="task-list">{tasks.map((task) => <article className={task.status === "done" ? "task-row completed" : "task-row"} key={task.id}><button className="check-button" onClick={() => task.status === "done" ? onRestore?.(task) : onComplete?.(task)} aria-label={task.status === "done" ? `${task.title}を未完了に戻す` : `${task.title}を完了にする`}>{task.status === "done" ? "↶" : "○"}</button><button type="button" className="task-main task-open-button" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}><strong>{task.title}</strong>{task.comment && <span className="task-comment">{task.comment}</span>}<span className="task-meta"><span className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}・{PRIORITY_LABELS[task.priority]}</span><span className={showOverdue && overdueDays(task.dueDate) > 0 ? "overdue-text" : ""}>{formatDueLabel(task.dueDate, task.dueTime)}{showOverdue && overdueDays(task.dueDate) > 0 ? `（${overdueDays(task.dueDate)}日超過）` : ""}</span>{task.status === "done" && <span>完了済み</span>}</span></button><div className="task-actions"><button className="icon-button" onClick={() => onEdit(task)} aria-label={`${task.title}を編集`}>✎</button>{showCompleted && task.status === "done" && onRestore && <button className="restore-button" onClick={() => onRestore(task)}>復元</button>}{onDelete && task.status !== "done" && <button className="icon-button danger" onClick={() => onDelete(task)} aria-label={`${task.title}を削除`}>⌫</button>}</div></article>)}</div>; }

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span aria-hidden="true">✦</span><p>{text}</p></div>; }

function TaskModal({ task, initialValues, onClose, onSave, onComplete }: { task?: Task; initialValues?: NewTaskDefaults; onClose: () => void; onSave: (input: { title: string; comment: string; dueDate: string; dueTime: string; isUrgent: boolean; isImportant: boolean; category: TaskCategory; reviewOutlineAt: string; reviewMidAt: string; reviewAlmostAt: string; reviewManual: boolean }, task?: Task) => Promise<void>; onComplete?: (task: Task) => Promise<boolean> }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [comment, setComment] = useState(task?.comment ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? todayInTokyo());
  const [dueTime, setDueTime] = useState(task?.dueTime ?? DEFAULT_DUE_TIME);
  const [isUrgent, setIsUrgent] = useState(task?.isUrgent ?? initialValues?.isUrgent ?? false);
  const [isImportant, setIsImportant] = useState(task?.isImportant ?? initialValues?.isImportant ?? false);
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? initialValues?.category ?? "default");
  const [reviewManual, setReviewManual] = useState(task?.reviewManual ?? false);
  const initialSchedule = calculateReviewSchedule({ dueDate: task?.dueDate ?? todayInTokyo(), dueTime: task?.dueTime ?? DEFAULT_DUE_TIME, category: task?.category ?? initialValues?.category ?? "default" });
  const [reviewOutlineAt, setReviewOutlineAt] = useState(() => toDateTimeLocal(task?.reviewOutlineAt ?? null) || toDateTimeLocal(initialSchedule.reviewOutlineAt));
  const [reviewMidAt, setReviewMidAt] = useState(() => toDateTimeLocal(task?.reviewMidAt ?? null) || toDateTimeLocal(initialSchedule.reviewMidAt));
  const [reviewAlmostAt, setReviewAlmostAt] = useState(() => toDateTimeLocal(task?.reviewAlmostAt ?? null) || toDateTimeLocal(initialSchedule.reviewAlmostAt));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  function applyCalculatedReviews(nextDueDate = dueDate, nextDueTime = dueTime, nextCategory = category) {
    const schedule = calculateReviewSchedule({ dueDate: nextDueDate, dueTime: nextDueTime, category: nextCategory });
    setReviewOutlineAt(toDateTimeLocal(schedule.reviewOutlineAt));
    setReviewMidAt(toDateTimeLocal(schedule.reviewMidAt));
    setReviewAlmostAt(toDateTimeLocal(schedule.reviewAlmostAt));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({ title, comment, dueDate, dueTime, isUrgent, isImportant, category, reviewOutlineAt, reviewMidAt, reviewAlmostAt, reviewManual }, task);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey) || event.nativeEvent.isComposing || saving || completing) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  async function toggleComplete() {
    if (!task || !onComplete) return;
    setCompleting(true);
    const succeeded = await onComplete(task);
    if (succeeded) onClose();
    else setCompleting(false);
  }

  const priority = calculatePriority(isUrgent, isImportant);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div className="modal-header">
          <div><p className="eyebrow">{task ? "EDIT TASK" : "NEW TASK"}</p><h2 id="task-modal-title">{task ? "タスクを編集" : "新しいタスク"}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <form onSubmit={submit} onKeyDown={handleKeyDown}>
          <label htmlFor="task-title">タスク名</label>
          <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required autoFocus />
          <label htmlFor="task-category">カテゴリ</label>
          <select id="task-category" value={category} onChange={(event) => { const next = event.target.value as TaskCategory; setCategory(next); if (!reviewManual) applyCalculatedReviews(dueDate, dueTime, next); }}>
            <option value="default">通常</option>
            <option value="private">プライベート</option>
          </select>
          <label htmlFor="task-comment">コメント</label>
          <textarea id="task-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} placeholder="補足、次にやること、参考情報など" />
          <div className="due-fields">
            <div>
              <label htmlFor="task-due">期日 <span className="required">必須</span></label>
              <input id="task-due" type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); if (!reviewManual) applyCalculatedReviews(event.target.value, dueTime, category); }} required />
            </div>
            <div>
              <label htmlFor="task-start-time">開始</label>
              <input id="task-start-time" type="time" value={TASK_DAY_START_TIME} readOnly />
            </div>
            <div>
              <label htmlFor="task-due-time">完了予定</label>
              <input id="task-due-time" type="time" value={dueTime} onChange={(event) => { setDueTime(event.target.value); if (!reviewManual) applyCalculatedReviews(dueDate, event.target.value, category); }} required />
            </div>
          </div>
          <div className="boolean-grid">
            <label className="boolean-option"><input type="checkbox" checked={isUrgent} onChange={(event) => setIsUrgent(event.target.checked)} /><span><b>緊急</b><small>今日の判断が必要</small></span></label>
            <label className="boolean-option"><input type="checkbox" checked={isImportant} onChange={(event) => setIsImportant(event.target.checked)} /><span><b>重要</b><small>目的への影響が大きい</small></span></label>
          </div>
          <div className={`priority-preview ${priority.toLowerCase()}`}><span className="priority-badge">{priority}</span><div><b>{PRIORITY_LABELS[priority]}</b><small>緊急度と重要度から自動算出</small></div></div>
          <div className="review-panel">
            <div className="review-panel-header">
              <div><p className="eyebrow">REVIEW POINTS</p><h3>進捗確認</h3><p className="muted">10:00-19:00で算出。通常は土日を除き、プライベートは休日も含めます。15分単位に四捨五入します。</p></div>
              <span className="count-pill">{calculateReviewSchedule({ dueDate, dueTime, category }).workHours}時間</span>
            </div>
            <label className="toggle review-manual"><input type="checkbox" checked={reviewManual} onChange={(event) => { setReviewManual(event.target.checked); if (!event.target.checked) applyCalculatedReviews(); }} /><span>手動変更（自動再計算しない）</span></label>
            <div className="review-fields">
              <div><label htmlFor="review-outline">{REVIEW_LABELS.outline}</label><input id="review-outline" type="datetime-local" value={reviewOutlineAt} onChange={(event) => { setReviewManual(true); setReviewOutlineAt(event.target.value); }} /></div>
              <div><label htmlFor="review-mid">{REVIEW_LABELS.mid}</label><input id="review-mid" type="datetime-local" value={reviewMidAt} onChange={(event) => { setReviewManual(true); setReviewMidAt(event.target.value); }} /></div>
              <div><label htmlFor="review-almost">{REVIEW_LABELS.almost}</label><input id="review-almost" type="datetime-local" value={reviewAlmostAt} onChange={(event) => { setReviewManual(true); setReviewAlmostAt(event.target.value); }} /></div>
            </div>
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="modal-actions">
            {task && onComplete && <button type="button" className="complete-button" onClick={toggleComplete} disabled={saving || completing}>{completing ? "更新中…" : task.status === "done" ? "未完了に戻す" : "完了にする"}</button>}
            <span className="keyboard-hint">⌘ / Ctrl + Enter で保存</span>
            <button type="button" className="secondary-button" onClick={onClose} disabled={completing}>キャンセル</button>
            <button type="submit" className="primary-button" disabled={saving || completing}>{saving ? "保存中…" : "保存する"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
