import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Moon, Flame, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { getSportName, getSportIcon, getSportColor, formatDuration } from '../utils/whoopSports';
import { getSwappedWorkoutForDate } from '../utils/workout';
import ComplianceRing from '../components/ComplianceRing';
import WhoopAutoLog from '../components/WhoopAutoLog';
import GlowBorder from '../components/GlowBorder';

const TYPE_COLORS = {
  rest: '#E63946',
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

// ── Animated Number Counter ──
function AnimatedNumber({ value, duration = 1.5, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (value == null || isNaN(value)) return;
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  const formatted = value == null || isNaN(value) ? '—' : display.toFixed(decimals);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatted}{suffix}</span>;
}

// ── Recovery Gauge (circular) ──
// ── Donut Gauge (reusable for Sleep, Recovery, Strain) ──
function DonutGauge({ value, max = 100, label, size = 90, getColor, decimals = 0, suffix = '%', strokeW = 6, delay = 0, target = null }) {
  const radius = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const pct = Math.min((value ?? 0) / max, 1);
  const color = getColor(value ?? 0);

  // Target marker position (angle on the circle, SVG is rotated -90deg so 0 = top)
  const targetPct = target != null ? Math.min(target / max, 1) : null;
  const targetAngle = targetPct != null ? targetPct * 360 : null;
  const markerLen = strokeW + 4;

  // Calculate marker line endpoints (inner to outer of the stroke)
  let markerX1, markerY1, markerX2, markerY2;
  if (targetAngle != null) {
    const rad = (targetAngle - 90) * (Math.PI / 180); // -90 because SVG is rotated
    const innerR = radius - markerLen / 2;
    const outerR = radius + markerLen / 2;
    markerX1 = center + innerR * Math.cos(rad);
    markerY1 = center + innerR * Math.sin(rad);
    markerX2 = center + outerR * Math.cos(rad);
    markerY2 = center + outerR * Math.sin(rad);
  }

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {/* Background track */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#222" strokeWidth={strokeW}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
          {/* Animated fill */}
          <motion.circle
            cx={center} cy={center} r={radius} fill="none"
            stroke={color} strokeWidth={strokeW} strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', filter: `drop-shadow(0 0 6px ${color}60)` }}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${pct * circumference} ${circumference}` }}
            transition={{ delay: delay + 0.2, duration: 1.8, ease: [0.34, 1.56, 0.64, 1] }}
          />
          {/* Target marker */}
          {targetAngle != null && (
            <line
              x1={markerX1} y1={markerY1} x2={markerX2} y2={markerY2}
              stroke="#ffffff" strokeWidth={2} strokeLinecap="round"
              opacity={0.9}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-bold" style={{ color, fontVariantNumeric: 'tabular-nums', fontSize: size * 0.24 }}>
            <AnimatedNumber value={value} decimals={decimals} suffix={suffix} duration={1.8} />
          </div>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-[#555]" style={{ marginTop: 6 }}>{label}</div>
    </motion.div>
  );
}

// (Old RecoveryGauge, StrainBar, SleepGauge removed — replaced by DonutGauge)

// ── Stat Mini Card ──
function StatMiniCard({ label, icon, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className="bg-[#141414] rounded-2xl border border-white/[0.10] p-4 flex flex-col items-center justify-center"
    >
      {icon && <div style={{ marginBottom: 6 }}>{icon}</div>}
      {children}
      <div className="text-[10px] uppercase tracking-widest text-[#666]" style={{ marginTop: 4 }}>{label}</div>
    </motion.div>
  );
}

export default function Dashboard({ onNavigate, onNavigateToWorkout }) {
  const { workoutHistory, weekSwaps } = useApp();
  const { connected, workouts: whoopWorkouts, data: whoopData, connect } = useWhoop();

  // Extract latest Whoop metrics
  const whoopMetrics = useMemo(() => {
    if (!connected) return null;
    // Get today's date key in LOCAL timezone (not UTC)
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Try today first, fall back to most recent
    const findForDate = (arr, dateKey) => {
      if (!arr?.length) return null;
      const todayEntry = arr.find(r => r.date === dateKey);
      return todayEntry || arr[arr.length - 1]; // fallback to latest
    };
    
    const latestRecovery = findForDate(whoopData?.recovery, todayKey);
    const latestSleep = findForDate(whoopData?.sleep, todayKey);
    const latestCycle = findForDate(whoopData?.cycle, todayKey);

    const recoveryScore = latestRecovery?.score?.recovery_score ?? null;
    const hrv = latestRecovery?.score?.hrv_rmssd_milli ?? null;
    const restingHR = latestRecovery?.score?.resting_heart_rate ?? null;
    const sleepScore = latestSleep?.score?.sleep_performance_percentage ?? null;
    const strain = latestCycle?.score?.strain ?? null;
    const kilojoules = latestCycle?.score?.kilojoule ?? null;
    const calories = kilojoules != null ? Math.round(kilojoules * 0.239006) : null;

    if (recoveryScore == null && hrv == null && strain == null) return null;

    return { recoveryScore, hrv, restingHR, sleepScore, strain, calories };
  }, [connected, whoopData]);

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
    <div className="px-5 pt-4 pb-32">

      {/* YOUR WEEK */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
      >
        <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4 text-center">Your Week</h2>
        <div className="flex justify-between px-1">
          {weekData.map((day, i) => {
            const color = TYPE_COLORS[day.workout.type];
            const filled = day.isLogged;
            const isToday = day.isToday;
            const isFuture = !day.isPast && !isToday;
            const tappable = !isFuture;
            return (
              <div key={i} className="flex flex-col items-center flex-1 gap-1.5">
                <span className="text-[10px] text-[#666666]">{dayLabels[i]}</span>
                <button
                  disabled={!tappable}
                  onClick={() => tappable && onNavigateToWorkout(day.date)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isToday ? 'animate-pulse-ring' : ''
                  } ${tappable ? 'active:scale-95' : ''}`}
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
                </button>
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

      {/* TODAY'S WORKOUT */}
      <div style={{marginTop:"12px"}}>
      <GlowBorder color={todayColor} speed={4} radius={16}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="relative bg-[#141414] rounded-2xl overflow-hidden"
      >
        <div className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Today</h2>
            <span className={`text-[12px] font-medium px-3 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${TYPE_BADGE_BG[todayWorkout.type] || 'bg-gray-500/20 text-gray-400'}`}>
              {todayWorkout.type === 'rest' && <Moon size={12} />}
              {todayWorkout.label || todayWorkout.type}
            </span>
          </div>
          <h3 className="text-[22px] font-bold text-white mb-1">{todayWorkout.name}</h3>
          <p className="text-[15px] text-[#A0A0A0]">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>

          {todayLogged ? (
            <div className="flex items-center justify-center gap-2 text-accent-green text-[15px] font-medium mt-4">
              <div className="w-2 h-2 rounded-full bg-accent-green" />
              Completed today
            </div>
          ) : todayWorkout.type !== 'rest' ? (
            <button
              onClick={() => onNavigateToWorkout(today)}
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
      </GlowBorder>
      </div>

      {/* WHOOP STATS */}
      <div style={{marginTop:"12px"}}>
      {whoopMetrics ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          {/* Sleep / Recovery / Strain — 3 donut gauges side by side */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-4">
            <div className="flex items-end justify-around">
              <DonutGauge
                value={whoopMetrics.sleepScore ?? 0}
                max={100}
                label="Sleep"
                size={80}
                strokeW={5}
                decimals={0}
                suffix="%"
                delay={0}
                getColor={(s) => s >= 70 ? '#6366F1' : s >= 40 ? '#A78BFA' : '#EF4444'}
              />
              <DonutGauge
                value={whoopMetrics.recoveryScore ?? 0}
                max={100}
                label="Recovery"
                size={115}
                strokeW={7}
                decimals={0}
                suffix="%"
                delay={0.1}
                getColor={(s) => s >= 67 ? '#00D46A' : s >= 34 ? '#FFCC00' : '#EF4444'}
              />
              <DonutGauge
                value={whoopMetrics.strain ?? 0}
                max={21}
                label="Strain"
                size={80}
                strokeW={5}
                decimals={1}
                suffix=""
                delay={0.2}
                target={null}
                getColor={(s) => s <= 7 ? '#00D46A' : s <= 14 ? '#FFCC00' : '#EF4444'}
              />
            </div>
          </div>

          {/* HRV / Resting HR / Calories row */}
          <div className="grid grid-cols-3 gap-2" style={{ marginTop: 8 }}>
            <StatMiniCard label="HRV" delay={0.1} icon={<Zap size={14} color="#00D46A" />}>
              <div className="text-[18px] font-bold text-white">
                <AnimatedNumber value={whoopMetrics.hrv != null ? Math.round(whoopMetrics.hrv) : null} decimals={0} suffix="" />
              </div>
              <div className="text-[10px] text-[#555]">ms</div>
            </StatMiniCard>

            <StatMiniCard label="Resting HR" delay={0.15} icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            }>
              <div className="text-[18px] font-bold text-white">
                <AnimatedNumber value={whoopMetrics.restingHR} decimals={0} suffix="" />
              </div>
              <div className="text-[10px] text-[#555]">bpm</div>
            </StatMiniCard>

            <StatMiniCard label="Calories" delay={0.2} icon={<Flame size={14} color="#F97316" />}>
              <div className="text-[18px] font-bold text-white">
                <AnimatedNumber value={whoopMetrics.calories} decimals={0} />
              </div>
              <div className="text-[10px] text-[#555]">kcal</div>
            </StatMiniCard>
          </div>

        </motion.div>
      ) : connected ? null : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
        >
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="text-[13px] text-[#666]">Connect Whoop for recovery & strain insights</div>
            <button
              onClick={connect}
              className="text-[13px] font-semibold text-accent-blue"
            >
              Connect Whoop
            </button>
          </div>
        </motion.div>
      )}
      </div>

      {/* WHOOP AUTO-LOG PROMPTS */}
      <div style={{marginTop:"12px"}}>
      <WhoopAutoLog />
      </div>

      {/* RECENT WHOOP ACTIVITIES */}
      {connected && whoopWorkouts?.length > 0 && (<div style={{marginTop:"12px"}}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
        >
          <div className="relative mb-4">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold text-center">Recent Activities</h2>
            <button onClick={() => onNavigate('stats')} className="text-[11px] text-accent-blue font-medium absolute right-0 top-0">View All</button>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {whoopWorkouts.slice(-5).reverse().map((w, i) => {
              const strain = w.score?.strain;
              const avgHR = w.score?.average_heart_rate;
              const duration = formatDuration(w.start, w.end);
              const color = getSportColor(w.sport_id);
              const SportIcon = getSportIcon(w.sport_id, w);
              return (
                <div key={i} className="flex items-center gap-3.5 py-5 first:pt-0 last:pb-0">
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
      </div>)}

      {/* STATS ROW */}
      <div style={{marginTop:"12px"}}>
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
      </div>

      {/* WEEKLY COMPLIANCE RING */}
      <div style={{marginTop:"12px"}}>
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

    </div>
  );
}
