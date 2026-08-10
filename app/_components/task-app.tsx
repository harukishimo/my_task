"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Priority, Task } from "@/types/task";
import { calculatePriority, PRIORITY_LABELS } from "@/lib/tasks/priority";
import { dashboardMetrics, dueDateSort, prioritySort, priorityTasks } from "@/lib/tasks/selectors";
import { overdueDays, todayInTokyo } from "@/lib/tasks/date";
import LogoMark from "@/app/_components/logo-mark";

type View = "dashboard" | "all" | "due" | "matrix" | "plan";
type NewTaskDefaults = Pick<Task, "isUrgent" | "isImportant">;

const PRIORITY_DEFAULTS: Record<Priority, NewTaskDefaults> = {
  P1: { isUrgent: true, isImportant: true },
  P2: { isUrgent: false, isImportant: true },
  P3: { isUrgent: true, isImportant: false },
  P4: { isUrgent: false, isImportant: false },
};

const navItems: Array<{ href: string; view: View; label: string; icon: string }> = [
  { href: "/dashboard", view: "dashboard", label: "ダッシュボード", icon: "⌂" },
  { href: "/all", view: "all", label: "TODO ALL", icon: "☷" },
  { href: "/due", view: "due", label: "今日まで", icon: "◷" },
  { href: "/matrix", view: "matrix", label: "マトリクス", icon: "⊞" },
  { href: "/plan", view: "plan", label: "今日の段取り", icon: "≡" },
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

  async function saveTask(input: { title: string; comment: string; dueDate: string; isUrgent: boolean; isImportant: boolean }, task?: Task) {
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

  async function patchTask(task: Task, update: Record<string, unknown>, successText: string): Promise<boolean> {
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
      setNotice({ type: "success", text: successText });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "更新できませんでした。" });
      await loadTasks();
      return false;
    }
  }

  async function savePlan(orderedTasks: Task[], removedTask?: Task) {
    const today = todayInTokyo();
    const operations = [
      ...orderedTasks.map((task, index) => ({ task, planDate: today, planOrder: index + 1 })),
      ...(removedTask ? [{ task: removedTask, planDate: null, planOrder: null }] : []),
    ];
    if (operations.length === 0) return;
    mutationVersion.current += 1;
    try {
      const results = await Promise.all(operations.map(async ({ task, planDate, planOrder }) => {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planDate, planOrder, version: task.version }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message ?? "段取りを保存できませんでした。");
        return body.data as Task;
      }));
      setTasks((current) => current.map((task) => results.find((result) => result.id === task.id) ?? task));
      setNotice({ type: "success", text: removedTask ? "段取りを更新しました。" : "段取りの順番を保存しました。" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "段取りを保存できませんでした。" });
      await loadTasks();
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
          {view === "due" && <DueView tasks={tasks} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} onEdit={openTask} />}
          {view === "matrix" && <MatrixView tasks={active} onMove={(task, isUrgent, isImportant) => patchTask(task, { isUrgent, isImportant }, "優先度マトリクスを更新しました。")} onEdit={openTask} onAdd={(priority) => openNewTask(PRIORITY_DEFAULTS[priority])} />}
          {view === "plan" && <PlanningView tasks={tasks} onEdit={openTask} onPlanChange={savePlan} />}
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

function AllView({ active, completed, showCompleted, setShowCompleted, sort, setSort, onEdit, onComplete, onRestore, onDelete, onAdd }: { active: Task[]; completed: Task[]; showCompleted: boolean; setShowCompleted: (value: boolean) => void; sort: "due" | "priority"; setSort: (value: "due" | "priority") => void; onEdit: (task: Task) => void; onComplete: (task: Task) => void; onRestore: (task: Task) => void; onDelete: (task: Task) => void; onAdd: () => void }) {
  const ordered = sort === "due" ? dueDateSort(active) : prioritySort(active);
  return <div className="content-wrap"><PageHeading eyebrow="ALL TASKS" title="TODO ALL" description={`${active.length}件の未完了タスク`} action={<button className="primary-button" onClick={onAdd}>＋ タスクを追加</button>} /><section className="panel"><div className="toolbar"><div className="segmented"><button className={sort === "due" ? "selected" : ""} onClick={() => setSort("due")}>期日順</button><button className={sort === "priority" ? "selected" : ""} onClick={() => setSort("priority")}>優先度順</button></div><label className="toggle"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /><span>完了済みを表示</span></label></div>{ordered.length === 0 && !showCompleted ? <EmptyState text="未完了タスクはありません。" /> : <TaskList tasks={showCompleted ? [...ordered, ...completed] : ordered} onEdit={onEdit} onComplete={onComplete} onRestore={onRestore} onDelete={onDelete} showCompleted={showCompleted} />}</section></div>;
}

function DueView({ tasks, onComplete, onEdit }: { tasks: Task[]; onComplete: (task: Task) => void; onEdit: (task: Task) => void }) {
  const today = todayInTokyo();
  const due = tasks.filter((task) => !task.isDeleted && task.status === "todo" && task.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = due.filter((task) => task.dueDate < today);
  const dueToday = due.filter((task) => task.dueDate === today);
  return <div className="content-wrap"><PageHeading eyebrow="FOCUS / TODAY" title="今日まで" description="期限切れと、本日期限のタスク" /><div className="due-summary"><div><span>期限切れ</span><strong>{overdue.length}</strong></div><div><span>今日</span><strong>{dueToday.length}</strong></div></div>{due.length === 0 ? <section className="panel"><EmptyState text="今日までのタスクはありません。" /></section> : <>{overdue.length > 0 && <DueSection title="期限切れ" subtitle="日付を越えているタスク" tasks={overdue} onComplete={onComplete} onEdit={onEdit} />} {dueToday.length > 0 && <DueSection title="今日が期限" subtitle="今日中に判断するタスク" tasks={dueToday} onComplete={onComplete} onEdit={onEdit} />}</>}</div>;
}

function DueSection({ title, subtitle, tasks, onComplete, onEdit }: { title: string; subtitle: string; tasks: Task[]; onComplete: (task: Task) => void; onEdit: (task: Task) => void }) { return <section className="panel due-section"><div className="panel-header"><div><h2>{title}</h2><p className="muted">{subtitle}</p></div><span className="count-pill">{tasks.length}件</span></div><TaskList tasks={tasks} onEdit={onEdit} onComplete={onComplete} showOverdue /></section>; }

const PLAN_DROPZONE_ID = "today-plan-dropzone";
const UNPLANNED_DROPZONE_ID = "unplanned-dropzone";

function planCollisionDetection(args: Parameters<typeof pointerWithin>[0]) {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
}

function PlanningView({ tasks, onEdit, onPlanChange }: { tasks: Task[]; onEdit: (task: Task) => void; onPlanChange: (orderedTasks: Task[], removedTask?: Task) => Promise<void> }) {
  const today = todayInTokyo();
  const activeTasks = tasks.filter((task) => !task.isDeleted && task.status === "todo");
  const initialPlannedIds = activeTasks
    .filter((task) => task.planDate === today)
    .sort((a, b) => (a.planOrder ?? Number.MAX_SAFE_INTEGER) - (b.planOrder ?? Number.MAX_SAFE_INTEGER) || a.createdAt.localeCompare(b.createdAt))
    .map((task) => task.id);
  const [plannedIds, setPlannedIds] = useState(initialPlannedIds);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Keep the local drag order aligned with persisted task changes and date changes.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (saving) return;
    setPlannedIds((current) => current.length === initialPlannedIds.length && current.every((id, index) => id === initialPlannedIds[index]) ? current : initialPlannedIds);
  }, [tasks, today, saving]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const taskById = new Map(activeTasks.map((task) => [task.id, task]));
  const planned = plannedIds.map((id) => taskById.get(id)).filter((task): task is Task => Boolean(task));
  const plannedSet = new Set(planned.map((task) => task.id));
  const unplanned = activeTasks.filter((task) => !plannedSet.has(task.id));
  const draggingTask = draggingId ? taskById.get(draggingId) : undefined;

  async function persistOrder(nextIds: string[], removedTask?: Task) {
    if (saving) return;
    setPlannedIds(nextIds);
    const nextTasks = nextIds.map((id) => taskById.get(id)).filter((task): task is Task => Boolean(task));
    setSaving(true);
    try {
      await onPlanChange(nextTasks, removedTask);
    } finally {
      setSaving(false);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const currentIndex = plannedIds.indexOf(activeId);
    const isPlanned = currentIndex >= 0;
    const activeTask = taskById.get(activeId);
    if (!activeTask) return;

    if (overId === UNPLANNED_DROPZONE_ID && isPlanned) {
      persistOrder(plannedIds.filter((id) => id !== activeId), activeTask);
      return;
    }
    if (!isPlanned && (overId === PLAN_DROPZONE_ID || plannedIds.includes(overId))) {
      const targetIndex = overId === PLAN_DROPZONE_ID ? plannedIds.length : plannedIds.indexOf(overId);
      const nextIds = [...plannedIds];
      nextIds.splice(Math.max(targetIndex, 0), 0, activeId);
      persistOrder(nextIds);
      return;
    }
    if (isPlanned && plannedIds.includes(overId) && activeId !== overId) {
      persistOrder(arrayMove(plannedIds, currentIndex, plannedIds.indexOf(overId)));
    }
  }

  function moveByButton(index: number, offset: number) {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= plannedIds.length) return;
    persistOrder(arrayMove(plannedIds, index, targetIndex));
  }

  return (
    <div className="content-wrap planning-page">
      <PageHeading eyebrow="TODAY / PLAN" title="今日の段取り" description={`${planned.length}件の実行順を決める。`} />
      <DndContext sensors={sensors} collisionDetection={planCollisionDetection} onDragStart={({ active }) => setDraggingId(String(active.id))} onDragCancel={() => setDraggingId(null)} onDragEnd={handleDragEnd}>
        <PlanningDropzones
          unplanned={unplanned}
          planned={planned}
          disabled={saving}
          onEdit={onEdit}
          onMoveUp={(index) => moveByButton(index, -1)}
          onMoveDown={(index) => moveByButton(index, 1)}
          onRemove={(task) => persistOrder(plannedIds.filter((id) => id !== task.id), task)}
        />
        <DragOverlay>{draggingTask ? <PlanTaskPreview task={draggingTask} /> : null}</DragOverlay>
      </DndContext>
      <p className="planning-hint">タスクの左端をドラッグして追加・並び替えできます。スマホでは上下ボタンも使えます。</p>
    </div>
  );
}

function PlanningDropzones({ unplanned, planned, disabled, onEdit, onMoveUp, onMoveDown, onRemove }: { unplanned: Task[]; planned: Task[]; disabled: boolean; onEdit: (task: Task) => void; onMoveUp: (index: number) => void; onMoveDown: (index: number) => void; onRemove: (task: Task) => void }) {
  const { setNodeRef: setPlanDropRef, isOver: isOverPlan } = useDroppable({ id: PLAN_DROPZONE_ID });
  const { setNodeRef: setUnplannedDropRef, isOver: isOverUnplanned } = useDroppable({ id: UNPLANNED_DROPZONE_ID });
  return (
    <div className="planning-layout">
      <section className="planning-panel" aria-labelledby="unplanned-title">
        <div className="planning-panel-header"><div><p className="eyebrow">SOURCE TASKS</p><h2 id="unplanned-title">未計画タスク</h2></div><span className="count-pill">{unplanned.length}件</span></div>
        <div id={UNPLANNED_DROPZONE_ID} ref={setUnplannedDropRef} className={`planning-dropzone ${isOverUnplanned ? "drop-active" : ""}`}>
          <SortableContext items={unplanned.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {unplanned.length === 0 ? <p className="planning-empty">未計画のタスクはありません。</p> : unplanned.map((task) => <PlanTaskCard key={task.id} task={task} disabled={disabled} onEdit={onEdit} />)}
          </SortableContext>
        </div>
      </section>
      <section id={PLAN_DROPZONE_ID} ref={setPlanDropRef} className={`planning-panel planning-queue-panel ${isOverPlan ? "drop-active" : ""}`} aria-labelledby="planned-title">
        <div className="planning-panel-header"><div><p className="eyebrow">EXECUTION ORDER</p><h2 id="planned-title">今日の実行順</h2></div><span className="count-pill">{planned.length}件</span></div>
        <div className="planning-dropzone planning-queue">
          <SortableContext items={planned.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {planned.length === 0 ? <p className="planning-empty">ここへタスクをドラッグすると、今日の段取りに追加されます。</p> : planned.map((task, index) => <PlanTaskCard key={task.id} task={task} planned disabled={disabled} index={index} total={planned.length} onEdit={onEdit} onMoveUp={() => onMoveUp(index)} onMoveDown={() => onMoveDown(index)} onRemove={() => onRemove(task)} />)}
          </SortableContext>
        </div>
      </section>
    </div>
  );
}

function PlanTaskCard({ task, planned = false, disabled = false, index = 0, total = 0, onEdit, onMoveUp, onMoveDown, onRemove }: { task: Task; planned?: boolean; disabled?: boolean; index?: number; total?: number; onEdit: (task: Task) => void; onMoveUp?: () => void; onMoveDown?: () => void; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  return (
    <article ref={setNodeRef} style={style} className={`plan-task-card ${planned ? "planned" : ""}`} data-plan-task-id={task.id} data-plan-task-title={task.title}>
      <button type="button" className="plan-drag-handle" disabled={disabled} {...attributes} {...listeners} aria-label={`${task.title}をドラッグ`}>⠿</button>
      <button type="button" className="plan-task-content" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}>
        <strong title={task.title}>{truncateText(task.title, 34)}</strong>
        <span className="plan-task-meta"><b className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}</b>{task.dueDate}</span>
        {task.comment && <small title={task.comment}>{truncateText(task.comment, 52)}</small>}
      </button>
      {planned && <div className="plan-task-actions"><button type="button" className="plan-order-button" onClick={onMoveUp} disabled={disabled || index === 0} aria-label={`${task.title}を上へ移動`}>↑</button><button type="button" className="plan-order-button" onClick={onMoveDown} disabled={disabled || index === total - 1} aria-label={`${task.title}を下へ移動`}>↓</button><button type="button" className="plan-remove-button" onClick={onRemove} disabled={disabled} aria-label={`${task.title}を段取りから外す`}>×</button></div>}
    </article>
  );
}

function PlanTaskPreview({ task }: { task: Task }) {
  return <div className="plan-task-card planned drag-preview"><span className="plan-drag-handle">⠿</span><div className="plan-task-content"><strong>{truncateText(task.title, 34)}</strong><span className="plan-task-meta"><b className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}</b>{task.dueDate}</span></div></div>;
}

const MATRIX_TITLE_MAX_LENGTH = 20;
const MATRIX_COMMENT_MAX_LENGTH = 36;

function truncateText(value: string, maxLength: number) {
  const characters = Array.from(value);
  return characters.length > maxLength ? `${characters.slice(0, maxLength).join("")}...` : value;
}

function MatrixView({ tasks, onMove, onEdit, onAdd }: { tasks: Task[]; onMove: (task: Task, isUrgent: boolean, isImportant: boolean) => void; onEdit: (task: Task) => void; onAdd: (priority: Priority) => void }) {
  const quadrants: Array<{ priority: Priority; urgent: boolean; important: boolean; label: string; sub: string }> = [
    { priority: "P1", urgent: true, important: true, label: "今すぐやる", sub: "緊急 × 重要" },
    { priority: "P2", urgent: false, important: true, label: "予定する", sub: "非緊急 × 重要" },
    { priority: "P3", urgent: true, important: false, label: "手早くやる", sub: "緊急 × 非重要" },
    { priority: "P4", urgent: false, important: false, label: "あとで", sub: "非緊急 × 非重要" },
  ];
  const [dragging, setDragging] = useState<string | null>(null);

  return (
    <div className="content-wrap">
      <PageHeading eyebrow="URGENT / IMPORTANT" title="優先度マトリクス" description="タスクを置く場所で、次の一手を決める。" action={<button className="primary-button" onClick={() => onAdd("P4")}>＋ タスクを追加</button>} />
      <div className="matrix-legend"><span>緊急度 <b>高 ↑</b></span><span>重要度 <b>高 →</b></span></div>
      <div className="matrix-grid">
        {quadrants.map((quadrant) => {
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
                        <span>{task.dueDate}</span>
                        {task.comment && <span className="matrix-task-comment" title={task.comment}>{truncateText(task.comment, MATRIX_COMMENT_MAX_LENGTH)}</span>}
                      </button>
                      <div className="matrix-actions">
                        <select aria-label={`${task.title}の移動先`} value={task.priority} onChange={(event) => { const target = quadrants.find((item) => item.priority === event.target.value); if (target) onMove(task, target.urgent, target.important); }}>
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

function TaskList({ tasks, onEdit, onComplete, onRestore, onDelete, showCompleted = false, showOverdue = false }: { tasks: Task[]; onEdit: (task: Task) => void; onComplete?: (task: Task) => void; onRestore?: (task: Task) => void; onDelete?: (task: Task) => void; showCompleted?: boolean; showOverdue?: boolean }) { return <div className="task-list">{tasks.map((task) => <article className={task.status === "done" ? "task-row completed" : "task-row"} key={task.id}><button className="check-button" onClick={() => task.status === "done" ? onRestore?.(task) : onComplete?.(task)} aria-label={task.status === "done" ? `${task.title}を未完了に戻す` : `${task.title}を完了にする`}>{task.status === "done" ? "↶" : "○"}</button><button type="button" className="task-main task-open-button" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}><strong>{task.title}</strong>{task.comment && <span className="task-comment">{task.comment}</span>}<span className="task-meta"><span className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}・{PRIORITY_LABELS[task.priority]}</span><span className={showOverdue && overdueDays(task.dueDate) > 0 ? "overdue-text" : ""}>{task.dueDate}{showOverdue && overdueDays(task.dueDate) > 0 ? `（${overdueDays(task.dueDate)}日超過）` : ""}</span>{task.status === "done" && <span>完了済み</span>}</span></button><div className="task-actions"><button className="icon-button" onClick={() => onEdit(task)} aria-label={`${task.title}を編集`}>✎</button>{showCompleted && task.status === "done" && onRestore && <button className="restore-button" onClick={() => onRestore(task)}>復元</button>}{onDelete && task.status !== "done" && <button className="icon-button danger" onClick={() => onDelete(task)} aria-label={`${task.title}を削除`}>⌫</button>}</div></article>)}</div>; }

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span aria-hidden="true">✦</span><p>{text}</p></div>; }

function TaskModal({ task, initialValues, onClose, onSave, onComplete }: { task?: Task; initialValues?: NewTaskDefaults; onClose: () => void; onSave: (input: { title: string; comment: string; dueDate: string; isUrgent: boolean; isImportant: boolean }, task?: Task) => Promise<void>; onComplete?: (task: Task) => Promise<boolean> }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [comment, setComment] = useState(task?.comment ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? todayInTokyo());
  const [isUrgent, setIsUrgent] = useState(task?.isUrgent ?? initialValues?.isUrgent ?? false);
  const [isImportant, setIsImportant] = useState(task?.isImportant ?? initialValues?.isImportant ?? false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({ title, comment, dueDate, isUrgent, isImportant }, task);
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
          <label htmlFor="task-comment">コメント</label>
          <textarea id="task-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} placeholder="補足、次にやること、参考情報など" />
          <label htmlFor="task-due">期日 <span className="required">必須</span></label>
          <input id="task-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
          <div className="boolean-grid">
            <label className="boolean-option"><input type="checkbox" checked={isUrgent} onChange={(event) => setIsUrgent(event.target.checked)} /><span><b>緊急</b><small>今日の判断が必要</small></span></label>
            <label className="boolean-option"><input type="checkbox" checked={isImportant} onChange={(event) => setIsImportant(event.target.checked)} /><span><b>重要</b><small>目的への影響が大きい</small></span></label>
          </div>
          <div className={`priority-preview ${priority.toLowerCase()}`}><span className="priority-badge">{priority}</span><div><b>{PRIORITY_LABELS[priority]}</b><small>緊急度と重要度から自動算出</small></div></div>
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
