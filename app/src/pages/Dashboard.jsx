import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { getRecoverySuggestion, getZoneColor } from '../utils/recoveryAdvisor';
import { getSportName, getSportIcon, getSportColor, formatDuration } from '../utils/whoopSports';
import { getSwappedWorkoutForDate } from '../utils/workout';
import ComplianceRing from '../components/ComplianceRing';

const TYPE_COLORS = {
  rest: '#6B7280',
  strength: '#F59E0B',
  tri: '#14B8A6',
  long: '#10B981',
};

const TYPE_BADGE_BG = {
  rest: 'bg-gray-500/20 text-gray-400',
  strength: 'bg-amber-500/20 text-amber-400',
  tri: 'bg-teal-500/20 text-teal-400',
  long: 'bg-emerald-500/20 text-emerald-400',
};

export default function Dashboard({ onNavigate }) {
  const { workoutHistory, weekSwaps } = useApp();
  const { connected, latestRecovery, latestSleep, latestCycle, workouts: whoopWorkouts } = useWhoop();

  // Recovery data
  const recoverySuggestion = useMemo(() => {
    if (!connected || !latestRecovery) return null;
    return getRecoverySuggestion(latestRecovery, latestSleep, latestCycle);
  }, [connected, latestRecovery, latestSleep, latestCycle]);

  const recoveryScore = recoverySuggestion?.score ?? null;
  const zoneColor = recoverySuggestion ? getZoneColor(recoverySuggestion.zone) : null;

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
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
      if (today - check > 365 * 24 * 60 * 60 * 1000) break;
    }

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

  const compliancePct = Math.min(100, Math.round((weekWorkouts / 6) * 100));
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayColor = TYPE_COLORS[todayWorkout.type];

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">

      {/* YOUR WEEK */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
      >
        <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Your Week</h2>
        <div className="flex justify-between px-1">
          {weekData.map((day, i) => {
            const color = TYPE_COLORS[day.workout.type];
            const filled = day.isLogged;
            const isToday = day.isToday;
            return (
              <div key={i} className="flex flex-col items-center flex-1 gap-1.5">
                <span className="text-[10px] text-[#666666]">{dayLabels[i]}</span>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isToday ? 'animate-pulse-ring' : ''
                  }`}
                  style={{
                    backgroundColor: filled ? color : 'transparent',
                    border: filled ? 'none' : `2px solid ${isToday ? color : color + '40'}`,
                    opacity: !filled && day.isPast && !isToday ? 0.3 : 1,
                  }}
                >
                  {filled
                    ? <span className="text-black text-xs font-bold">{day.date.getDate()}</span>
                    : <span className="text-[11px] font-medium" style={{ color: color + (isToday ? '' : '80') }}>{day.date.getDate()}</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[15px] text-[#A0A0A0] mt-4">
          <span className="text-white font-semibold">{weekWorkouts}</span> of {plannedWorkouts} complete
          {weekTonnage > 0 && (
            <span className="text-[13px] text-[#555555] ml-2">&middot; {weekTonnage.toLocaleString()} lbs lifted</span>
          )}
        </p>
      </motion.div>

      {/* RECOVERY SUMMARY (Whoop) */}
      {recoverySuggestion && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Recovery</h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: zoneColor + '20', color: zoneColor }}>
              {recoverySuggestion.zone === 'green' ? 'Green' : recoverySuggestion.zone === 'yellow' ? 'Yellow' : 'Red'}
            </span>
          </div>

          {/* Score + metrics row */}
          <div className="flex items-center gap-4">
            {/* Recovery arc */}
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r="24" fill="none" stroke="#333" strokeWidth="4" />
                <circle cx="28" cy="28" r="24" fill="none" stroke={zoneColor} strokeWidth="4"
                  strokeDasharray={`${(recoveryScore / 100) * 150.8} 150.8`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[15px] font-bold" style={{ color: zoneColor }}>{recoveryScore}%</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[15px] font-semibold text-white">{recoverySuggestion.hrv?.toFixed(1) ?? '—'}</div>
                <div className="text-[10px] text-[#666666] uppercase">HRV</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold text-white">{recoverySuggestion.sleepScore ?? '—'}%</div>
                <div className="text-[10px] text-[#666666] uppercase">Sleep</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold text-white">{recoverySuggestion.strain?.toFixed(1) ?? '—'}</div>
                <div className="text-[10px] text-[#666666] uppercase">Strain</div>
              </div>
            </div>
          </div>

          {/* Suggestion headline */}
          <p className="text-[13px] text-[#A0A0A0] mt-3 leading-snug">{recoverySuggestion.headline}</p>
        </motion.div>
      )}

      {/* RECENT WHOOP ACTIVITIES */}
      {connected && whoopWorkouts?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Recent Activities</h2>
            <button onClick={() => onNavigate('stats')} className="text-[11px] text-accent-blue font-medium">View All</button>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {whoopWorkouts.slice(-5).reverse().map((w, i) => {
              const strain = w.score?.strain;
              const avgHR = w.score?.average_heart_rate;
              const duration = formatDuration(w.start, w.end);
              const color = getSportColor(w.sport_id);
              const SportIcon = getSportIcon(w.sport_id, w);
              return (
                <div key={i} className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + '15' }}>
                    <SportIcon size={16} color={color} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-white truncate">{getSportName(w.sport_id, w)}</div>
                    <div className="text-[11px] text-[#666666]">
                      {new Date(w.start || w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {duration !== '—' && <span> &middot; {duration}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {strain != null && (
                      <div className="text-center">
                        <div className="text-[13px] font-semibold" style={{ color }}>{strain.toFixed(1)}</div>
                        <div className="text-[9px] text-[#555555] uppercase">Strain</div>
                      </div>
                    )}
                    {avgHR != null && (
                      <div className="text-center">
                        <div className="text-[13px] font-semibold text-white">{avgHR}</div>
                        <div className="text-[9px] text-[#555555] uppercase">HR</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* TODAY'S WORKOUT */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden"
      >
        {/* Left color accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: todayColor }} />
        <div className="p-5 pl-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Today</h2>
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-medium px-3 py-1 rounded-full shrink-0 ${TYPE_BADGE_BG[todayWorkout.type] || 'bg-gray-500/20 text-gray-400'}`}>
                {todayWorkout.label || todayWorkout.type}
              </span>
            </div>
          </div>
          <h3 className="text-[22px] font-bold text-white mb-1">{todayWorkout.name}</h3>
          <p className="text-[15px] text-[#A0A0A0]">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>

          {todayLogged ? (
            <div className="flex items-center gap-2 text-accent-green text-[15px] font-medium mt-4">
              <div className="w-2 h-2 rounded-full bg-accent-green" />
              Completed today
            </div>
          ) : todayWorkout.type !== 'rest' ? (
            <button
              onClick={() => onNavigate('workout')}
              className="flex items-center justify-center gap-2 w-full bg-accent-blue hover:bg-accent-blue/90 text-white rounded-2xl text-[17px] font-semibold transition-colors active:scale-[0.98] mt-4 min-h-[52px]"
            >
              Start Workout
              <ChevronRight size={18} />
            </button>
          ) : (
            <p className="text-[15px] text-[#666666] italic mt-4">Take time to recover and prepare for tomorrow.</p>
          )}
        </div>
      </motion.div>

      {/* STATS ROW */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3"
      >
        {(() => { const allZero = streak === 0 && workoutHistory.length === 0 && compliancePct === 0; const numColor = allZero ? 'text-[#555555]' : 'text-white'; const cardOpacity = allZero ? 'opacity-50' : ''; return (<>
        <div className={`bg-[#141414] rounded-2xl border border-white/[0.10] py-5 px-3 text-center ${cardOpacity}`}>
          <div className={`text-[22px] font-bold leading-none ${numColor}`}>{streak}</div>
          <div className="text-[11px] uppercase tracking-wider text-[#555555] mt-2">Streak</div>
        </div>
        <div className={`bg-[#141414] rounded-2xl border border-white/[0.10] py-5 px-3 text-center ${cardOpacity}`}>
          <div className={`text-[22px] font-bold leading-none ${numColor}`}>{workoutHistory.length}</div>
          <div className="text-[11px] uppercase tracking-wider text-[#555555] mt-2">Workouts</div>
        </div>
        <div className={`bg-[#141414] rounded-2xl border border-white/[0.10] py-5 px-3 text-center ${cardOpacity}`}>
          <div className={`text-[22px] font-bold leading-none ${numColor}`}>{compliancePct}<span className="text-[14px] font-semibold">%</span></div>
          <div className="text-[11px] uppercase tracking-wider text-[#555555] mt-2">Compliance</div>
        </div>
        </>); })()}
      </motion.div>

      {/* WEEKLY COMPLIANCE RING */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
      >
        <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-5">Weekly Compliance</h2>
        {weekWorkouts === 0 ? (
          <p className="text-[13px] text-[#555555] text-center py-1">Complete your first workout to track compliance</p>
        ) : (
          <div className="flex justify-center">
            <ComplianceRing weekWorkouts={weekWorkouts} size={80} />
          </div>
        )}
      </motion.div>

    </div>
  );
}
