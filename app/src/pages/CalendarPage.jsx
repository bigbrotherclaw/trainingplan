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
    <div className="px-5 pt-4 pb-28 min-h-screen bg-black">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[22px] font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="w-11 h-11 flex items-center justify-center rounded-full bg-[#141414]">
            <ChevronLeft size={18} className="text-white" />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="text-[15px] text-accent-blue font-medium min-h-[44px] px-2">
            Today
          </button>
          <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="w-11 h-11 flex items-center justify-center rounded-full bg-[#141414]">
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Drag hint */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={13} className="text-[#555555]" />
          <span className="text-[11px] text-[#555555]">
            {activeId ? 'Drop on a day in the same week to swap' : 'Hold & drag to swap days'}
          </span>
        </div>
        <button onClick={resetSwaps} className="flex items-center gap-1 text-[10px] text-[#555555] hover:text-accent-blue transition-colors">
          <RotateCcw size={10} />
          Reset
        </button>
      </div>

      {/* Calendar Card */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div key={i} className="text-[11px] uppercase tracking-wider text-[#555555] text-center pb-2">{d}</div>
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
          <div className="grid grid-cols-7 gap-1">
            {monthData.map((dayInfo, idx) => {
              const isToday = isSameDay(dayInfo.date, today);
              const isLogged = loggedDates.has(dayInfo.date.toDateString());
              const summary = dayInfo.isCurrentMonth ? getSwappedWorkoutSummaryForDate(dayInfo.date, weekSwaps) : null;
              const log = isLogged ? workoutHistory.find((e) => new Date(e.date).toDateString() === dayInfo.date.toDateString()) : null;
              const hasSkippedHic = log?.details?.hic?.skipped;
              const isDragging = activeId === `day-${idx}`;

              const cellWeekStart = dayInfo.isCurrentMonth ? startOfWeek(dayInfo.date, { weekStartsOn: 0 }).getTime() : null;
              const isValidTarget = activeId && !isDragging && dayInfo.isCurrentMonth && cellWeekStart === activeWeekStart;

              // Background tint: 10% opacity for workout days, subtle for rest
              let bgColor = 'transparent';
              if (!dayInfo.isCurrentMonth) bgColor = 'transparent';
              else if (isToday) bgColor = summary ? `${summary.color}33` : '#1a1a1a';
              else if (summary && summary.label !== 'Rest') bgColor = `${summary.color}1A`;
              else if (summary && summary.label === 'Rest') bgColor = '#33333330';

              if (isValidTarget) bgColor = summary ? `${summary.color}33` : '#1a1a1a';

              let borderStyle = 'none';
              if (isValidTarget && !isToday) borderStyle = '2px dashed #f59e0b';
              else if (isValidTarget) borderStyle = '2px solid #f59e0b';

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
                  borderStyle={borderStyle}
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
                <span className="text-[13px] font-bold text-white">{activeDayInfo.date.getDate()}</span>
                {activeSummary.label !== 'Rest' && (
                  <span className="text-[9px] font-bold uppercase leading-tight" style={{ color: activeSummary.accent }}>
                    {abbrevLabel(activeSummary.label)}
                  </span>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function abbrevLabel(label) {
  if (!label) return '';
  const l = label.toLowerCase();
  if (l === 'rest') return 'REST';
  if (l.includes('strength a') || l.includes('str a')) return 'STR A';
  if (l.includes('strength b') || l.includes('str b')) return 'STR B';
  if (l.includes('strength c') || l.includes('str c')) return 'STR C';
  if (l.includes('swim') && l.includes('hic')) return 'SWIM+HIC';
  if (l.includes('run') && l.includes('hic')) return 'RUN+HIC';
  if (l.includes('long')) return 'LONG TRI';
  if (l.includes('swim')) return 'SWIM';
  if (l.includes('run')) return 'RUN';
  if (l.includes('strength')) return 'STR';
  // fallback: uppercase first 8 chars
  return label.toUpperCase().slice(0, 8);
}

function CalendarCell({ id, dayInfo, isToday, isLogged, summary, hasSkippedHic, bgColor, borderStyle, isDragging, isValidTarget, todayRef }) {
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

  const activeBg = isOver && isValidTarget ? '#fbbf2422' : bgColor;
  const activeBorder = isOver && isValidTarget ? '2px solid #fbbf24' : borderStyle;

  const style = {
    backgroundColor: activeBg,
    border: activeBorder,
    opacity: isDragging ? 0.15 : dayInfo.isCurrentMonth ? 1 : 0.25,
    touchAction: 'none',
    transition: 'border-color 0.15s, background-color 0.15s, opacity 0.15s',
  };

  return (
    <div
      ref={ref}
      style={style}
      {...attributes}
      {...listeners}
      className={`min-h-[56px] rounded-xl p-1.5 flex flex-col items-center relative overflow-hidden cursor-grab active:cursor-grabbing select-none${isToday ? ' ring-2 ring-accent-blue' : ''}`}
    >
      <span className={`text-[13px] font-medium mb-0.5 ${isToday ? 'text-white font-bold' : dayInfo.isCurrentMonth ? 'text-white' : 'text-[#555555]'}`}>
        {dayInfo.date.getDate()}
      </span>
      {dayInfo.isCurrentMonth && summary && summary.label !== 'Rest' && (
        <span className="text-[9px] leading-tight text-center font-semibold px-0.5" style={{ color: summary.accent }}>
          {abbrevLabel(summary.label)}
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
