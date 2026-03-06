import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, GripVertical, RotateCcw, ArrowLeftRight, Moon, Repeat2, X } from 'lucide-react';
import { format, isSameDay, startOfWeek, addMonths, subMonths } from 'date-fns';
import { DndContext, DragOverlay, useSensor, useSensors, TouchSensor, MouseSensor, useDraggable, useDroppable, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { useApp } from '../context/AppContext';
import { getSwappedWorkoutSummaryForDate, getSwappedWorkoutForDate, getWorkoutSummary, getMonthData, formatDateKey } from '../utils/workout';
import { WEEKLY_TEMPLATE } from '../data/training';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarPage() {
  const { workoutHistory, weekSwaps, setWeekSwaps } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeId, setActiveId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showSwapPicker, setShowSwapPicker] = useState(false);
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

  const handleDayTap = useCallback((dayInfo) => {
    if (!dayInfo.isCurrentMonth || activeId) return;
    setSelectedDay(dayInfo);
    setShowSwapPicker(false);
  }, [activeId]);

  const handleInsertRestDay = useCallback(() => {
    if (!selectedDay) return;
    const date = selectedDay.date;
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const dayOfWeek = date.getDay();

    setWeekSwaps((prev) => {
      const existing = prev[weekKey] || {};
      const newSwaps = { ...existing };

      // Collect current effective workout for each day from tapped day to Saturday
      const currentWorkouts = {};
      for (let d = dayOfWeek; d <= 6; d++) {
        currentWorkouts[d] = existing[d] !== undefined ? existing[d] : d;
      }

      // Shift: tapped day becomes rest (0), each subsequent day gets the previous day's workout
      newSwaps[dayOfWeek] = 0; // rest
      for (let d = dayOfWeek + 1; d <= 6; d++) {
        newSwaps[d] = currentWorkouts[d - 1];
      }
      // Last day (Saturday) workout falls off

      return { ...prev, [weekKey]: newSwaps };
    });
    setSelectedDay(null);
  }, [selectedDay, setWeekSwaps]);

  const handleSwapWorkout = useCallback((templateDayIndex) => {
    if (!selectedDay) return;
    const date = selectedDay.date;
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const dayOfWeek = date.getDay();

    setWeekSwaps((prev) => {
      const existing = prev[weekKey] || {};
      return { ...prev, [weekKey]: { ...existing, [dayOfWeek]: templateDayIndex } };
    });
    setSelectedDay(null);
    setShowSwapPicker(false);
  }, [selectedDay, setWeekSwaps]);

  const handleResetDay = useCallback(() => {
    if (!selectedDay) return;
    const date = selectedDay.date;
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const dayOfWeek = date.getDay();

    setWeekSwaps((prev) => {
      const existing = prev[weekKey];
      if (!existing) return prev;
      const newSwaps = { ...existing };
      delete newSwaps[dayOfWeek];
      if (Object.keys(newSwaps).length === 0) {
        const next = { ...prev };
        delete next[weekKey];
        return next;
      }
      return { ...prev, [weekKey]: newSwaps };
    });
    setSelectedDay(null);
  }, [selectedDay, setWeekSwaps]);

  const isDaySwapped = useCallback((date) => {
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const swaps = weekSwaps[weekKey];
    if (!swaps) return false;
    const dayOfWeek = date.getDay();
    return swaps[dayOfWeek] !== undefined && swaps[dayOfWeek] !== dayOfWeek;
  }, [weekSwaps]);

  useEffect(() => {
    if (todayRef.current) todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const collisionDetection = useCallback((args) => {
    const pw = pointerWithin(args);
    if (pw.length > 0) return pw;
    return rectIntersection(args);
  }, []);

  const selectedSummary = useMemo(() => {
    if (!selectedDay) return null;
    return getSwappedWorkoutSummaryForDate(selectedDay.date, weekSwaps);
  }, [selectedDay, weekSwaps]);

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
              const swapped = dayInfo.isCurrentMonth && isDaySwapped(dayInfo.date);

              const cellWeekStart = dayInfo.isCurrentMonth ? startOfWeek(dayInfo.date, { weekStartsOn: 0 }).getTime() : null;
              const isValidTarget = activeId && !isDragging && dayInfo.isCurrentMonth && cellWeekStart === activeWeekStart;

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
                  swapped={swapped}
                  onTap={handleDayTap}
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

      {/* Day Options Bottom Sheet */}
      <AnimatePresence>
        {selectedDay && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedDay(null); setShowSwapPicker(false); }}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] rounded-t-3xl border-t border-white/[0.10] px-5 pb-8 pt-3"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

              {/* Day Info Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[17px] font-bold text-white">
                    {format(selectedDay.date, 'EEEE, MMM d')}
                  </h3>
                  {selectedSummary && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedSummary.accent }} />
                      <span className="text-[14px] font-medium" style={{ color: selectedSummary.accent }}>
                        {selectedSummary.label === 'Rest' ? 'Rest Day' : selectedSummary.label}
                      </span>
                      {isDaySwapped(selectedDay.date) && (
                        <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full font-medium">
                          Modified
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedDay(null); setShowSwapPicker(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
                >
                  <X size={16} className="text-white/60" />
                </button>
              </div>

              {!showSwapPicker ? (
                <div className="flex flex-col gap-2.5">
                  {/* Insert Rest Day */}
                  <button
                    onClick={handleInsertRestDay}
                    className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] active:bg-white/[0.10] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-600/30 flex items-center justify-center">
                      <Moon size={18} className="text-slate-400" />
                    </div>
                    <div className="text-left">
                      <span className="text-[15px] font-medium text-white block">Insert Rest Day</span>
                      <span className="text-[12px] text-[#777]">Shifts remaining workouts forward</span>
                    </div>
                  </button>

                  {/* Swap Workout */}
                  <button
                    onClick={() => setShowSwapPicker(true)}
                    className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] active:bg-white/[0.10] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-600/30 flex items-center justify-center">
                      <Repeat2 size={18} className="text-amber-400" />
                    </div>
                    <div className="text-left">
                      <span className="text-[15px] font-medium text-white block">Swap Workout</span>
                      <span className="text-[12px] text-[#777]">Pick a different workout for this day</span>
                    </div>
                  </button>

                  {/* Reset to Default */}
                  {isDaySwapped(selectedDay.date) && (
                    <button
                      onClick={handleResetDay}
                      className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] active:bg-white/[0.10] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-600/30 flex items-center justify-center">
                        <RotateCcw size={18} className="text-blue-400" />
                      </div>
                      <div className="text-left">
                        <span className="text-[15px] font-medium text-white block">Reset to Default</span>
                        <span className="text-[12px] text-[#777]">Restore original workout for this day</span>
                      </div>
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setShowSwapPicker(false)}
                    className="text-[13px] text-accent-blue mb-3 flex items-center gap-1"
                  >
                    <ChevronLeft size={14} />
                    Back
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(WEEKLY_TEMPLATE).map(([dayIdx, workout]) => {
                      const summary = getWorkoutSummary(workout);
                      return (
                        <button
                          key={dayIdx}
                          onClick={() => handleSwapWorkout(Number(dayIdx))}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-white/[0.08] active:bg-white/[0.10] transition-colors"
                          style={{ backgroundColor: `${summary.color}1A` }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: summary.accent }} />
                          <span className="text-[13px] font-medium text-white">{workout.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
  return label.toUpperCase().slice(0, 8);
}

function CalendarCell({ id, dayInfo, isToday, isLogged, summary, hasSkippedHic, bgColor, borderStyle, isDragging, isValidTarget, todayRef, swapped, onTap }) {
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

  const handleClick = useCallback((e) => {
    // Only fire tap if this wasn't a drag
    if (!isDragging) {
      onTap(dayInfo);
    }
  }, [isDragging, onTap, dayInfo]);

  return (
    <div
      ref={ref}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
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
      {/* Swap indicator */}
      {swapped && !isDragging && (
        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
      )}
    </div>
  );
}
