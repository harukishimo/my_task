"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/types/task";
import { REVIEW_LABELS } from "@/lib/tasks/reviews";
import { addCalendarDays, buildWbsChart, calendarDaysBetween, clampDueDate, WBS_DAY_WIDTH, type WbsRow } from "@/lib/tasks/wbs";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function weekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function monthDay(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

export default function WbsView({ tasks, onEdit, onStretchDue, onAdd }: { tasks: Task[]; onEdit: (task: Task) => void; onStretchDue: (task: Task, dueDate: string) => void; onAdd: () => void }) {
  const chart = useMemo(() => buildWbsChart(tasks), [tasks]);
  const scroller = useRef<HTMLDivElement>(null);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  useEffect(() => {
    if (!scroller.current || chart.todayOffset < 0) return;
    scroller.current.scrollLeft = Math.max(0, chart.todayOffset - 160);
  }, [chart.todayOffset]);

  return (
    <div className="content-wrap wbs-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WBS / TIMELINE</p>
          <h1>時間軸WBS</h1>
          <p className="page-description">縦がタスク、横が日程です。バーを伸ばすと期日が変わり、3つの確認日が見えます。</p>
        </div>
        <button type="button" className="primary-button" onClick={onAdd}>＋ タスクを追加</button>
      </div>
      <div className="wbs-legend" aria-hidden="true">
        <span><i className="wbs-dot outline" />{REVIEW_LABELS.outline}</span>
        <span><i className="wbs-dot mid" />{REVIEW_LABELS.mid}</span>
        <span><i className="wbs-dot almost" />{REVIEW_LABELS.almost}</span>
        <span>右端をドラッグして期日を移動</span>
      </div>
      {chart.rows.length === 0 ? (
        <section className="panel"><div className="empty-state"><span aria-hidden="true">✦</span><p>未完了タスクはありません。追加すると時間軸に並びます。</p></div></section>
      ) : (
        <div className="wbs-board">
          <div className="wbs-names">
            <div className="wbs-corner">タスク</div>
            {chart.rows.map((row) => {
              const task = taskById.get(row.taskId);
              if (!task) return null;
              return (
                <button type="button" key={row.taskId} className="wbs-name" onClick={() => onEdit(task)} title={row.title} aria-label={row.title}>
                  <strong>{row.title}</strong>
                  <small>{row.startDate} → {row.dueDate}</small>
                </button>
              );
            })}
          </div>
          <div className="wbs-scroll" ref={scroller} tabIndex={0} role="region" aria-label="WBSの時間軸。横にスクロールできます">
            <div className="wbs-grid" style={{ width: chart.days.length * WBS_DAY_WIDTH, ["--wbs-day-width" as string]: `${WBS_DAY_WIDTH}px` }}>
              <div className="wbs-days">
                {chart.days.map((day) => (
                  <div key={day} className={`wbs-day ${day === chart.today ? "today" : ""}`}>
                    <span>{monthDay(day)}</span>
                    <small>{weekdayLabel(day)}</small>
                  </div>
                ))}
              </div>
              {chart.todayOffset >= 0 && <div className="wbs-today-line" style={{ left: chart.todayOffset }} aria-hidden="true" />}
              {chart.rows.map((row) => {
                const task = taskById.get(row.taskId);
                if (!task) return null;
                return <WbsBar key={row.taskId} task={task} row={row} onEdit={onEdit} onStretchDue={onStretchDue} />;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WbsBar({ task, row, onEdit, onStretchDue }: { task: Task; row: WbsRow; onEdit: (task: Task) => void; onStretchDue: (task: Task, dueDate: string) => void }) {
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const origin = useRef<{ x: number; dueDate: string } | null>(null);
  const width = liveWidth ?? row.barWidth;

  function dueFromPointer(clientX: number) {
    const start = origin.current;
    if (!start) return row.dueDate;
    const deltaDays = Math.round((clientX - start.x) / WBS_DAY_WIDTH);
    return clampDueDate(row.startDate, addCalendarDays(start.dueDate, deltaDays));
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    origin.current = { x: event.clientX, dueDate: row.dueDate };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!origin.current) return;
    const nextDue = dueFromPointer(event.clientX);
    setLiveWidth(Math.max(WBS_DAY_WIDTH, (calendarDaysBetween(row.startDate, nextDue) + 1) * WBS_DAY_WIDTH));
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!origin.current) return;
    const nextDue = dueFromPointer(event.clientX);
    origin.current = null;
    setLiveWidth(null);
    if (nextDue !== row.dueDate) onStretchDue(task, nextDue);
  }

  return (
    <div className="wbs-row">
      <button type="button" className="wbs-bar" style={{ left: row.barLeft, width }} onClick={() => onEdit(task)} aria-label={`${task.title}の詳細を開く`}>
        <span className="wbs-bar-label">{task.title}</span>
      </button>
      {row.markers.map((marker) => (
        <span key={marker.key} className={`wbs-marker ${marker.key}`} style={{ left: marker.offset }} title={`${marker.label} ${marker.at.slice(0, 16).replace("T", " ")}`} aria-label={`${task.title}の${marker.label}`}>
          <small>{monthDay(marker.date)}</small>
        </span>
      ))}
      <button type="button" className="wbs-resize" style={{ left: row.barLeft + width - 8 }} aria-label={`${task.title}のバーの長さを変える`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={() => { origin.current = null; setLiveWidth(null); }} />
    </div>
  );
}
