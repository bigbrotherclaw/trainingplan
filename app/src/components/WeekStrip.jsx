import { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getSwappedWorkoutForDate } from '../utils/workout';
import { CheckCircle } from 'lucide-react';

const typeColors = {
  rest: 'bg-gray-800/40 border-gray-700/30',
  strength: 'bg-amber-950/40 border-amber-800/30',
  tri: 'bg-teal-950/40 border-teal-800/30',
  long: 'bg-emerald-950/40 border-emerald-800/30',
  hic: 'bg-purple-950/40 border-purple-800/30',
};

const typeAccents = {
  rest: 'text-[#666666]',
  strength: 'text-amber-400',
  tri: 'text-teal-400',
  long: 'text-emerald-400',
  hic: 'text-purple-400',
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
          } ${isToday ? 'ring-2 ring-accent-blue ring-offset-1 ring-offset-black' : ''}`}
        >
          <span className="text-[10px] font-medium text-[#666666]">{format(date, 'EEE')}</span>
          <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-[#B3B3B3]'}`}>
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
