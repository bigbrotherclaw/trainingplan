import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, RotateCcw } from 'lucide-react';
import { format, isSameDay, startOfWeek, addMonths, subMonths } from 'date-fns';
import { DndContext, DragOverlay, useSensor, useSensors, TouchSensor, MouseSensor, closestCenter, useDraggable, useDroppable } from '@dnd-kit/core';
import { useApp } from '../context/AppContext';
import { getWorkoutSummaryForDate, getMonthData, formatDateKey } from '../utils/workout';

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
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  );

  const getDayInfoById = useCallback((id) => {
    const idx = parseInt(id?.replace('day-', ''), 10);
    return !isNaN(idx) ? monthData[idx] : null;
  }, [monthData]);

  const activeDayInfo = useMemo(() => getDayInfoById(activeId), [activeId, getDayInfoById]);
  const activeSummary = useMemo(() => {
    if (!activeDayInfo?.isCurrentMonth) return null;
    return getWorkoutSummaryForDate(activeDayInfo.date);
  }, [activeDayInfo]);

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

  return (
    <div className="px-4 py-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-2 text-slate-500">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-2 text-slate-500">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-slate-500" />
          <span className="text-xs text-slate-500">Drag to swap days within a week</span>
        </div>
        <button onClick={resetSwaps} className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-accent-blue transition-colors">
          <RotateCcw size={10} />
          Reset Swaps
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-slate-600 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-7 gap-1.5">
          {monthData.map((dayInfo, idx) => {
            const isToday = isSameDay(dayInfo.date, today);
            const isLogged = loggedDates.has(dayInfo.date.toDateString());
            const summary = dayInfo.isCurrentMonth ? getWorkoutSummaryForDate(dayInfo.date) : null;
            const log = isLogged ? workoutHistory.find((e) => new Date(e.date).toDateString() === dayInfo.date.toDateString()) : null;
            const hasSkippedHic = log?.details?.hic?.skipped;
            const isDragging = activeId === `day-${idx}`;

            let bgColor = summary ? `${summary.color}33` : '#0a0a0a';
            let borderColor = '#1e293b';
            if (isToday) { borderColor = '#e2e8f0'; bgColor = summary ? `${summary.color}66` : '#1a1a1a'; }
            else if (isLogged) borderColor = '#10b981';
            else if (summary) borderColor = `${summary.accent}44`;
            if (!dayInfo.isCurrentMonth) bgColor = '#060606';

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
                todayRef={isToday ? todayRef : null}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDayInfo && activeSummary && (
            <div
              className="flex flex-col items-center justify-center rounded-lg shadow-2xl shadow-black/50 pointer-events-none"
              style={{
                width: 52,
                height: 52,
                backgroundColor: `${activeSummary.color}aa`,
                border: `2px solid ${activeSummary.accent}`,
              }}
            >
              <span className="text-[11px] font-bold text-white">{activeDayInfo.date.getDate()}</span>
              {activeSummary.label !== 'Rest' && (
                <span className="text-[7px] font-semibold uppercase" style={{ color: activeSummary.accent }}>
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

function CalendarCell({ id, dayInfo, isToday, isLogged, summary, hasSkippedHic, bgColor, borderColor, isDragging, todayRef }) {
  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
    id,
    disabled: !dayInfo.isCurrentMonth,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id,
    disabled: !dayInfo.isCurrentMonth,
  });

  const ref = useCallback((node) => {
    setDragRef(node);
    setDropRef(node);
    if (todayRef) todayRef.current = node;
  }, [setDragRef, setDropRef, todayRef]);

  const style = {
    aspectRatio: '1',
    backgroundColor: bgColor,
    border: isToday ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isDragging ? 0.3 : dayInfo.isCurrentMonth ? 1 : 0.3,
    touchAction: 'none',
    minHeight: 48,
  };

  return (
    <div ref={ref} style={style} {...attributes} {...listeners} className="relative overflow-hidden cursor-grab active:cursor-grabbing">
      {dayInfo.isCurrentMonth && (
        <GripVertical size={8} className="absolute top-0.5 right-0.5 text-slate-700" />
      )}
      <span className={`text-[11px] ${isToday ? 'font-bold text-white' : 'text-slate-300'}`}>
        {dayInfo.date.getDate()}
      </span>
      {dayInfo.isCurrentMonth && summary && summary.label !== 'Rest' && (
        <span className="text-[7px] font-semibold uppercase mt-0.5" style={{ color: summary.accent }}>
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
