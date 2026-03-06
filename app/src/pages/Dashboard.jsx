import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Flame } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSwappedWorkoutForDate } from '../utils/workout';
import ComplianceRing from '../components/ComplianceRing';

const TYPE_COLORS = {
  rest: '#6B7280',
  strength: '#F59E0B',
  tri: '#14B8A6',
  long: '#10B981',
};

const TYPE_BADGE_BG = {
  rest: 'bg-gray-500/15 text-gray-400',
  strength: 'bg-amber-500/15 text-amber-400',
  tri: 'bg-teal-500/15 text-teal-400',
  long: 'bg-emerald-500/15 text-emerald-400',
};

export default function Dashboard({ onNavigate }) {
  const { workoutHistory, weekSwaps } = useApp();

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayWorkout = useMemo(() => getSwappedWorkoutForDate(today, weekSwaps), [today, weekSwaps]);

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map((e) => new Date(e.date).toDateString())),
    [workoutHistory]
  );
  const todayLogged = loggedDates.has(today.toDateString());

  // Week data: Sun-Sat
  const weekData = useMemo(() => {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const workout = getSwappedWorkoutForDate(date, weekSwaps);
      const isLogged = loggedDates.has(date.toDateString());
      const isToday = date.toDateString() === today.toDateString();
      const isPast = date < today;
      return { date, workout, isLogged, isToday, isPast };
    });
  }, [today, weekSwaps, loggedDates]);

  const weekWorkouts = weekData.filter(d => d.isLogged).length;
  const plannedWorkouts = weekData.filter(d => d.workout.type !== 'rest').length;

  // Weekly tonnage
  const weekTonnage = useMemo(() => {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    let total = 0;
    workoutHistory
      .filter((e) => new Date(e.date) >= weekStart && e.type === 'strength' && e.details?.lifts)
      .forEach((entry) => {
        entry.details.lifts.forEach((lift) => {
          total += lift.weight * lift.reps * (lift.setsCompleted || 1);
        });
        if (entry.details.accessories) {
          entry.details.accessories.forEach((acc) => {
            total += (acc.weight || 0) * acc.reps * (acc.setsCompleted || 1);
          });
        }
      });
    return total;
  }, [workoutHistory, today]);

  // Streak calculation - consecutive days with workouts, allowing rest days
  const { streak, bestStreak } = useMemo(() => {
    if (workoutHistory.length === 0) return { streak: 0, bestStreak: 0 };
    const sortedDates = [...new Set(workoutHistory.map(e => new Date(e.date).toDateString()))]
      .map(d => new Date(d))
      .sort((a, b) => b - a);

    // Current streak: go back from today, counting days that have workouts
    // Allow rest days (days in the template that are rest) to not break the streak
    let current = 0;
    const check = new Date(today);
    while (true) {
      const dateStr = check.toDateString();
      const hasWorkout = loggedDates.has(dateStr);
      const scheduled = getSwappedWorkoutForDate(check, weekSwaps);
      const isRest = scheduled.type === 'rest';
      if (hasWorkout) {
        current++;
        check.setDate(check.getDate() - 1);
      } else if (isRest && check <= today) {
        // Rest days don't break streak but don't add to it
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
      // Safety: don't go back more than 365 days
      if (today - check > 365 * 24 * 60 * 60 * 1000) break;
    }

    // Best streak: simple consecutive logged days
    let best = 0, run = 0, prev = null;
    const allDates = [...new Set(workoutHistory.map(e => {
      const d = new Date(e.date); d.setHours(0,0,0,0); return d.getTime();
    }))].sort();
    for (const t of allDates) {
      if (prev && t - prev === 86400000) {
        run++;
      } else {
        run = 1;
      }
      if (run > best) best = run;
      prev = t;
    }

    return { streak: current, bestStreak: Math.max(best, current) };
  }, [workoutHistory, loggedDates, today, weekSwaps]);

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      {/* YOUR WEEK */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03] active:scale-[0.98] transition-transform"
      >
        <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-widest mb-4">Your Week</h2>
        <div className="flex justify-between gap-2 mb-4">
          {weekData.map((day, i) => {
            const color = TYPE_COLORS[day.workout.type];
            const filled = day.isLogged;
            const isToday = day.isToday;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-[#666666] font-medium">{dayLabels[i]}</span>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isToday ? 'animate-pulse-ring' : ''
                  }`}
                  style={{
                    backgroundColor: filled ? color : 'transparent',
                    border: filled ? 'none' : `2px solid ${isToday ? color : color + '40'}`,
                    opacity: !filled && day.isPast && !isToday ? 0.3 : 1,
                  }}
                >
                  {filled && <span className="text-black text-xs font-bold">{day.date.getDate()}</span>}
                  {!filled && <span className="text-[11px] font-medium" style={{ color: color + (isToday ? '' : '80') }}>{day.date.getDate()}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#B3B3B3]">
            <span className="text-white font-semibold">{weekWorkouts}</span> of {plannedWorkouts} workouts complete
          </p>
          {weekTonnage > 0 && (
            <p className="text-xs text-[#666666]">{weekTonnage.toLocaleString()} lbs lifted</p>
          )}
        </div>
      </motion.div>

      {/* TODAY'S WORKOUT */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03] active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-widest">Today</h2>
          <span className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full ${TYPE_BADGE_BG[todayWorkout.type]}`}>
            {todayWorkout.type}
          </span>
        </div>
        <h3 className="text-2xl font-semibold text-white mb-1">{todayWorkout.name}</h3>
        <p className="text-sm text-[#666666] mb-4">
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>

        {todayLogged ? (
          <div className="flex items-center gap-2 text-accent-green text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-accent-green" />
            Completed today
          </div>
        ) : todayWorkout.type !== 'rest' ? (
          <button
            onClick={() => onNavigate('workout')}
            className="flex items-center justify-center gap-2 w-full bg-accent-blue hover:bg-accent-blue/90 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
          >
            Start Workout
            <ChevronRight size={16} />
          </button>
        ) : (
          <p className="text-sm text-[#666666] italic">Take time to recover and prepare for tomorrow.</p>
        )}
      </motion.div>

      {/* STREAK */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03] active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-widest mb-2">Streak</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">{streak}</span>
              <Flame size={24} className="text-orange-400" />
            </div>
            <p className="text-xs text-[#666666] mt-1">Best: {bestStreak} days</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{workoutHistory.length}</div>
            <p className="text-xs text-[#666666]">total workouts</p>
          </div>
        </div>
      </motion.div>

      {/* COMPLIANCE RING */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <ComplianceRing weekWorkouts={weekWorkouts} />
      </motion.div>
    </div>
  );
}
