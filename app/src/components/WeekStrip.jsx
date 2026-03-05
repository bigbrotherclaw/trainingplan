import { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getSwappedWorkoutForDate } from '../utils/workout';
import { CheckCircle } from 'lucide-react';

const typeColors = {
  rest: 'bg-slate-700/40 border-slate-600/30',
  strength: 'bg-red-950/60 border-red-800/30',
  tri: 'bg-teal-950/60 border-teal-800/30',
  long: 'bg-indigo-950/60 border-indigo-800/30',
};

const typeAccents = {
  rest: 'text-slate-500',
  strength: 'text-red-400',
  tri: 'text-teal-400',
  long: 'text-indigo-400',
};

export default function WeekStrip({ onDayTap }) {
  const { workoutHistory, weekSwaps } = useApp();
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 0 }), [today]);

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map((e) => new Date(e.date).toDateString())),
    [workoutHistory]
  );

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const workout = getSwappedWorkoutForDate(date, weekSwaps);
      return { date, workout, isToday: isSameDay(date, today), isLogged: loggedDates.has(date.toDateString()) };
    }),
    [weekStart, today, loggedDates, weekSwaps]
  );

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
      {days.map(({ date, workout, isToday, isLogged }) => (
        <motion.button
          key={date.toISOString()}
          whileTap={{ scale: 0.95 }}
          onClick={() => onDayTap?.(date)}
          className={`flex-1 min-w-[44px] flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border transition-all relative ${
            typeColors[workout.type]
          } ${isToday ? 'ring-2 ring-accent-blue ring-offset-1 ring-offset-dark-900' : ''}`}
        >
          <span className="text-[10px] font-medium text-slate-500">{format(date, 'EEE')}</span>
          <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-300'}`}>
            {format(date, 'd')}
          </span>
          <span className={`text-[9px] font-semibold uppercase ${typeAccents[workout.type]}`}>
            {workout.short}
          </span>
          {isLogged && (
            <CheckCircle size={12} className="text-emerald-400 absolute top-1 right-1" />
          )}
        </motion.button>
      ))}
    </div>
  );
}
