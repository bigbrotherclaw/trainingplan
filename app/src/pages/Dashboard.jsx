import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, ChevronUp, Heart, Activity, Moon, Zap, Battery, Droplets } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { getRecoverySuggestion, getZoneColor } from '../utils/recoveryAdvisor';
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

function scoreToZone(score) {
  if (score >= 67) return 'green';
  if (score >= 34) return 'yellow';
  return 'red';
}

/* ── Recovery Score Arc (270-degree SVG ring) ── */
function RecoveryArc({ score, color, size = 80 }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75; // 270 degrees
  const arcLength = circumference * arcFraction;
  const filled = arcLength * (score / 100);
  const rotation = 135; // start at bottom-left

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeOpacity={0.08}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[22px] font-bold text-white leading-none">{score}</span>
      </div>
    </div>
  );
}

/* ── Recovery Banner ── */
function RecoveryBanner({ latestRecovery, latestSleep, latestCycle }) {
  const [expanded, setExpanded] = useState(false);

  // Extract from Whoop v2 API response shape (nested under .score)
  const score = latestRecovery?.score?.recovery_score ?? latestRecovery?.recovery_score ?? 0;
  const rawHrv = latestRecovery?.score?.hrv_rmssd_milli ?? latestRecovery?.hrv_rmssd_milli ?? null;
  const hrv = rawHrv != null ? Math.round(rawHrv * 10) / 10 : '--';
  const rhr = latestRecovery?.score?.resting_heart_rate ?? latestRecovery?.resting_heart_rate ?? '--';
  const sleepScore = latestSleep?.score?.sleep_performance_percentage ?? latestSleep?.sleep_performance_percentage ?? '--';
  const stages = latestSleep?.score?.stage_summary ?? latestSleep?.stage_summary;
  const sleepDurationMs = stages ? (stages.total_in_bed_time_milli - (stages.total_awake_time_milli || 0)) : null;
  const strain = latestCycle?.score?.strain ?? latestCycle?.strain ?? '--';
  const spo2 = latestRecovery?.score?.spo2_percentage ?? latestRecovery?.spo2_percentage ?? '--';
  const zone = scoreToZone(score);
  const zoneColor = getZoneColor(zone);
  const zoneLabel = zone === 'green' ? 'Good' : zone === 'yellow' ? 'Fair' : 'Poor';

  const sleepHours = sleepDurationMs
    ? `${Math.floor(sleepDurationMs / 3600000)}h ${Math.round((sleepDurationMs % 3600000) / 60000)}m`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${zoneColor}0D 0%, #141414 60%)`,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-5 flex items-center gap-5">
        <RecoveryArc score={score} color={zoneColor} size={80} />

        <div className="flex-1 min-w-0">
          <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-1">Recovery</h2>
          <p className="text-[15px] font-semibold text-white mb-2">
            <span className="font-normal" style={{ color: zoneColor }}>{zoneLabel}</span>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-[#666666]" />
              <span className="text-[13px] text-[#A0A0A0]">HRV</span>
              <span className="text-[13px] text-white font-semibold">{hrv} <span className="text-[#666666] font-normal">ms</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Moon size={14} className="text-[#666666]" />
              <span className="text-[13px] text-[#A0A0A0]">Sleep</span>
              <span className="text-[13px] text-white font-semibold">{sleepScore}<span className="text-[#666666] font-normal">%</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart size={14} className="text-[#666666]" />
              <span className="text-[13px] text-[#A0A0A0]">RHR</span>
              <span className="text-[13px] text-white font-semibold">{rhr} <span className="text-[#666666] font-normal">bpm</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-[#666666]" />
              <span className="text-[13px] text-[#A0A0A0]">Strain</span>
              <span className="text-[13px] text-white font-semibold">{typeof strain === 'number' ? strain.toFixed(1) : strain}</span>
            </div>
          </div>
        </div>

        {expanded ? (
          <ChevronUp size={18} className="text-[#555555] shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-[#555555] shrink-0" />
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-white/[0.06] pt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5">
                <Battery size={14} className="text-[#666666]" />
                <span className="text-[13px] text-[#A0A0A0]">Recovery</span>
                <span className="text-[13px] text-white font-semibold">{score}<span className="text-[#666666] font-normal">%</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={14} className="text-[#666666]" />
                <span className="text-[13px] text-[#A0A0A0]">HRV</span>
                <span className="text-[13px] text-white font-semibold">{hrv} <span className="text-[#666666] font-normal">ms</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Heart size={14} className="text-[#666666]" />
                <span className="text-[13px] text-[#A0A0A0]">RHR</span>
                <span className="text-[13px] text-white font-semibold">{rhr} <span className="text-[#666666] font-normal">bpm</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Moon size={14} className="text-[#666666]" />
                <span className="text-[13px] text-[#A0A0A0]">Sleep</span>
                <span className="text-[13px] text-white font-semibold">{sleepScore}<span className="text-[#666666] font-normal">%</span></span>
              </div>
              {sleepHours && (
                <div className="flex items-center gap-1.5">
                  <Moon size={14} className="text-[#666666]" />
                  <span className="text-[13px] text-[#A0A0A0]">Duration</span>
                  <span className="text-[13px] text-white font-semibold">{sleepHours}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-[#666666]" />
                <span className="text-[13px] text-[#A0A0A0]">Strain</span>
                <span className="text-[13px] text-white font-semibold">{typeof strain === 'number' ? strain.toFixed(1) : strain}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Droplets size={14} className="text-[#666666]" />
                <span className="text-[13px] text-[#A0A0A0]">SpO2</span>
                <span className="text-[13px] text-white font-semibold">{spo2}<span className="text-[#666666] font-normal">%</span></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Recovery Suggestion Card ── */
function RecoverySuggestionCard({ suggestion, onAccept, onDismiss }) {
  const zoneColor = getZoneColor(suggestion.zone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="relative bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden"
    >
      {/* Zone-colored left border */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: zoneColor }} />
      <div className="p-5 pl-6">
        <div className="flex items-center gap-2 mb-1">
          <Battery size={16} style={{ color: zoneColor }} />
          <span className="text-[15px] font-bold text-white">{suggestion.headline}</span>
        </div>
        <p className="text-[14px] text-[#A0A0A0] mb-1 leading-relaxed">{suggestion.suggestion}</p>
        {suggestion.modifications?.type === 'swap' && (
          <p className="text-[13px] font-medium mb-3" style={{ color: zoneColor }}>Swap to recovery session</p>
        )}
        {suggestion.modifications?.type === 'reduce' && suggestion.modifications?.intensityMultiplier && (
          <p className="text-[13px] font-medium mb-3" style={{ color: zoneColor }}>Reduce to {Math.round(suggestion.modifications.intensityMultiplier * 100)}% intensity</p>
        )}
        {!suggestion.modifications?.type || suggestion.modifications?.type === 'none' ? null : (
          suggestion.modifications?.type !== 'swap' && suggestion.modifications?.type !== 'reduce' && (
            <div className="mb-3" />
          )
        )}
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 text-[14px] font-semibold rounded-xl transition-colors active:scale-[0.98] min-h-[44px] text-white"
            style={{ backgroundColor: zoneColor }}
          >
            Accept Adjustment
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 text-[14px] font-semibold rounded-xl transition-colors active:scale-[0.98] min-h-[44px] text-[#A0A0A0] border border-white/[0.15] bg-transparent"
          >
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard({ onNavigate, acceptedSuggestion, onAcceptSuggestion, onDismissSuggestion }) {
  const { workoutHistory, weekSwaps, settings } = useApp();
  const { connected, latestRecovery, latestSleep, latestCycle } = useWhoop();

  const [dismissed, setDismissed] = useState(false);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayWorkout = useMemo(() => getSwappedWorkoutForDate(today, weekSwaps), [today, weekSwaps]);

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map((e) => new Date(e.date).toDateString())),
    [workoutHistory]
  );
  const todayLogged = loggedDates.has(today.toDateString());

  // Recovery suggestion
  const suggestion = useMemo(() => {
    if (!connected || !latestRecovery) return null;
    return getRecoverySuggestion({
      latestRecovery,
      latestSleep,
      latestCycle,
      todayWorkout,
      workoutHistory,
      settings,
    });
  }, [connected, latestRecovery, latestSleep, latestCycle, todayWorkout, workoutHistory, settings]);

  const showSuggestionCard = suggestion && suggestion.modifications?.type !== 'none' && !acceptedSuggestion && !dismissed;

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

  // Accepted suggestion display
  const intensityLabel = acceptedSuggestion?.modifications?.intensityMultiplier
    ? `${Math.round(acceptedSuggestion.modifications.intensityMultiplier * 100)}% intensity`
    : null;
  const suggestionZoneColor = acceptedSuggestion ? getZoneColor(acceptedSuggestion.zone) : null;

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">

      {/* RECOVERY BANNER — Whoop connected only */}
      {connected && latestRecovery && (
        <RecoveryBanner
          latestRecovery={latestRecovery}
          latestSleep={latestSleep}
          latestCycle={latestCycle}
        />
      )}

      {/* RECOVERY SUGGESTION CARD */}
      <AnimatePresence>
        {showSuggestionCard && (
          <RecoverySuggestionCard
            suggestion={suggestion}
            onAccept={() => onAcceptSuggestion?.(suggestion)}
            onDismiss={() => {
              setDismissed(true);
              onDismissSuggestion?.();
            }}
          />
        )}
      </AnimatePresence>

      {/* YOUR WEEK */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
      >
        <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-3">Your Week</h2>
        <div className="flex justify-between px-1">
          {weekData.map((day, i) => {
            const color = TYPE_COLORS[day.workout.type];
            const filled = day.isLogged;
            const isToday = day.isToday;
            return (
              <div key={i} className="flex flex-col items-center">
                <span className="text-[11px] text-[#666666] mb-1">{dayLabels[i]}</span>
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
        <p className="text-[15px] text-[#A0A0A0] mt-3">
          <span className="text-white font-semibold">{weekWorkouts}</span> of {plannedWorkouts} complete
          {weekTonnage > 0 && (
            <span className="text-[13px] text-[#555555] ml-2">&middot; {weekTonnage.toLocaleString()} lbs lifted</span>
          )}
        </p>
      </motion.div>

      {/* TODAY'S WORKOUT */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden bg-[#141414] rounded-2xl border border-white/[0.10]"
      >
        {/* Left color accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: todayColor }} />
        <div className="p-6 pl-7">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Today</h2>
            <div className="flex items-center gap-2">
              {acceptedSuggestion && (
                <span
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: suggestionZoneColor + '20', color: suggestionZoneColor }}
                >
                  Recovery adjusted
                </span>
              )}
              <span className={`text-[12px] font-medium px-3 py-1 rounded-full shrink-0 ${TYPE_BADGE_BG[todayWorkout.type] || 'bg-gray-500/20 text-gray-400'}`}>
                {todayWorkout.label || todayWorkout.type}
              </span>
            </div>
          </div>
          <h3 className="text-[22px] font-bold text-white mb-1">{todayWorkout.name}</h3>
          <p className="text-[15px] text-[#A0A0A0]">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {intensityLabel && (
              <span className="ml-2 text-[13px] font-medium" style={{ color: suggestionZoneColor }}>
                &middot; {intensityLabel}
              </span>
            )}
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
        className="flex gap-3"
      >
        {(() => { const allZero = streak === 0 && workoutHistory.length === 0 && compliancePct === 0; const numColor = allZero ? 'text-[#555555]' : 'text-white'; const cardOpacity = allZero ? 'opacity-50' : ''; return (<>
        <div className={`flex-1 bg-[#141414] rounded-2xl border border-white/[0.10] p-4 text-center ${cardOpacity}`}>
          <div className={`text-[22px] font-bold leading-none ${numColor}`}>{streak}</div>
          <div className="text-[12px] uppercase tracking-wider text-[#555555] mt-1">Streak</div>
        </div>
        <div className={`flex-1 bg-[#141414] rounded-2xl border border-white/[0.10] p-4 text-center ${cardOpacity}`}>
          <div className={`text-[22px] font-bold leading-none ${numColor}`}>{workoutHistory.length}</div>
          <div className="text-[12px] uppercase tracking-wider text-[#555555] mt-1">Workouts</div>
        </div>
        <div className={`flex-1 bg-[#141414] rounded-2xl border border-white/[0.10] p-4 text-center ${cardOpacity}`}>
          <div className={`text-[22px] font-bold leading-none ${numColor}`}>{compliancePct}<span className="text-[14px] font-semibold">%</span></div>
          <div className="text-[12px] uppercase tracking-wider text-[#555555] mt-1">Compliance</div>
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
        <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Weekly Compliance</h2>
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
