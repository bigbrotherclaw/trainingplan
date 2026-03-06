import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, GripVertical, RotateCcw, ArrowLeftRight } from 'lucide-react';
import { format, isSameDay, startOfWeek, addMonths, subMonths } from 'date-fns';
import { DndContext, DragOverlay, useSensor, useSensors, TouchSensor, MouseSensor, useDraggable, useDroppable, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { useApp } from '../context/AppContext';
import { getSwappedWorkoutSummaryForDate, getMonthData, formatDateKey } from '../utils/workout';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarPage() {
  const { workoutHistory, weekSwaps, setWeekSwaps } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeId, setActiveId] = useState(null);
  const todayRef = useRef(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const loggedDates = useMemo(() => new Set(workoutHistory.map((e) => new Date(e.date).toDateString())), [workoutHistory]);

  const monthData = useMemo(() => getMonthData(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  );

  const getDayInfoById = useCallback((id) => {
    const idx = parseInt(id?.replace('day-', ''), 10);
    return !isNaN(idx) ? monthData[idx] : null;
  }, [monthData]);

  const activeWeekStart = useMemo(() => {
    const info = getDayInfoById(activeId);
    if (!info?.isCurrentMonth) return null;
    return startOfWeek(info.date, { weekStartsOn: 0 }).getTime();
  }, [activeId, getDayInfoById]);

  const activeDayInfo = useMemo(() => getDayInfoById(activeId), [activeId, getDayInfoById]);
  const activeSummary = useMemo(() => {
    if (!activeDayInfo?.isCurrentMonth) return null;
    return getSwappedWorkoutSummaryForDate(activeDayInfo.date, weekSwaps);
  }, [activeDayInfo, weekSwaps]);

  const handleDragStart = useCallback((event) => {
    const dayInfo = getDayInfoById(event.active.id);
    if (!dayInfo?.isCurrentMonth) return;
    setActiveId(event.active.id);
  }, [getDayInfoById]);

  const handleDragEnd = useCallback((event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromInfo = getDayInfoById(active.id);
    const toInfo = getDayInfoById(over.id);
    if (!fromInfo?.isCurrentMonth || !toInfo?.isCurrentMonth) return;

    const ws1 = startOfWeek(fromInfo.date, { weekStartsOn: 0 });
    const ws2 = startOfWeek(toInfo.date, { weekStartsOn: 0 });
    if (ws1.getTime() !== ws2.getTime()) return;

    const weekKey = formatDateKey(ws1);
    const existing = weekSwaps[weekKey] || {};
    const day1 = fromInfo.date.getDay();
    const day2 = toInfo.date.getDay();
    const current1 = existing[day1] !== undefined ? existing[day1] : day1;
    const current2 = existing[day2] !== undefined ? existing[day2] : day2;

    setWeekSwaps((prev) => ({
      ...prev,
      [weekKey]: { ...existing, [day1]: current2, [day2]: current1 },
    }));
  }, [getDayInfoById, weekSwaps, setWeekSwaps]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const resetSwaps = () => {
    const ws = startOfWeek(today, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    setWeekSwaps((prev) => {
      const next = { ...prev };
      delete next[weekKey];
      return next;
    });
  };

  useEffect(() => {
    if (todayRef.current) todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const collisionDetection = useCallback((args) => {
    const pw = pointerWithin(args);
    if (pw.length > 0) return pw;
    return rectIntersection(args);
  }, []);

  return (
    <div className="px-5 py-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-2 text-[#666666]">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-2 text-[#666666]">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={14} className="text-[#666666]" />
          <span className="text-xs text-[#666666]">
            {activeId ? 'Drop on a day in the same week to swap' : 'Hold & drag to swap days'}
          </span>
        </div>
        <button onClick={resetSwaps} className="flex items-center gap-1 text-[10px] text-[#666666] hover:text-accent-blue transition-colors">
          <RotateCcw size={10} />
          Reset
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-[#666666] py-1">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-7 gap-1.5">
          {monthData.map((dayInfo, idx) => {
            const isToday = isSameDay(dayInfo.date, today);
            const isLogged = loggedDates.has(dayInfo.date.toDateString());
            const summary = dayInfo.isCurrentMonth ? getSwappedWorkoutSummaryForDate(dayInfo.date, weekSwaps) : null;
            const log = isLogged ? workoutHistory.find((e) => new Date(e.date).toDateString() === dayInfo.date.toDateString()) : null;
            const hasSkippedHic = log?.details?.hic?.skipped;
            const isDragging = activeId === `day-${idx}`;

            const cellWeekStart = dayInfo.isCurrentMonth ? startOfWeek(dayInfo.date, { weekStartsOn: 0 }).getTime() : null;
            const isValidTarget = activeId && !isDragging && dayInfo.isCurrentMonth && cellWeekStart === activeWeekStart;

            let bgColor = summary ? `${summary.color}33` : '#0a0a0a';
            let borderColor = '#111111';
            if (isToday) { borderColor = '#ffffff'; bgColor = summary ? `${summary.color}66` : '#1a1a1a'; }
            else if (isLogged) borderColor = '#10b981';
            else if (summary) borderColor = `${summary.accent}44`;
            if (!dayInfo.isCurrentMonth) bgColor = '#050505';

            if (isValidTarget) {
              borderColor = '#f59e0b';
              bgColor = summary ? `${summary.color}55` : '#1a1a1a';
            }

            return (
              <CalendarCell
                key={idx}
                id={`day-${idx}`}
                dayInfo={dayInfo}
                isToday={isToday}
                isLogged={isLogged}
                summary={summary}
                hasSkippedHic={hasSkippedHic}
                bgColor={bgColor}
                borderColor={borderColor}
                isDragging={isDragging}
                isValidTarget={isValidTarget}
                todayRef={isToday ? todayRef : null}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDayInfo && activeSummary && (
            <div
              className="flex flex-col items-center justify-center rounded-xl shadow-2xl shadow-black/80 pointer-events-none"
              style={{
                width: 56,
                height: 56,
                backgroundColor: `${activeSummary.color}cc`,
                border: `2px solid ${activeSummary.accent}`,
              }}
            >
              <span className="text-xs font-bold text-white">{activeDayInfo.date.getDate()}</span>
              {activeSummary.label !== 'Rest' && (
                <span className="text-[8px] font-bold uppercase" style={{ color: activeSummary.accent }}>
                  {activeSummary.label}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function CalendarCell({ id, dayInfo, isToday, isLogged, summary, hasSkippedHic, bgColor, borderColor, isDragging, isValidTarget, todayRef }) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id,
    disabled: !dayInfo.isCurrentMonth,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    disabled: !dayInfo.isCurrentMonth,
  });

  const ref = useCallback((node) => {
    setDragRef(node);
    setDropRef(node);
    if (todayRef) todayRef.current = node;
  }, [setDragRef, setDropRef, todayRef]);

  const activeBorder = isOver && isValidTarget ? '#fbbf24' : borderColor;
  const activeBg = isOver && isValidTarget ? '#fbbf2422' : bgColor;

  const style = {
    aspectRatio: '1',
    backgroundColor: activeBg,
    border: isOver && isValidTarget ? `2px solid ${activeBorder}` : isToday ? `2px solid ${activeBorder}` : isValidTarget ? `2px dashed ${activeBorder}` : `1px solid ${activeBorder}`,
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isDragging ? 0.2 : dayInfo.isCurrentMonth ? 1 : 0.3,
    touchAction: 'none',
    minHeight: 50,
    transition: 'border-color 0.15s, background-color 0.15s, opacity 0.15s',
  };

  return (
    <div ref={ref} style={style} {...attributes} {...listeners} className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none">
      {dayInfo.isCurrentMonth && (
        <GripVertical size={8} className="absolute top-0.5 right-0.5 text-white/10" />
      )}
      <span className={`text-[11px] ${isToday ? 'font-bold text-white' : 'text-[#B3B3B3]'}`}>
        {dayInfo.date.getDate()}
      </span>
      {dayInfo.isCurrentMonth && summary && summary.label !== 'Rest' && (
        <span className="text-[7px] font-semibold uppercase mt-0.5 text-center leading-tight px-0.5" style={{ color: summary.accent }}>
          {summary.label}
        </span>
      )}
      {isLogged && (
        <span className={`text-[8px] font-bold mt-0.5 ${hasSkippedHic ? 'text-amber-400' : 'text-emerald-400'}`}>
          {hasSkippedHic ? '~' : '\u2713'}
        </span>
      )}
    </div>
  );
}
