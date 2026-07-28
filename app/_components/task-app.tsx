"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Priority, Task } from "@/types/task";
import { calculatePriority, PRIORITY_LABELS } from "@/lib/tasks/priority";
import { dashboardMetrics, dueDateSort, prioritySort, priorityTasks } from "@/lib/tasks/selectors";
import { overdueDays, todayInTokyo } from "@/lib/tasks/date";

type View = "dashboard" | "all" | "due" | "matrix";

const navItems: Array<{ href: string; view: View; label: string; icon: string }> = [
  { href: "/dashboard", view: "dashboard", label: "ダッシュボード", icon: "⌂" },
  { href: "/all", view: "all", label: "TODO ALL", icon: "☷" },
  { href: "/due", view: "due", label: "今日まで", icon: "◷" },
  { href: "/matrix", view: "matrix", label: "マトリクス", icon: "⊞" },
];

export default function TaskApp({ view }: { view: View }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sort, setSort] = useState<"due" | "priority">("due");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks?includeCompleted=true", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "タスクを読み込めませんでした。");
      setTasks(body.data ?? []);
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

  async function saveTask(input: { title: string; comment: string; dueDate: string; isUrgent: boolean; isImportant: boolean }, task?: Task) {
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

  async function deleteTask(task: Task) {
    if (!window.confirm(`「${task.title}」を削除しますか？`)) return;
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
        <div className="sidebar-brand"><span className="brand-mark small">W</span><div className="sidebar-brand-copy"><strong>わたしの<br />タスク管理</strong><span>ONE PERSON / ONE SYSTEM</span></div><button className="sidebar-toggle" onClick={toggleSidebar} aria-controls="task-sidebar" aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? "サイドバーを展開" : "サイドバーを格納"} title={sidebarCollapsed ? "サイドバーを展開" : "サイドバーを格納"}>{sidebarCollapsed ? "→" : "←"}</button></div>
        <nav aria-label="メインナビゲーション">
          {navItems.map((item) => <Link key={item.href} className={view === item.view ? "nav-link active" : "nav-link"} href={item.href}><span className="nav-link-icon" aria-hidden="true">{item.icon}</span><span className="nav-link-label">{item.label}</span></Link>)}
        </nav>
        <div className="sidebar-bottom"><p>今日もひとつずつ。</p><button className="logout-button" onClick={logout} aria-label="ログアウト"><span aria-hidden="true">↪</span><span className="logout-label">ログアウト</span></button></div>
      </aside>
      <main className="main-content">
        <header className="mobile-header"><span className="brand-mark small">W</span><strong>わたしのタスク管理</strong><button className="icon-button" onClick={logout} aria-label="ログアウト">↪</button></header>
        {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.type === "success" ? "✓" : "!"}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="通知を閉じる">×</button></div>}
        {loading ? <LoadingState /> : <>
          {view === "dashboard" && <DashboardView tasks={tasks} metrics={metrics} onQuickAdd={() => setEditing({} as Task)} onEdit={setEditing} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} />}
          {view === "all" && <AllView active={active} completed={completed} showCompleted={showCompleted} setShowCompleted={setShowCompleted} sort={sort} setSort={setSort} onEdit={setEditing} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} onRestore={(task) => patchTask(task, { status: "todo" }, "タスクを復元しました。")} onDelete={deleteTask} onAdd={() => setEditing({} as Task)} />}
          {view === "due" && <DueView tasks={tasks} onComplete={(task) => patchTask(task, { status: "done" }, "タスクを完了しました。")} onEdit={setEditing} />}
          {view === "matrix" && <MatrixView tasks={active} onMove={(task, isUrgent, isImportant) => patchTask(task, { isUrgent, isImportant }, "優先度マトリクスを更新しました。")} onEdit={setEditing} />}
        </>}
      </main>
      {editing && <TaskModal task={editing.id ? editing : undefined} onClose={() => setEditing(null)} onSave={saveTask} onComplete={editing.id ? (task) => patchTask(task, { status: task.status === "done" ? "todo" : "done" }, task.status === "done" ? "タスクを未完了に戻しました。" : "タスクを完了しました。") : undefined} />}
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

function MatrixView({ tasks, onMove, onEdit }: { tasks: Task[]; onMove: (task: Task, isUrgent: boolean, isImportant: boolean) => void; onEdit: (task: Task) => void }) {
  const quadrants: Array<{ priority: Priority; urgent: boolean; important: boolean; label: string; sub: string }> = [
    { priority: "P1", urgent: true, important: true, label: "今すぐやる", sub: "緊急 × 重要" },
    { priority: "P2", urgent: false, important: true, label: "予定する", sub: "非緊急 × 重要" },
    { priority: "P3", urgent: true, important: false, label: "手早くやる", sub: "緊急 × 非重要" },
    { priority: "P4", urgent: false, important: false, label: "あとで", sub: "非緊急 × 非重要" },
  ];
  const [dragging, setDragging] = useState<string | null>(null);
  return <div className="content-wrap"><PageHeading eyebrow="URGENT / IMPORTANT" title="優先度マトリクス" description="タスクを置く場所で、次の一手を決める。" /><div className="matrix-legend"><span>緊急度 <b>高 ↑</b></span><span>重要度 <b>高 →</b></span></div><div className="matrix-grid">{quadrants.map((quadrant) => { const items = tasks.filter((task) => task.priority === quadrant.priority); return <section key={quadrant.priority} className={`quadrant quadrant-${quadrant.priority.toLowerCase()}`} onDragOver={(event) => event.preventDefault()} onDrop={() => { const task = tasks.find((item) => item.id === dragging); if (task) onMove(task, quadrant.urgent, quadrant.important); setDragging(null); }}><div className="quadrant-heading"><div><span className="priority-badge">{quadrant.priority}</span><h2>{quadrant.label}</h2><p>{quadrant.sub}</p></div><strong>{items.length}</strong></div>{items.length === 0 ? <p className="quadrant-empty">ここにタスクを置く</p> : <div className="quadrant-tasks">{items.map((task) => <article className="matrix-task" draggable onDragStart={() => setDragging(task.id)} onDragEnd={() => setDragging(null)} key={task.id}><button type="button" className="matrix-task-content" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}><strong>{task.title}</strong><span>{task.dueDate}</span>{task.comment && <span className="matrix-task-comment">{task.comment}</span>}</button><div className="matrix-actions"><select aria-label={`${task.title}の移動先`} value={task.priority} onChange={(event) => { const target = quadrants.find((item) => item.priority === event.target.value); if (target) onMove(task, target.urgent, target.important); }}><option value="P1">P1 今すぐやる</option><option value="P2">P2 予定する</option><option value="P3">P3 手早くやる</option><option value="P4">P4 あとで</option></select><button className="icon-button" onClick={() => onEdit(task)} aria-label={`${task.title}を編集`}>✎</button></div></article>)}</div>}</section>; })}</div><p className="matrix-hint">PCではタスクをドラッグ、タッチ端末では「移動先」メニューから象限を変更できます。</p></div>;
}

function TaskList({ tasks, onEdit, onComplete, onRestore, onDelete, showCompleted = false, showOverdue = false }: { tasks: Task[]; onEdit: (task: Task) => void; onComplete?: (task: Task) => void; onRestore?: (task: Task) => void; onDelete?: (task: Task) => void; showCompleted?: boolean; showOverdue?: boolean }) { return <div className="task-list">{tasks.map((task) => <article className={task.status === "done" ? "task-row completed" : "task-row"} key={task.id}><button className="check-button" onClick={() => task.status === "done" ? onRestore?.(task) : onComplete?.(task)} aria-label={task.status === "done" ? `${task.title}を未完了に戻す` : `${task.title}を完了にする`}>{task.status === "done" ? "↶" : "○"}</button><button type="button" className="task-main task-open-button" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}><strong>{task.title}</strong>{task.comment && <span className="task-comment">{task.comment}</span>}<span className="task-meta"><span className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}・{PRIORITY_LABELS[task.priority]}</span><span className={showOverdue && overdueDays(task.dueDate) > 0 ? "overdue-text" : ""}>{task.dueDate}{showOverdue && overdueDays(task.dueDate) > 0 ? `（${overdueDays(task.dueDate)}日超過）` : ""}</span>{task.status === "done" && <span>完了済み</span>}</span></button><div className="task-actions"><button className="icon-button" onClick={() => onEdit(task)} aria-label={`${task.title}を編集`}>✎</button>{showCompleted && task.status === "done" && onRestore && <button className="restore-button" onClick={() => onRestore(task)}>復元</button>}{onDelete && task.status !== "done" && <button className="icon-button danger" onClick={() => onDelete(task)} aria-label={`${task.title}を削除`}>⌫</button>}</div></article>)}</div>; }

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span aria-hidden="true">✦</span><p>{text}</p></div>; }

function TaskModal({ task, onClose, onSave, onComplete }: { task?: Task; onClose: () => void; onSave: (input: { title: string; comment: string; dueDate: string; isUrgent: boolean; isImportant: boolean }, task?: Task) => Promise<void>; onComplete?: (task: Task) => Promise<boolean> }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [comment, setComment] = useState(task?.comment ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? todayInTokyo());
  const [isUrgent, setIsUrgent] = useState(task?.isUrgent ?? false);
  const [isImportant, setIsImportant] = useState(task?.isImportant ?? false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); setSaving(true); try { await onSave({ title, comment, dueDate, isUrgent, isImportant }, task); } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。"); } finally { setSaving(false); } }
  async function toggleComplete() { if (!task || !onComplete) return; setCompleting(true); const succeeded = await onComplete(task); if (succeeded) onClose(); else setCompleting(false); }
  const priority = calculatePriority(isUrgent, isImportant);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title"><div className="modal-header"><div><p className="eyebrow">{task ? "EDIT TASK" : "NEW TASK"}</p><h2 id="task-modal-title">{task ? "タスクを編集" : "新しいタスク"}</h2></div><button className="icon-button" onClick={onClose} aria-label="閉じる">×</button></div><form onSubmit={submit}><label htmlFor="task-title">タスク名</label><input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required autoFocus /><label htmlFor="task-comment">コメント</label><textarea id="task-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} placeholder="補足、次にやること、参考情報など" /><label htmlFor="task-due">期日 <span className="required">必須</span></label><input id="task-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /><div className="boolean-grid"><label className="boolean-option"><input type="checkbox" checked={isUrgent} onChange={(event) => setIsUrgent(event.target.checked)} /><span><b>緊急</b><small>今日の判断が必要</small></span></label><label className="boolean-option"><input type="checkbox" checked={isImportant} onChange={(event) => setIsImportant(event.target.checked)} /><span><b>重要</b><small>目的への影響が大きい</small></span></label></div><div className={`priority-preview ${priority.toLowerCase()}`}><span className="priority-badge">{priority}</span><div><b>{PRIORITY_LABELS[priority]}</b><small>緊急度と重要度から自動算出</small></div></div>{error && <p className="field-error" role="alert">{error}</p>}<div className="modal-actions">{task && onComplete && <button type="button" className="complete-button" onClick={toggleComplete} disabled={saving || completing}>{completing ? "更新中…" : task.status === "done" ? "未完了に戻す" : "完了にする"}</button>}<button type="button" className="secondary-button" onClick={onClose} disabled={completing}>キャンセル</button><button type="submit" className="primary-button" disabled={saving || completing}>{saving ? "保存中…" : "保存する"}</button></div></form></section></div>;
}
