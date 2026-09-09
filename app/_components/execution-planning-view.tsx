"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Priority, Task } from "@/types/task";
import { executionPriority, executionPrioritySort, EXECUTION_PRIORITY_LABELS, isDecompositionRequired } from "@/lib/tasks/execution-priority";
import { formatDueLabel } from "@/lib/tasks/reviews";
import { todayInTokyo } from "@/lib/tasks/date";

const PLAN_DROPZONE_ID = "today-execution-queue";
const SOURCE_DROPZONE_ID = "today-execution-source";

const MATRIX_QUADRANTS: Array<{ priority: Priority; urgent: boolean; important: boolean; label: string; sub: string }> = [
  { priority: "P1", urgent: true, important: true, label: "今すぐやる", sub: "緊急 × 重要" },
  { priority: "P2", urgent: false, important: true, label: "予定する", sub: "非緊急 × 重要" },
  { priority: "P3", urgent: true, important: false, label: "手早くやる", sub: "緊急 × 非重要" },
  { priority: "P4", urgent: false, important: false, label: "あとで", sub: "非緊急 × 非重要" },
];

type Props = {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  onAdd: () => void;
  onAddChild: (task: Task) => void;
  onPlanChange: (orderedTasks: Task[], removedTask?: Task) => Promise<void>;
};

export default function ExecutionPlanningView({ tasks, onEdit, onComplete, onAdd, onAddChild, onPlanChange }: Props) {
  const today = todayInTokyo();
  const activeTasks = useMemo(() => tasks.filter((task) => !task.isDeleted && task.status === "todo"), [tasks]);
  const initialPlannedIds = useMemo(() => activeTasks
    .filter((task) => task.planDate === today)
    .sort((a, b) => (a.planOrder ?? Number.MAX_SAFE_INTEGER) - (b.planOrder ?? Number.MAX_SAFE_INTEGER) || a.createdAt.localeCompare(b.createdAt))
    .map((task) => task.id), [activeTasks, today]);
  const [plannedIds, setPlannedIds] = useState(initialPlannedIds);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Server-loaded tasks can change after a mutation; keep the local queue aligned with that source of truth.
  useEffect(() => {
    if (saving) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlannedIds((current) => current.length === initialPlannedIds.length && current.every((id, index) => id === initialPlannedIds[index]) ? current : initialPlannedIds);
  }, [initialPlannedIds, saving]);

  const taskById = useMemo(() => new Map(activeTasks.map((task) => [task.id, task])), [activeTasks]);
  const planned = plannedIds.map((id) => taskById.get(id)).filter((task): task is Task => Boolean(task));
  const plannedSet = new Set(planned.map((task) => task.id));
  const unplanned = executionPrioritySort(activeTasks.filter((task) => !plannedSet.has(task.id)));

  async function persist(nextIds: string[], removedTask?: Task) {
    if (saving) return;
    const nextTasks = nextIds.map((id) => taskById.get(id)).filter((task): task is Task => Boolean(task));
    setPlannedIds(nextIds);
    setSaving(true);
    try {
      await onPlanChange(nextTasks, removedTask);
    } finally {
      setSaving(false);
    }
  }

  function addToQueue(task: Task) {
    if (plannedSet.has(task.id)) return;
    // Keep an existing hand-tuned order intact, while placing a newly added task
    // before the first lower-priority item when possible.
    const insertionIndex = planned.findIndex((item) => executionPriority(item) > executionPriority(task));
    const nextIds = planned.map((item) => item.id);
    nextIds.splice(insertionIndex < 0 ? nextIds.length : insertionIndex, 0, task.id);
    void persist(nextIds);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTask = taskById.get(activeId);
    if (!activeTask) return;
    const currentIndex = plannedIds.indexOf(activeId);
    const isPlanned = currentIndex >= 0;

    if (overId === SOURCE_DROPZONE_ID && isPlanned) {
      void persist(plannedIds.filter((id) => id !== activeId), activeTask);
      return;
    }
    if (!isPlanned && (overId === PLAN_DROPZONE_ID || plannedIds.includes(overId))) {
      const nextIds = [...plannedIds];
      const targetIndex = overId === PLAN_DROPZONE_ID ? nextIds.length : nextIds.indexOf(overId);
      nextIds.splice(Math.max(0, targetIndex), 0, activeId);
      void persist(nextIds);
      return;
    }
    if (isPlanned && plannedIds.includes(overId) && activeId !== overId) {
      void persist(arrayMove(plannedIds, currentIndex, plannedIds.indexOf(overId)));
    }
  }

  const draggingTask = draggingId ? taskById.get(draggingId) : undefined;

  return (
    <div className="content-wrap planning-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">TODAY / SINGLE TASK</p>
          <h1>今日の段取り</h1>
          <p className="page-description">優先順位を1本のキューにして、上から1つずつ終わらせる。</p>
        </div>
        <button className="primary-button" onClick={onAdd}>＋ タスクを追加</button>
      </div>
      <div className="execution-rule-strip" role="note">
        <span><b>#1</b> 依頼</span><span><b>#2</b> 10分以内</span><span><b>#3</b> 3営業日以上は分解</span><span><b>#4</b> 期日順</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={(args) => pointerWithin(args).length > 0 ? pointerWithin(args) : closestCenter(args)} onDragStart={({ active }) => setDraggingId(String(active.id))} onDragCancel={() => setDraggingId(null)} onDragEnd={handleDragEnd}>
        <div className="execution-layout">
          <PlanningSourceMatrix tasks={unplanned} disabled={saving} onEdit={onEdit} onQueue={addToQueue} onAddChild={onAddChild} />
          <ExecutionQueue tasks={planned} disabled={saving} onEdit={onEdit} onComplete={onComplete} onRemove={(task) => void persist(plannedIds.filter((id) => id !== task.id), task)} onMove={(from, to) => void persist(arrayMove(plannedIds, from, to))} onAddChild={onAddChild} />
        </div>
        <DragOverlay>{draggingTask ? <PlanTaskPreview task={draggingTask} /> : null}</DragOverlay>
      </DndContext>
      <p className="planning-hint">左のマトリクスから今日やるタスクを右のキューへドラッグし、上から1つずつ処理します。スマホでは追加ボタンを使えます。</p>
    </div>
  );
}

function PlanningSourceMatrix({ tasks, disabled, onEdit, onQueue, onAddChild }: { tasks: Task[]; disabled: boolean; onEdit: (task: Task) => void; onQueue: (task: Task) => void; onAddChild: (task: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: SOURCE_DROPZONE_ID });
  return (
    <section ref={setNodeRef} className={`planning-panel planning-matrix-panel ${isOver ? "drop-active" : ""}`} aria-labelledby="unplanned-title">
      <div className="planning-panel-header"><div><p className="eyebrow">SOURCE / MATRIX</p><h2 id="unplanned-title">未計画タスク</h2></div><span className="count-pill">{tasks.length}件</span></div>
      <div className="matrix-legend planning-matrix-legend"><span>緊急度 <b>高 ↑</b></span><span>重要度 <b>高 →</b></span></div>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="matrix-grid planning-matrix-grid">
          {MATRIX_QUADRANTS.map((quadrant) => {
            const items = tasks.filter((task) => task.priority === quadrant.priority);
            return <section key={quadrant.priority} className={`quadrant quadrant-${quadrant.priority.toLowerCase()}`}>
              <div className="quadrant-heading"><div><span className="priority-badge">{quadrant.priority}</span><h2>{quadrant.label}</h2><p>{quadrant.sub}</p></div><strong>{items.length}</strong></div>
              {items.length === 0 ? <p className="quadrant-empty">未計画のタスクはありません</p> : <div className="quadrant-tasks">{items.map((task) => <PlanTaskCard key={task.id} task={task} disabled={disabled} onEdit={onEdit} onQueue={() => onQueue(task)} onAddChild={() => onAddChild(task)} />)}</div>}
            </section>;
          })}
        </div>
      </SortableContext>
    </section>
  );
}

function ExecutionQueue({ tasks, disabled, onEdit, onComplete, onRemove, onMove, onAddChild }: { tasks: Task[]; disabled: boolean; onEdit: (task: Task) => void; onComplete: (task: Task) => void; onRemove: (task: Task) => void; onMove: (from: number, to: number) => void; onAddChild: (task: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: PLAN_DROPZONE_ID });
  return <section ref={setNodeRef} className={`planning-panel execution-queue-panel ${isOver ? "drop-active" : ""}`} aria-labelledby="execution-queue-title">
    <div className="planning-panel-header"><div><p className="eyebrow">EXECUTION QUEUE</p><h2 id="execution-queue-title">今日やるタスク</h2><p className="muted">上から1つだけに集中する。</p></div><span className="count-pill">{tasks.length}件</span></div>
    <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
      <div className="execution-queue-list">
        {tasks.length === 0 ? <p className="planning-empty">左のマトリクスからタスクを追加してください。</p> : tasks.map((task, index) => <QueueTaskCard key={task.id} task={task} index={index} total={tasks.length} disabled={disabled} onEdit={onEdit} onComplete={() => onComplete(task)} onRemove={() => onRemove(task)} onMoveUp={() => onMove(index, index - 1)} onMoveDown={() => onMove(index, index + 1)} onAddChild={() => onAddChild(task)} />)}
      </div>
    </SortableContext>
  </section>;
}

function PlanTaskCard({ task, disabled, onEdit, onQueue, onAddChild }: { task: Task; disabled: boolean; onEdit: (task: Task) => void; onQueue: () => void; onAddChild: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const rank = executionPriority(task);
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} className="plan-task-card" data-plan-task-id={task.id} data-plan-task-title={task.title}>
    <button type="button" className="plan-drag-handle" disabled={disabled} {...attributes} {...listeners} aria-label={`${task.title}をドラッグ`}>⠿</button>
    <button type="button" className="plan-task-content" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}><strong title={task.title}>{truncate(task.title, 34)}</strong><span className="plan-task-meta"><b className={`execution-rank rank-${rank}`}>#{rank}</b><b className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}</b>{formatDueLabel(task.dueDate, task.dueTime)}</span><small>{EXECUTION_PRIORITY_LABELS[rank]}{isDecompositionRequired(task) ? " / 分解対象" : ""}</small></button>
    <div className="plan-task-actions"><button type="button" className="plan-schedule-button" onClick={onQueue} disabled={disabled} aria-label={`${task.title}を今日の実行キューに追加`}>＋</button>{isDecompositionRequired(task) && <button type="button" className="plan-child-button" onClick={onAddChild} disabled={disabled} aria-label={`${task.title}の子タスクを追加`}>↳</button>}</div>
  </article>;
}

function QueueTaskCard({ task, index, total, disabled, onEdit, onComplete, onRemove, onMoveUp, onMoveDown, onAddChild }: { task: Task; index: number; total: number; disabled: boolean; onEdit: (task: Task) => void; onComplete: () => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void; onAddChild: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const rank = executionPriority(task);
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} className={`execution-task-card ${index === 0 ? "current" : ""}`} data-plan-task-id={task.id} data-plan-task-title={task.title}>
    <button type="button" className="plan-drag-handle" disabled={disabled} {...attributes} {...listeners} aria-label={`${task.title}をドラッグ`}>⠿</button>
    <span className="execution-number">{index + 1}</span>
    <button type="button" className="plan-task-content" onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}><strong title={task.title}>{truncate(task.title, 38)}</strong><span className="plan-task-meta"><b className={`execution-rank rank-${rank}`}>#{rank}</b><b className={`priority-text ${task.priority.toLowerCase()}`}>{task.priority}</b>{formatDueLabel(task.dueDate, task.dueTime)}</span><small>{index === 0 ? "いま着手する" : EXECUTION_PRIORITY_LABELS[rank]}{isDecompositionRequired(task) ? " / 分解対象" : ""}</small></button>
    <div className="plan-task-actions"><button type="button" className="check-button" onClick={onComplete} disabled={disabled} aria-label={`${task.title}を完了にする`}>○</button>{isDecompositionRequired(task) && <button type="button" className="plan-child-button" onClick={onAddChild} disabled={disabled} aria-label={`${task.title}の子タスクを追加`}>↳</button>}<button type="button" className="plan-order-button" onClick={onMoveUp} disabled={disabled || index === 0} aria-label={`${task.title}を上へ移動`}>↑</button><button type="button" className="plan-order-button" onClick={onMoveDown} disabled={disabled || index === total - 1} aria-label={`${task.title}を下へ移動`}>↓</button><button type="button" className="plan-remove-button" onClick={onRemove} disabled={disabled} aria-label={`${task.title}を今日の実行キューから外す`}>×</button></div>
  </article>;
}

function PlanTaskPreview({ task }: { task: Task }) {
  return <div className="plan-task-card drag-preview"><span className="plan-drag-handle">⠿</span><div className="plan-task-content"><strong>{truncate(task.title, 34)}</strong><span className="plan-task-meta"><b className={`execution-rank rank-${executionPriority(task)}`}>#{executionPriority(task)}</b>{task.priority}</span></div></div>;
}

function truncate(value: string, maxLength: number) {
  const characters = Array.from(value);
  return characters.length > maxLength ? `${characters.slice(0, maxLength).join("")}...` : value;
}
