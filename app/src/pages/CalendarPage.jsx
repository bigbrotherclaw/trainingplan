import { useMemo, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, ArrowRightLeft } from 'lucide-react';
import { format, isSameDay, startOfWeek, addMonths, subMonths } from 'date-fns';
import { useApp } from '../context/AppContext';
import { getWorkoutSummaryForDate, getMonthData, formatDateKey, getSwappedWorkoutForDate } from '../utils/workout';
import { WEEKLY_TEMPLATE } from '../data/training';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarPage() {
  const { workoutHistory, weekSwaps, setWeekSwaps } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [swapMode, setSwapMode] = useState(null); // null or { date, day }
  const todayRef = useRef(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const loggedDates = useMemo(() => new Set(workoutHistory.map((e) => new Date(e.date).toDateString())), [workoutHistory]);

  const monthData = useMemo(() => getMonthData(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);

  const handleDayTap = (dayInfo) => {
    if (!dayInfo.isCurrentMonth) return;
    const date = dayInfo.date;
    const dayOfWeek = date.getDay();

    if (swapMode === null) {
      setSwapMode({ date, day: dayOfWeek });
    } else {
      if (isSameDay(swapMode.date, date)) {
        setSwapMode(null);
        return;
      }
      // Check both dates are in the same week
      const ws1 = startOfWeek(swapMode.date, { weekStartsOn: 0 });
      const ws2 = startOfWeek(date, { weekStartsOn: 0 });
      if (ws1.getTime() !== ws2.getTime()) {
        setSwapMode({ date, day: dayOfWeek });
        return;
      }
      // Perform swap
      const weekKey = formatDateKey(ws1);
      const existing = weekSwaps[weekKey] || {};
      const day1 = swapMode.day;
      const day2 = dayOfWeek;
      const current1 = existing[day1] !== undefined ? existing[day1] : day1;
      const current2 = existing[day2] !== undefined ? existing[day2] : day2;
      setWeekSwaps((prev) => ({
        ...prev,
        [weekKey]: { ...existing, [day1]: current2, [day2]: current1 },
      }));
      setSwapMode(null);
    }
  };

  const resetSwaps = () => {
    const ws = startOfWeek(today, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    setWeekSwaps((prev) => {
      const next = { ...prev };
      delete next[weekKey];
      return next;
    });
    setSwapMode(null);
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

      {/* Swap Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={14} className="text-slate-500" />
          <span className="text-xs text-slate-500">
            {swapMode ? `Tap another day to swap with ${format(swapMode.date, 'EEE')}` : 'Tap two days in same week to swap'}
          </span>
        </div>
        <button onClick={resetSwaps} className="text-[10px] text-slate-600 hover:text-accent-blue transition-colors">
          Reset Swaps
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-slate-600 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {monthData.map((dayInfo, idx) => {
          const isToday = isSameDay(dayInfo.date, today);
          const isLogged = loggedDates.has(dayInfo.date.toDateString());
          const summary = dayInfo.isCurrentMonth ? getWorkoutSummaryForDate(dayInfo.date) : null;
          const isSwapSelected = swapMode && isSameDay(swapMode.date, dayInfo.date);
          const log = isLogged ? workoutHistory.find((e) => new Date(e.date).toDateString() === dayInfo.date.toDateString()) : null;
          const hasSkippedHic = log?.details?.hic?.skipped;

          let bgColor = summary ? `${summary.color}33` : '#0a0a0a';
          let borderColor = '#1e293b';
          if (isToday) { borderColor = '#e2e8f0'; bgColor = summary ? `${summary.color}66` : '#1a1a1a'; }
          else if (isLogged) borderColor = '#10b981';
          else if (summary) borderColor = `${summary.accent}44`;
          if (!dayInfo.isCurrentMonth) bgColor = '#060606';

          return (
            <motion.button
              key={idx}
              ref={isToday ? todayRef : null}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleDayTap(dayInfo)}
              className="relative overflow-hidden"
              style={{
                aspectRatio: '1',
                backgroundColor: bgColor,
                border: isSwapSelected ? '2px solid #f59e0b' : isToday ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: dayInfo.isCurrentMonth ? 1 : 0.3,
              }}
            >
              {isSwapSelected && (
                <motion.div
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 bg-amber-500/10 rounded-lg"
                />
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
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
