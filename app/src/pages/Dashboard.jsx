import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, Dumbbell, ChevronRight, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSwappedWorkoutForDate, getSwappedWorkoutSummaryForDate } from '../utils/workout';
import WeekStrip from '../components/WeekStrip';
import MuscleHeatmap from '../components/MuscleHeatmap';

export default function Dashboard({ onNavigate }) {
  const { workoutHistory, settings, weekSwaps } = useApp();

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayWorkout = useMemo(() => getSwappedWorkoutForDate(today, weekSwaps), [today, weekSwaps]);

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map((e) => new Date(e.date).toDateString())),
    [workoutHistory]
  );
  const todayLogged = loggedDates.has(today.toDateString());

  const streak = useMemo(() => {
    let s = 0;
    const check = new Date(today);
    while (loggedDates.has(check.toDateString())) {
      s++;
      check.setDate(check.getDate() - 1);
    }
    return s;
  }, [loggedDates, today]);

  const weekWorkouts = useMemo(() => {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return workoutHistory.filter((e) => new Date(e.date) >= weekStart).length;
  }, [workoutHistory, today]);

  const totalWorkouts = workoutHistory.length;

  const recentActivity = useMemo(() => {
    return [...workoutHistory].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  }, [workoutHistory]);

  const todaySummary = useMemo(() => getSwappedWorkoutSummaryForDate(today, weekSwaps), [today, weekSwaps]);

  const typeLabel = {
    rest: 'Rest Day',
    strength: todayWorkout.short,
    tri: todayWorkout.short,
    long: todayWorkout.short,
  };

  const typeGradient = {
    rest: 'from-slate-800 to-slate-900',
    strength: 'from-red-950 to-red-900/50',
    tri: 'from-teal-950 to-teal-900/50',
    long: 'from-indigo-950 to-indigo-900/50',
  };

  return (
    <div className="px-4 py-4 pb-6 space-y-4">
      {/* Today's Workout Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gradient-to-br ${typeGradient[todayWorkout.type]} rounded-2xl p-5 border border-white/5 relative overflow-hidden`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] rounded-full -translate-y-8 translate-x-8" />
        <div className="relative">
          <p className="text-xs text-slate-400 mb-1">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <h2 className="text-xl font-bold text-white mb-1">{todayWorkout.name}</h2>
          <p className="text-sm text-slate-400 mb-4">{todaySummary.label}</p>

          {todayLogged ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <Zap size={16} />
              Completed today!
            </div>
          ) : todayWorkout.type !== 'rest' ? (
            <button
              onClick={() => onNavigate('workout')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              Start Workout
              <ChevronRight size={16} />
            </button>
          ) : (
            <p className="text-sm text-slate-500 italic">Take time to recover and prepare for tomorrow.</p>
          )}
        </div>
      </motion.div>

      {/* Week Strip */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">This Week</h3>
        <WeekStrip />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-700 rounded-xl p-3 border border-white/5">
          <Flame size={16} className="text-orange-400 mb-1" />
          <div className="text-2xl font-bold text-white">{streak}</div>
          <div className="text-[10px] text-slate-500 uppercase">Streak</div>
        </div>
        <div className="bg-dark-700 rounded-xl p-3 border border-white/5">
          <TrendingUp size={16} className="text-accent-blue mb-1" />
          <div className="text-2xl font-bold text-white">{weekWorkouts}</div>
          <div className="text-[10px] text-slate-500 uppercase">This Week</div>
        </div>
        <div className="bg-dark-700 rounded-xl p-3 border border-white/5">
          <Dumbbell size={16} className="text-accent-purple mb-1" />
          <div className="text-2xl font-bold text-white">{totalWorkouts}</div>
          <div className="text-[10px] text-slate-500 uppercase">Total</div>
        </div>
      </div>

      {/* Muscle Heatmap */}
      <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Weekly Muscle Impact</h3>
        <MuscleHeatmap period="week" />
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Activity</h3>
          <div className="space-y-2">
            {recentActivity.map((entry, idx) => {
              const d = new Date(entry.date);
              const typeBg = { strength: 'bg-red-500/20 text-red-400', tri: 'bg-teal-500/20 text-teal-400', long: 'bg-indigo-500/20 text-indigo-400' };
              return (
                <div key={idx} className="bg-dark-700 rounded-xl px-4 py-3 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-200">{entry.workoutName}</div>
                    <div className="text-xs text-slate-500">{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${typeBg[entry.type] || 'bg-slate-700 text-slate-400'}`}>
                    {entry.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
