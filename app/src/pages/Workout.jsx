import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, ChevronLeft, Sparkles, Moon, ArrowLeft, ChevronRight, Clock, RefreshCw, Battery, Activity, Heart, Zap, Dumbbell, Bike, Route, Footprints, Waves } from 'lucide-react';
import { addDays, startOfWeek } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { getRecoverySuggestion, getZoneColor } from '../utils/recoveryAdvisor';
import { OPERATOR_LOADING, OPERATOR_LIFTS, ACCESSORIES, WEEKLY_TEMPLATE } from '../data/training';
import { BIKE_PRESETS, BIKE_ENDURANCE_PRESETS, RUN_PRESETS, RUN_ENDURANCE_PRESETS, SWIM_PRESETS, getCardioForWeek } from '../data/cardio';
import { HIC_PRESETS, HIC_INPUT_FIELDS, DEFAULT_HIC_FIELDS, getRecommendedHics } from '../data/hic';
import { getStrainCorrelation, getExpectedStrain } from '../utils/strainCorrelation';
import GlowBorder from '../components/GlowBorder';

function roundToFive(n) {
  return Math.round(n / 5) * 5;
}

function Sparkline({ data }) {
  if (!data || data.length < 2) return null;
  const w = 60, h = 20, pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const trend = data[data.length - 1] - data[0];
  const color = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#64748b';
  return (
    <svg width={w} height={h} className="inline-block ml-2">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getCardioPresetsForWorkout(workout, week) {
  if (workout.type === 'tri') {
    if (workout.name.includes('Run')) {
      const preset = getCardioForWeek(RUN_PRESETS, week);
      return { modality: 'Run', presets: preset ? [preset] : [RUN_PRESETS[0]] };
    }
    const swimPreset = getCardioForWeek(SWIM_PRESETS, week);
    const bikePreset = getCardioForWeek(BIKE_PRESETS, week);
    return {
      modality: 'Swim / Bike',
      presets: [swimPreset || SWIM_PRESETS[0], bikePreset || BIKE_PRESETS[0]].filter(Boolean),
    };
  }
  if (workout.type === 'long') {
    const bikePreset = getCardioForWeek(BIKE_ENDURANCE_PRESETS, week);
    const runPreset = getCardioForWeek(RUN_ENDURANCE_PRESETS, week);
    return {
      modality: 'Endurance',
      presets: [bikePreset || BIKE_ENDURANCE_PRESETS[0], runPreset || RUN_ENDURANCE_PRESETS[0]].filter(Boolean),
    };
  }
  return null;
}

const ENERGY_LEVELS = [
  { key: 'ready', emoji: '\uD83D\uDD25', label: 'Ready', desc: 'Full intensity', color: '#10B981' },
  { key: 'good', emoji: '\uD83D\uDCAA', label: 'Good', desc: '85% intensity', color: '#3B82F6' },
  { key: 'low', emoji: '\uD83D\uDE10', label: 'Low', desc: 'Reduced volume', color: '#F59E0B' },
  { key: 'recovery', emoji: '\uD83E\uDD15', label: 'Recovery', desc: 'Active recovery', color: '#EF4444' },
];

function EnergyModal({ onSelect, onClose, whoopRecovery }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-dark-800 rounded-t-3xl p-6 pb-10 border-t border-white/[0.05]"
      >
        <div className="w-10 h-1 bg-[#333333] rounded-full mx-auto mb-6" />
        {whoopRecovery && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg border" style={{ backgroundColor: getZoneColor(whoopRecovery.zone) + '12', borderColor: getZoneColor(whoopRecovery.zone) + '25' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getZoneColor(whoopRecovery.zone) }} />
            <span className="text-xs" style={{ color: getZoneColor(whoopRecovery.zone) }}>
              Whoop: {whoopRecovery.score}% recovered
            </span>
          </div>
        )}
        <h2 className="text-2xl font-semibold text-white mb-1">How are you feeling?</h2>
        <p className="text-sm text-[#666666] mb-6">This adjusts your workout intensity</p>
        <div className="space-y-3">
          {ENERGY_LEVELS.map((level) => (
            <button
              key={level.key}
              onClick={() => onSelect(level.key)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-dark-600 border border-white/[0.03] hover:border-white/[0.12] transition-colors active:scale-[0.98]"
            >
              <span className="text-3xl">{level.emoji}</span>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold text-white">{level.label}</div>
                <div className="text-xs text-[#666666]">{level.desc}</div>
              </div>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: level.color }} />
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

const WORKOUT_TYPE_CONFIG = {
  strength: { icon: Dumbbell, color: '#F59E0B', label: 'Strength', bg: 'rgba(245, 158, 11, 0.10)' },
  tri: { icon: Activity, color: '#14B8A6', label: 'Cardio + HIC', bg: 'rgba(20, 184, 166, 0.10)' },
  long: { icon: Route, color: '#10B981', label: 'Endurance', bg: 'rgba(16, 185, 129, 0.10)' },
  rest: { icon: Moon, color: '#6B7280', label: 'Rest', bg: 'rgba(107, 114, 128, 0.10)' },
};

function getWorkoutIcon(workout) {
  const name = (workout.name || '').toLowerCase();
  if (workout.type === 'strength') return { icon: Dumbbell, color: '#F59E0B', label: 'Strength', bg: 'rgba(245, 158, 11, 0.10)' };
  if (workout.type === 'rest') return { icon: Moon, color: '#6B7280', label: 'Rest', bg: 'rgba(107, 114, 128, 0.10)' };
  if (workout.type === 'long') return { icon: Route, color: '#10B981', label: 'Endurance', bg: 'rgba(16, 185, 129, 0.10)' };
  // Tri days — pick icon based on the specific cardio
  if (name.includes('run')) return { icon: Footprints, color: '#14B8A6', label: 'Run + HIC', bg: 'rgba(20, 184, 166, 0.10)' };
  if (name.includes('swim')) return { icon: Waves, color: '#14B8A6', label: 'Swim + HIC', bg: 'rgba(20, 184, 166, 0.10)' };
  if (name.includes('bike')) return { icon: Bike, color: '#14B8A6', label: 'Bike + HIC', bg: 'rgba(20, 184, 166, 0.10)' };
  // Default tri
  return { icon: Activity, color: '#14B8A6', label: 'Cardio + HIC', bg: 'rgba(20, 184, 166, 0.10)' };
}

function UpcomingWorkoutCard({ date, workout, settings, isExpanded, onToggle }) {
  const loadingInfo = OPERATOR_LOADING.find((l) => l.week === settings.week) || OPERATOR_LOADING[0];
  const config = getWorkoutIcon(workout);
  const TypeIcon = config.icon;
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const cardioInfo = workout.type !== 'strength' && workout.type !== 'rest' ? getCardioPresetsForWorkout(workout, settings.week) : null;

  return (
    <motion.div
      layout
      className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden"
    >
      {/* Compact header — always visible, tappable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 p-4 active:bg-white/[0.03] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: config.bg }}>
          <TypeIcon size={20} color={config.color} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[14px] font-semibold text-white">{dateLabel}</div>
          <div className="text-[12px] text-[#888888]">{config.label}</div>
        </div>
        <ChevronDown
          size={16}
          className={`text-[#555555] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              <div className="border-t border-white/[0.06] pt-3.5">
                <div className="text-[13px] text-[#A0A0A0] font-medium mb-3">{workout.name}</div>

                {/* Strength details */}
                {workout.type === 'strength' && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-[#666666] mb-1.5">
                      Wk {settings.week}: {loadingInfo.sets}×{loadingInfo.reps} @ {loadingInfo.percentage}%
                    </div>
                    {OPERATOR_LIFTS.map((lift) => {
                      const weight = Math.round(settings[lift.settingsKey] * (loadingInfo.percentage / 100));
                      return (
                        <div key={lift.name} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                          <span className="text-[12px] text-[#B3B3B3]">{lift.name}</span>
                          <span className="text-[12px] text-[#666666]">{weight} lbs</span>
                        </div>
                      );
                    })}
                    {workout.accessories && (
                      <div className="mt-2.5 pt-2.5 border-t border-white/[0.05]">
                        <div className="text-[10px] text-[#666666] mb-1.5">Accessories {workout.accessories}</div>
                        {(ACCESSORIES[workout.accessories] || []).map((acc, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1">
                            <span className="text-[11px] text-[#B3B3B3]">{acc.name}</span>
                            <span className="text-[11px] text-[#666666]">{acc.sets}×{acc.reps}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cardio / Tri details */}
                {cardioInfo && (
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase text-[#666666]">{cardioInfo.modality}</div>
                    {cardioInfo.presets.map((preset, idx) => (
                      <div key={idx} className="bg-white/[0.03] rounded-lg px-3 py-2">
                        <div className="text-[12px] font-medium text-[#B3B3B3]">{preset.name}{preset.week ? ` (Wk ${preset.week})` : ''}</div>
                        <div className="text-[11px] text-[#888888] mt-0.5">{preset.time}{preset.distance ? ` / ${preset.distance}` : ''}</div>
                      </div>
                    ))}
                    {workout.type === 'tri' && (
                      <div className="mt-2.5 pt-2.5 border-t border-white/[0.05]">
                        <div className="text-[10px] uppercase text-[#666666] mb-1.5">HIC Options</div>
                        {HIC_PRESETS.slice(0, 3).map((hic, idx) => (
                          <div key={idx} className="py-1">
                            <div className="text-[11px] text-[#B3B3B3] font-medium">{hic.name} <span className="text-[#666666]">{hic.time}</span></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rest day */}
                {workout.type === 'rest' && (
                  <div className="text-[12px] text-[#666666]">Recovery day — rest, stretch, and prepare for tomorrow.</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import { getSwappedWorkoutForDate, formatDateKey } from '../utils/workout';
import RestTimer from '../components/RestTimer';

const RECOVERY_ITEMS = [
  { id: 'foam-rolling', duration: '10 min', label: 'Foam rolling (full body)' },
  { id: 'mobility', duration: '15 min', label: 'Mobility flow (hips, shoulders, thoracic spine)' },
  { id: 'easy-cardio', duration: '20 min', label: 'Easy walk or bike (Zone 1-2, conversational pace)' },
  { id: 'stretching', duration: '5 min', label: 'Stretching cooldown' },
];

const typeBadgeStyles = {
  strength: 'bg-amber-500/15 text-amber-400',
  tri: 'bg-teal-500/15 text-teal-400',
  long: 'bg-emerald-500/15 text-emerald-400',
  rest: 'bg-gray-500/15 text-gray-400',
};

const TYPE_COLORS_CAL = {
  rest: '#E63946',
  strength: '#F59E0B',
  tri: '#14B8A6',
  long: '#10B981',
};

function MiniCalendar({ selectedDate, onSelectDate, loggedDates, weekSwaps }) {
  const realToday = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = selectedDate || new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Sync view month when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setViewMonth({ year: selectedDate.getFullYear(), month: selectedDate.getMonth() });
    }
  }, [selectedDate?.getTime()]);

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const monthName = new Date(viewMonth.year, viewMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = useMemo(() => {
    const first = new Date(viewMonth.year, viewMonth.month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewMonth.year, viewMonth.month, d);
      date.setHours(0, 0, 0, 0);
      const isToday = date.getTime() === realToday.getTime();
      const isFuture = date.getTime() > realToday.getTime();
      const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
      const isLogged = loggedDates.has(date.toDateString());
      const workout = getSwappedWorkoutForDate(date, weekSwaps);
      cells.push({ date, day: d, isToday, isFuture, isSelected, isLogged, workout });
    }
    return cells;
  }, [viewMonth, realToday, selectedDate, loggedDates, weekSwaps]);

  const prevMonth = () => {
    setViewMonth(v => {
      const m = v.month - 1;
      return m < 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: m };
    });
  };
  const nextMonth = () => {
    const now = new Date();
    const maxMonth = now.getMonth();
    const maxYear = now.getFullYear();
    setViewMonth(v => {
      const m = v.month + 1;
      const next = m > 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: m };
      if (next.year > maxYear || (next.year === maxYear && next.month > maxMonth)) return v;
      return next;
    });
  };

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 text-[#666666] active:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="text-[13px] font-semibold text-white">{monthName}</span>
        <button onClick={nextMonth} className="p-1.5 text-[#666666] active:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {dayLabels.map((l, i) => (
          <div key={i} className="text-center text-[10px] text-[#555555] font-medium" style={{ paddingBottom: 4 }}>{l}</div>
        ))}
        {days.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const color = TYPE_COLORS_CAL[cell.workout.type] || '#666';
          return (
            <button
              key={cell.day}
              disabled={cell.isFuture}
              onClick={() => !cell.isFuture && onSelectDate(cell.date)}
              className="flex flex-col items-center justify-center transition-all active:scale-90"
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: '9999px',
                backgroundColor: cell.isSelected ? (color + '30') : 'transparent',
                border: cell.isSelected ? `2px solid ${color}` : cell.isToday ? '1.5px solid #444' : '1.5px solid transparent',
                opacity: cell.isFuture ? 0.25 : 1,
              }}
            >
              <span className="text-[12px] font-medium" style={{ color: cell.isSelected ? '#fff' : cell.isToday ? '#fff' : '#999', lineHeight: 1 }}>{cell.day}</span>
              {cell.isLogged && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: color, marginTop: 1 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Workout({ showToast, selectedDate: selectedDateProp, onSelectedDateChange }) {
  const { settings, workoutHistory, setWorkoutHistory, weekSwaps, setWeekSwaps, acceptedSuggestion, setAcceptedSuggestion } = useApp();
  const { connected: whoopConnected, latestRecovery, latestSleep, latestCycle, workouts: whoopWorkouts } = useWhoop();
  const [loggingMode, setLoggingMode] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [energyLevel, setEnergyLevel] = useState(null);
  const [selectedCardio, setSelectedCardio] = useState(null);
  const [cardioMetrics, setCardioMetrics] = useState({});
  const [selectedHic, setSelectedHic] = useState(null);
  const [skippedHic, setSkippedHic] = useState(false);
  const [liftData, setLiftData] = useState({});
  const [completedSets, setCompletedSets] = useState({});
  const [completedAccessorySets, setCompletedAccessorySets] = useState({});
  const [accessoryData, setAccessoryData] = useState({});
  const [hicMetrics, setHicMetrics] = useState({});
  const [longNotes, setLongNotes] = useState('');
  const [showAllHics, setShowAllHics] = useState(true);
  const [showAllCardio, setShowAllCardio] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [expandedUpcoming, setExpandedUpcoming] = useState(null);
  const [cardioModality, setCardioModality] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [expandedLifts, setExpandedLifts] = useState({});
  const [durationMin, setDurationMin] = useState('');
  const [showSwapSheet, setShowSwapSheet] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [overrideSuggestion, setOverrideSuggestion] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef(null);
  const loggingStartRef = useRef(null);

  const realToday = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const today = useMemo(() => {
    if (!selectedDateProp) return realToday;
    const d = new Date(selectedDateProp);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDateProp, realToday]);
  const isViewingPast = today.getTime() < realToday.getTime();
  const isViewingToday = today.getTime() === realToday.getTime();
  const todayWorkout = useMemo(() => getSwappedWorkoutForDate(today, weekSwaps), [today, weekSwaps]);
  const loadingInfo = OPERATOR_LOADING.find((l) => l.week === settings.week) || OPERATOR_LOADING[0];

  // Whoop recovery context for informational display in EnergyModal
  const whoopRecoveryInfo = useMemo(() => {
    if (!whoopConnected || !latestRecovery) return null;
    const suggestion = getRecoverySuggestion({ latestRecovery, latestSleep, latestCycle, todayWorkout, workoutHistory, settings });
    return suggestion;
  }, [whoopConnected, latestRecovery, latestSleep, latestCycle, todayWorkout, workoutHistory, settings]);

  // Strain correlation
  const strainCorrelation = useMemo(() => {
    if (!whoopConnected || !whoopWorkouts?.length) return null;
    return getStrainCorrelation(workoutHistory, whoopWorkouts);
  }, [whoopConnected, whoopWorkouts, workoutHistory]);

  const expectedStrain = useMemo(() => {
    if (!strainCorrelation || !todayWorkout?.type) return null;
    return getExpectedStrain(todayWorkout.type, strainCorrelation);
  }, [strainCorrelation, todayWorkout?.type]);

  // Pre-set energy level from accepted Whoop suggestion
  useEffect(() => {
    if (acceptedSuggestion?.modifications?.suggestedEnergyLevel && !energyLevel) {
      setEnergyLevel(acceptedSuggestion.modifications.suggestedEnergyLevel);
    }
  }, [acceptedSuggestion]);

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map((e) => new Date(e.date).toDateString())),
    [workoutHistory]
  );

  const todayLogged = useMemo(
    () => loggedDates.has(today.toDateString()),
    [loggedDates, today]
  );

  const handleCalendarDateSelect = (date) => {
    if (onSelectedDateChange) onSelectedDateChange(date);
    // Reset logging state when changing dates
    setLoggingMode(false);
    setEnergyLevel(null);
    setSelectedCardio(null);
    setSelectedHic(null);
    setSkippedHic(false);
    setLiftData({});
    setCompletedSets({});
    setCompletedAccessorySets({});
    setAccessoryData({});
    setHicMetrics({});
    setCardioMetrics({});
    setLongNotes('');
    setDurationMin('');
  };

  const upcomingWorkouts = useMemo(() => {
    const upcoming = [];
    for (let i = 1; upcoming.length < 5; i++) {
      const date = addDays(today, i);
      const workout = getSwappedWorkoutForDate(date, weekSwaps);
      upcoming.push({ date, workout });
    }
    return upcoming;
  }, [today, weekSwaps]);

  useEffect(() => {
    if (loggingMode) {
      loggingStartRef.current = Date.now();
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - loggingStartRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [loggingMode]);

  useEffect(() => {
    if (todayWorkout.type === 'tri') {
      if (todayWorkout.name.includes('Run')) {
        setCardioModality('run');
      } else {
        const lastMod = getLastCardioModality();
        setCardioModality(lastMod === 'swim' ? 'bike' : 'swim');
      }
    } else if (todayWorkout.type === 'long') {
      setCardioModality('endurance-bike');
    }
  }, [todayWorkout.type, todayWorkout.name]);

  useEffect(() => {
    if (todayWorkout.type === 'strength' && todayWorkout.accessories) {
      const accs = ACCESSORIES[todayWorkout.accessories] || [];
      const prefill = {};
      let hasData = false;
      accs.forEach((acc) => {
        for (let i = workoutHistory.length - 1; i >= 0; i--) {
          const entry = workoutHistory[i];
          if (entry.details?.accessories) {
            const found = entry.details.accessories.find((a) => a.name === acc.name);
            if (found && found.weight) {
              prefill[`${acc.name}-weight`] = found.weight.toString();
              hasData = true;
              break;
            }
          }
        }
      });
      if (hasData) setAccessoryData((prev) => {
        const merged = { ...prefill };
        Object.keys(prev).forEach((k) => { if (prev[k]) merged[k] = prev[k]; });
        return merged;
      });
    }
  }, [todayWorkout.accessories]);

  function getLastCardioModality() {
    for (let i = workoutHistory.length - 1; i >= 0; i--) {
      const entry = workoutHistory[i];
      if (entry.type === 'tri' && entry.details?.cardio) {
        const name = entry.details.cardio.name;
        if (name.includes('Swim') || SWIM_PRESETS.some((p) => p.name === name)) return 'swim';
        if (name.includes('Bike') || BIKE_PRESETS.some((p) => p.name === name)) return 'bike';
      }
    }
    return null;
  }

  // Energy-adjusted weight
  const getWeightMultiplier = () => {
    if (energyLevel === 'good') return 0.85;
    if (energyLevel === 'low') return OPERATOR_LOADING[0].percentage / 100; // week 1 percentage
    return 1;
  };

  const activeSuggestion = (!overrideSuggestion && acceptedSuggestion) ? acceptedSuggestion : null;
  const showSuggestionCard = whoopRecoveryInfo && whoopRecoveryInfo.modifications?.type !== 'none' && !acceptedSuggestion && !dismissed && !todayLogged;

  const getTodayLiftWeight = (liftName) => {
    const lift = OPERATOR_LIFTS.find((l) => l.name === liftName);
    if (!lift) return 0;
    const base = Math.round(settings[lift.settingsKey] * (loadingInfo.percentage / 100));
    let weight = base;
    if (energyLevel && energyLevel !== 'ready') {
      weight = Math.round(base * getWeightMultiplier());
    }
    if (activeSuggestion?.modifications?.intensityMultiplier && activeSuggestion.modifications.intensityMultiplier < 1) {
      weight = roundToFive(weight * activeSuggestion.modifications.intensityMultiplier);
    }
    return weight;
  };

  const getProgrammedWeight = (liftName) => {
    const lift = OPERATOR_LIFTS.find((l) => l.name === liftName);
    if (!lift) return 0;
    return Math.round(settings[lift.settingsKey] * (loadingInfo.percentage / 100));
  };

  // For low energy: use only first 2 lifts
  const getActiveLifts = () => {
    if (energyLevel === 'low') return OPERATOR_LIFTS.slice(0, 2);
    return OPERATOR_LIFTS;
  };

  const getLastAccessoryData = (exerciseName) => {
    for (let i = workoutHistory.length - 1; i >= 0; i--) {
      const entry = workoutHistory[i];
      if (entry.details?.accessories) {
        const found = entry.details.accessories.find((a) => a.name === exerciseName);
        if (found) return found;
      }
    }
    return null;
  };

  const getCardioPresetsForModality = (showAll) => {
    let presets = [];
    if (cardioModality === 'swim') presets = SWIM_PRESETS;
    else if (cardioModality === 'bike') presets = BIKE_PRESETS;
    else if (cardioModality === 'run') presets = RUN_PRESETS;
    else if (cardioModality === 'endurance-bike') presets = BIKE_ENDURANCE_PRESETS;
    else if (cardioModality === 'endurance-run') presets = RUN_ENDURANCE_PRESETS;
    else return [];
    if (showAll) return presets;
    const weekPreset = getCardioForWeek(presets, settings.week);
    return weekPreset ? [weekPreset] : [presets[0]];
  };

  const getAvailableModalities = () => {
    if (todayWorkout.type === 'tri' && todayWorkout.name.includes('Run')) return [{ label: 'Run', value: 'run' }];
    if (todayWorkout.type === 'tri') return [{ label: 'Swim', value: 'swim' }, { label: 'Bike', value: 'bike' }];
    return [{ label: 'Endurance Bike', value: 'endurance-bike' }, { label: 'Z2 Run', value: 'endurance-run' }];
  };

  const liftSparklines = useMemo(() => {
    const byLift = {};
    workoutHistory
      .filter((e) => e.type === 'strength' && e.details?.lifts)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((entry) => {
        entry.details.lifts.forEach((lift) => {
          if (!byLift[lift.name]) byLift[lift.name] = [];
          byLift[lift.name].push(lift.weight);
        });
      });
    Object.keys(byLift).forEach((k) => { byLift[k] = byLift[k].slice(-8); });
    return byLift;
  }, [workoutHistory]);

  const recommendedHics = useMemo(() => getRecommendedHics(workoutHistory), [workoutHistory]);
  const hicFields = HIC_INPUT_FIELDS[selectedHic] || DEFAULT_HIC_FIELDS;

  const swapOptions = useMemo(() => {
    const dayOfWeek = today.getDay();
    const type = todayWorkout.type;
    const options = { optionA: null, optionB: null };
    if (type === 'strength') {
      const altDay = [1, 3, 5].find(d => d !== dayOfWeek);
      if (altDay !== undefined) {
        options.optionA = { day: altDay, workout: WEEKLY_TEMPLATE[altDay], description: 'Different accessory focus for today' };
      }
      const triDay = dayOfWeek === 4 ? 2 : 4;
      options.optionB = { day: triDay, workout: WEEKLY_TEMPLATE[triDay], description: 'Cardio + conditioning instead of lifting' };
    } else if (type === 'tri') {
      const altDay = [2, 4].find(d => d !== dayOfWeek);
      if (altDay !== undefined) {
        options.optionA = { day: altDay, workout: WEEKLY_TEMPLATE[altDay], description: 'Swap to the other tri modality' };
      }
      options.optionB = { day: 3, workout: WEEKLY_TEMPLATE[3], description: 'Strength session instead' };
    } else if (type === 'long') {
      options.optionB = { day: 2, workout: WEEKLY_TEMPLATE[2], description: 'Shorter tri session instead of long' };
    }
    return options;
  }, [today, todayWorkout.type]);

  const handleSwap = (targetDay) => {
    const ws = startOfWeek(today, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const dayOfWeek = today.getDay();
    setWeekSwaps((prev) => {
      const existing = prev[weekKey] || {};
      return { ...prev, [weekKey]: { ...existing, [dayOfWeek]: targetDay } };
    });
    setShowSwapSheet(false);
    showToast('Workout swapped for today!');
  };

  const handleLogWorkout = () => {
    if (acceptedSuggestion?.modifications?.suggestedEnergyLevel) {
      setEnergyLevel(acceptedSuggestion.modifications.suggestedEnergyLevel);
      setLoggingMode(true);
    } else {
      setShowEnergyModal(true);
    }
  };

  const handleEnergySelect = (level) => {
    setEnergyLevel(level);
    setShowEnergyModal(false);
    if (level === 'recovery') {
      // Show recovery mode - still enter logging but with recovery message
    }
    setLoggingMode(true);
  };

  // Use selected date for logging (noon to avoid timezone issues), or real now for today
  const getLogDate = () => {
    if (isViewingToday) return new Date().toISOString();
    const d = new Date(today);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  };

  const handleComplete = () => {
    if (todayWorkout.type === 'strength') {
      const activeLifts = getActiveLifts();
      const lifts = activeLifts.map((lift) => {
        const weight = parseInt(liftData[`${lift.name}-weight`]) || getTodayLiftWeight(lift.name);
        const reps = parseInt(liftData[`${lift.name}-reps`]) || loadingInfo.reps;
        let setsCompleted = 0;
        for (let i = 1; i <= loadingInfo.sets; i++) {
          if (completedSets[`${lift.name}-${i}`]) setsCompleted++;
        }
        return { name: lift.name, weight, reps, setsCompleted };
      });
      const accessories = (ACCESSORIES[todayWorkout.accessories] || []).map((acc) => {
        const weight = parseInt(accessoryData[`${acc.name}-weight`]) || 0;
        const reps = parseInt(accessoryData[`${acc.name}-reps`]) || acc.reps;
        let setsCompleted = 0;
        for (let i = 1; i <= acc.sets; i++) {
          if (completedAccessorySets[`${acc.name}-${i}`]) setsCompleted++;
        }
        return { name: acc.name, weight, reps, setsCompleted };
      });
      const dur = parseInt(durationMin) || (elapsedSeconds > 60 ? Math.round(elapsedSeconds / 60) : undefined);
      setWorkoutHistory((prev) => [...prev, {
        date: getLogDate(),
        workoutName: todayWorkout.name,
        type: 'strength',
        ...(dur ? { duration: dur } : {}),
        ...(energyLevel ? { energyLevel } : {}),
        details: { lifts, accessories, loading: { sets: loadingInfo.sets, reps: loadingInfo.reps, percentage: loadingInfo.percentage } },
      }]);
    } else if (todayWorkout.type === 'tri') {
      if (!selectedCardio) { showToast('Please select a cardio workout', 'error'); return; }
      if (!selectedHic && !skippedHic) { showToast('Please select an HIC or skip it', 'error'); return; }
      const durTri = parseInt(durationMin) || (elapsedSeconds > 60 ? Math.round(elapsedSeconds / 60) : undefined);
      setWorkoutHistory((prev) => [...prev, {
        date: getLogDate(),
        workoutName: todayWorkout.name,
        type: 'tri',
        ...(durTri ? { duration: durTri } : {}),
        ...(energyLevel ? { energyLevel } : {}),
        details: {
          cardio: { name: selectedCardio, metrics: { ...cardioMetrics } },
          hic: skippedHic ? { name: 'Skipped', skipped: true } : { name: selectedHic, metrics: { ...hicMetrics } },
        },
      }]);
    } else if (todayWorkout.type === 'long') {
      if (!selectedCardio) { showToast('Please select a cardio workout', 'error'); return; }
      const durLong = parseInt(durationMin) || (elapsedSeconds > 60 ? Math.round(elapsedSeconds / 60) : undefined);
      setWorkoutHistory((prev) => [...prev, {
        date: getLogDate(),
        workoutName: todayWorkout.name,
        type: 'long',
        ...(durLong ? { duration: durLong } : {}),
        ...(energyLevel ? { energyLevel } : {}),
        details: { cardio: { name: selectedCardio, metrics: { ...cardioMetrics } }, notes: longNotes },
      }]);
    }
    setShowCelebration(true);
    setLoggingMode(false);
    showToast('Workout logged!');
    setTimeout(() => setShowCelebration(false), 2500);
  };

  const handleCompleteRecovery = () => {
    const dur = parseInt(durationMin) || (elapsedSeconds > 60 ? Math.round(elapsedSeconds / 60) : 50);
    setWorkoutHistory((prev) => [...prev, {
      date: getLogDate(),
      workoutName: 'Recovery Session',
      type: 'recovery',
      duration: dur,
      energyLevel: 'recovery',
      details: { items: RECOVERY_ITEMS.map(item => ({ name: item.label, completed: !!recoveryChecked[item.id] })) },
    }]);
    setShowCelebration(true);
    setLoggingMode(false);
    showToast('Recovery session logged!');
    setTimeout(() => setShowCelebration(false), 2500);
  };

  const energyBadge = energyLevel ? ENERGY_LEVELS.find(e => e.key === energyLevel) : null;

  // REST DAY
  if (todayWorkout.type === 'rest') {
    return (
      <div className="px-5 pt-4 pb-32 min-h-screen bg-black">
        <MiniCalendar selectedDate={today} onSelectDate={handleCalendarDateSelect} loggedDates={loggedDates} weekSwaps={weekSwaps} />
        {isViewingPast && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5" style={{ marginTop: 12 }}>
            <Clock size={14} className="text-amber-400" />
            <span className="text-[13px] text-amber-400">
              Viewing {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
            <button onClick={() => onSelectedDateChange(null)} className="ml-auto text-[12px] text-amber-400 font-medium active:opacity-70">
              Back to Today
            </button>
          </div>
        )}
        <div style={{ marginTop: 12 }} />
        <GlowBorder color="#E63946" speed={5} radius={16}>
          <div className="bg-[#141414] rounded-2xl text-center py-8 px-10">
            <Moon size={48} className="text-[#333333] mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">Rest Day</h2>
            <p className="text-sm text-[#666666]">Take time to recover and prepare for tomorrow.</p>
          </div>
        </GlowBorder>

        <div style={{marginTop:"12px"}}>
          <h3 className="text-xs font-semibold text-[#555555] uppercase tracking-widest mb-6">Upcoming</h3>
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
            {upcomingWorkouts.slice(0, showAllUpcoming ? 5 : 3).map(({ date, workout }, idx) => (
              <UpcomingWorkoutCard
                key={idx}
                date={date}
                workout={workout}
                settings={settings}
                isExpanded={expandedUpcoming === `rest-${idx}`}
                onToggle={() => setExpandedUpcoming(expandedUpcoming === `rest-${idx}` ? null : `rest-${idx}`)}
              />
            ))}
          </div>
          {upcomingWorkouts.length > 3 && (
            <button
              onClick={() => setShowAllUpcoming(!showAllUpcoming)}
              className="w-full mt-3 py-2.5 flex items-center justify-center gap-1.5 text-[12px] text-[#666666] hover:text-accent-blue transition-colors"
            >
              {showAllUpcoming ? 'Show Less' : `Show ${upcomingWorkouts.length - 3} More`}
              <ChevronDown size={14} className={`transition-transform ${showAllUpcoming ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // OVERVIEW MODE
  if (!loggingMode) {
    return (
      <div className="px-5 pt-4 pb-32 min-h-screen bg-black space-y-10">
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <div className="text-center">
                <Sparkles size={64} className="text-amber-400 mx-auto mb-4 animate-pulse" />
                <h2 className="text-3xl font-bold text-white mb-2">Workout Complete!</h2>
                <p className="text-[#666666]">Great work today.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEnergyModal && (
            <EnergyModal onSelect={handleEnergySelect} onClose={() => setShowEnergyModal(false)} whoopRecovery={!acceptedSuggestion ? whoopRecoveryInfo : null} />
          )}
        </AnimatePresence>

        {/* CALENDAR */}
        <MiniCalendar selectedDate={today} onSelectDate={handleCalendarDateSelect} loggedDates={loggedDates} weekSwaps={weekSwaps} />

        {/* Past date indicator */}
        {isViewingPast && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
            <Clock size={14} className="text-amber-400" />
            <span className="text-[13px] text-amber-400">
              Viewing {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
            <button onClick={() => onSelectedDateChange(null)} className="ml-auto text-[12px] text-amber-400 font-medium active:opacity-70">
              Back to Today
            </button>
          </div>
        )}

        {/* RECOVERY SECTION */}
        {whoopConnected && whoopRecoveryInfo && (
          <div className="space-y-3">
            {/* Recovery metrics card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5"
              style={{ background: `linear-gradient(135deg, ${getZoneColor(whoopRecoveryInfo.zone)}0D 0%, #141414 60%)` }}
            >
              <div className="flex items-center gap-4">
                {/* Compact recovery arc */}
                <div className="relative" style={{ width: 56, height: 56 }}>
                  <svg width={56} height={56} className="block">
                    {(() => {
                      const strokeWidth = 5;
                      const radius = (56 - strokeWidth) / 2;
                      const circumference = 2 * Math.PI * radius;
                      const arcFraction = 0.75;
                      const arcLength = circumference * arcFraction;
                      const filled = arcLength * (whoopRecoveryInfo.score / 100);
                      const rotation = 135;
                      return (
                        <>
                          <circle cx={28} cy={28} r={radius} fill="none" stroke="white" strokeOpacity={0.08} strokeWidth={strokeWidth} strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round" transform={`rotate(${rotation} 28 28)`} />
                          <circle cx={28} cy={28} r={radius} fill="none" stroke={getZoneColor(whoopRecoveryInfo.zone)} strokeWidth={strokeWidth} strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" transform={`rotate(${rotation} 28 28)`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
                        </>
                      );
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[17px] font-bold text-white leading-none">{whoopRecoveryInfo.score}</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-2">Recovery</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1.5">
                      <Activity size={13} className="text-[#666666]" />
                      <span className="text-[12px] text-[#A0A0A0]">HRV</span>
                      <span className="text-[12px] text-white font-semibold">{whoopRecoveryInfo.hrv != null ? (Math.round(whoopRecoveryInfo.hrv * 10) / 10).toFixed(1) : '--'} <span className="text-[#666666] font-normal">ms</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Moon size={13} className="text-[#666666]" />
                      <span className="text-[12px] text-[#A0A0A0]">Sleep</span>
                      <span className="text-[12px] text-white font-semibold">{whoopRecoveryInfo.sleepScore ?? '--'}<span className="text-[#666666] font-normal">%</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap size={13} className="text-[#666666]" />
                      <span className="text-[12px] text-[#A0A0A0]">Strain</span>
                      <span className="text-[12px] text-white font-semibold">{typeof whoopRecoveryInfo.strain === 'number' ? whoopRecoveryInfo.strain.toFixed(1) : '--'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Suggestion card */}
            <AnimatePresence>
              {showSuggestionCard && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="relative bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: getZoneColor(whoopRecoveryInfo.zone) }} />
                  <div className="p-4 pl-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Battery size={15} style={{ color: getZoneColor(whoopRecoveryInfo.zone) }} />
                      <span className="text-[14px] font-bold text-white">{whoopRecoveryInfo.headline}</span>
                    </div>
                    <p className="text-[13px] text-[#A0A0A0] mb-3 leading-relaxed">{whoopRecoveryInfo.suggestion}</p>
                    {whoopRecoveryInfo.modifications?.type === 'swap_to_recovery' && (
                      <p className="text-[12px] font-medium mb-3" style={{ color: getZoneColor(whoopRecoveryInfo.zone) }}>Swap to recovery session</p>
                    )}
                    {(whoopRecoveryInfo.modifications?.type === 'reduce_intensity' || whoopRecoveryInfo.modifications?.type === 'reduce_volume') && whoopRecoveryInfo.modifications?.intensityMultiplier && (
                      <p className="text-[12px] font-medium mb-3" style={{ color: getZoneColor(whoopRecoveryInfo.zone) }}>Reduce to {Math.round(whoopRecoveryInfo.modifications.intensityMultiplier * 100)}% intensity</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setAcceptedSuggestion(whoopRecoveryInfo)}
                        className="flex-1 text-[13px] font-semibold rounded-xl transition-colors active:scale-[0.98] min-h-[40px] text-white"
                        style={{ backgroundColor: getZoneColor(whoopRecoveryInfo.zone) }}
                      >
                        Accept Adjustment
                      </button>
                      <button
                        onClick={() => setDismissed(true)}
                        className="flex-1 text-[13px] font-semibold rounded-xl transition-colors active:scale-[0.98] min-h-[40px] text-[#A0A0A0] border border-white/[0.15] bg-transparent"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Accepted adjustment banner */}
            {acceptedSuggestion && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: getZoneColor(acceptedSuggestion.zone) + '15', borderColor: getZoneColor(acceptedSuggestion.zone) + '30', border: `1px solid ${getZoneColor(acceptedSuggestion.zone)}30` }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getZoneColor(acceptedSuggestion.zone) }} />
                <span className="text-[12px] text-[#B3B3B3]">
                  Adjusted for recovery ({acceptedSuggestion.score}%)
                </span>
              </div>
            )}

            {/* Strain insight */}
            {expectedStrain && todayWorkout.type !== 'rest' && (
              <div className="flex items-center gap-2 px-3 py-2">
                <Zap size={13} className="text-[#555555]" />
                <span className="text-[12px] text-[#888888]">
                  {todayWorkout.type === 'strength' ? 'Strength' : todayWorkout.type === 'tri' ? 'Cardio' : todayWorkout.type === 'long' ? 'Endurance' : todayWorkout.type.charAt(0).toUpperCase() + todayWorkout.type.slice(1)} days average <span className="text-white font-medium">{expectedStrain.toFixed(1)}</span> strain for you
                </span>
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {showSwapSheet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setShowSwapSheet(false)}
            >
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-dark-800 rounded-t-3xl p-6 pb-10 border-t border-white/[0.05]"
              >
                <div className="w-10 h-1 bg-[#333333] rounded-full mx-auto mb-6" />
                <h2 className="text-xl font-semibold text-white mb-1">Swap This Workout</h2>
                <p className="text-[15px] text-[#666666] mb-5">Choose an alternative for today</p>

                {swapOptions.optionA && (
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-[#666666] mb-2">Same Type, Different Focus</div>
                    <button
                      onClick={() => handleSwap(swapOptions.optionA.day)}
                      className="w-full text-left min-h-[52px] p-4 rounded-xl bg-dark-600 border border-white/[0.03] hover:border-white/[0.12] active:scale-[0.98] transition-all"
                    >
                      <div className="text-[15px] font-semibold text-white">{swapOptions.optionA.workout.name}</div>
                      <div className="text-[13px] text-[#666666] mt-0.5">{swapOptions.optionA.description}</div>
                    </button>
                  </div>
                )}

                {swapOptions.optionB && (
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-[#666666] mb-2">Different Modality</div>
                    <button
                      onClick={() => handleSwap(swapOptions.optionB.day)}
                      className="w-full text-left min-h-[52px] p-4 rounded-xl bg-dark-600 border border-white/[0.03] hover:border-white/[0.12] active:scale-[0.98] transition-all"
                    >
                      <div className="text-[15px] font-semibold text-white">{swapOptions.optionB.workout.name}</div>
                      <div className="text-[13px] text-[#666666] mt-0.5">{swapOptions.optionB.description}</div>
                    </button>
                  </div>
                )}

                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-widest text-[#666666] mb-2">Just Move</div>
                  <div className="min-h-[52px] p-4 rounded-xl bg-dark-600 border border-white/[0.03]">
                    <div className="space-y-2">
                      {['30-min walk outside', 'Pickup basketball', 'Yoga / stretching session', 'Swimming easy laps'].map((opt) => (
                        <div key={opt} className="text-[15px] text-[#B3B3B3]">\u2022 {opt}</div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowSwapSheet(false)}
                      className="w-full mt-3 py-2 text-[13px] text-[#666666] hover:text-white transition-colors"
                    >
                      Got it, just move today
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Today's Workout Card */}
        <GlowBorder
          color={todayWorkout.type === 'strength' ? '#F59E0B' : todayWorkout.type === 'tri' ? '#14B8A6' : todayWorkout.type === 'long' ? '#10B981' : '#6B7280'}
          speed={4}
          radius={16}
        >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative bg-[#141414] rounded-2xl p-6 pl-10 pr-10 overflow-hidden active:scale-[0.98] transition-transform`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] text-[#A0A0A0]">
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <div className="flex items-center gap-2">
              {expectedStrain && todayWorkout.type !== 'rest' && (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white/[0.06] text-[#888888]">
                  ~{expectedStrain.toFixed(1)} strain
                </span>
              )}
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${typeBadgeStyles[todayWorkout.type]}`}>
                {todayWorkout.type}
              </span>
            </div>
          </div>
          <h2 className="text-[22px] font-bold text-white mb-4">{todayWorkout.name}</h2>

          {todayLogged && (
            <div className="bg-emerald-950/30 border border-emerald-800/20 rounded-xl px-4 py-2 text-emerald-400 text-sm font-medium flex items-center gap-2 mb-3">
              <Check size={16} /> Already logged today
            </div>
          )}

          {/* Strength preview */}
          {todayWorkout.type === 'strength' && (
            <div className="space-y-3 mb-5">
              <div className="text-xs text-[#666666] mb-2">
                Week {settings.week}: {loadingInfo.sets}x{loadingInfo.reps} @ {loadingInfo.percentage}% | Rest {loadingInfo.restMin}-{loadingInfo.restMax}
              </div>
              <div className="space-y-2.5">
                {OPERATOR_LIFTS.map((lift) => {
                  const programmed = Math.round(settings[lift.settingsKey] * (loadingInfo.percentage / 100));
                  const hasAdjustment = activeSuggestion?.modifications?.intensityMultiplier && activeSuggestion.modifications.intensityMultiplier < 1;
                  const adjusted = hasAdjustment ? roundToFive(programmed * activeSuggestion.modifications.intensityMultiplier) : programmed;
                  return (
                    <div key={lift.name} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2.5">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-white">{lift.name}</span>
                        <Sparkline data={liftSparklines[lift.name]} />
                      </div>
                      <span className="text-sm text-[#B3B3B3]">
                        {hasAdjustment ? <>{programmed} <span className="text-[#555]">&rarr;</span> {adjusted} lbs</> : <>{programmed} lbs</>}
                        {' '}x {loadingInfo.sets}x{loadingInfo.reps}
                      </span>
                    </div>
                  );
                })}
              </div>
              {todayWorkout.accessories && (
                <div className="mt-6 pt-3 border-t border-white/[0.05]">
                  <div className="text-[10px] uppercase text-[#666666] mb-2">Accessories ({todayWorkout.accessories})</div>
                  <div className="divide-y divide-white/[0.05]">
                    {(ACCESSORIES[todayWorkout.accessories] || []).map((acc, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2">
                        <span className="text-xs text-[#B3B3B3]">{acc.name}</span>
                        <span className="text-xs text-[#666666]">{acc.sets}×{acc.reps}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tri preview */}
          {todayWorkout.type === 'tri' && (
            <div className="space-y-2 mb-5">
              <div className="text-sm text-[#B3B3B3]">
                {todayWorkout.name.includes('Run') ? 'Run session' : 'Swim or Bike session'} + HIC conditioning
              </div>
              {(() => {
                const recommended = recommendedHics.slice(0, 2);
                return recommended.length > 0 && (
                  <div className="text-xs text-[#666666] mt-1.5">
                    Recommended HICs: {recommended.map(h => h.name).join(', ')}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Long preview */}
          {todayWorkout.type === 'long' && (
            <div className="mb-5">
              <div className="text-sm text-[#B3B3B3]">Endurance session - Bike or Run</div>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleLogWorkout}
              className="w-full min-h-[52px] rounded-2xl bg-accent-blue hover:bg-accent-blue/90 text-white font-semibold text-[17px] tracking-wide transition-colors flex items-center justify-center gap-2"
            >
              Log Workout
              <ChevronRight size={18} />
            </motion.button>
            {todayWorkout.type !== 'rest' && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowSwapSheet(true)}
                className="w-full min-h-[48px] rounded-2xl border border-white/[0.12] bg-transparent text-[#A0A0A0] font-medium text-[15px] tracking-wide transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} />
                Swap This Workout
              </motion.button>
            )}
          </div>
        </motion.div>
        </GlowBorder>

        {/* Upcoming Workouts */}
        <div style={{marginTop:"12px"}}>
          <h3 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-6">Upcoming</h3>
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
            {upcomingWorkouts.slice(0, showAllUpcoming ? 5 : 3).map(({ date, workout }, idx) => (
              <UpcomingWorkoutCard
                key={idx}
                date={date}
                workout={workout}
                settings={settings}
                isExpanded={expandedUpcoming === `main-${idx}`}
                onToggle={() => setExpandedUpcoming(expandedUpcoming === `main-${idx}` ? null : `main-${idx}`)}
              />
            ))}
          </div>
          {upcomingWorkouts.length > 3 && (
            <button
              onClick={() => setShowAllUpcoming(!showAllUpcoming)}
              className="w-full mt-3 py-2.5 flex items-center justify-center gap-1.5 text-[12px] text-[#666666] hover:text-accent-blue transition-colors"
            >
              {showAllUpcoming ? 'Show Less' : `Show ${upcomingWorkouts.length - 3} More`}
              <ChevronDown size={14} className={`transition-transform ${showAllUpcoming ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // LOGGING MODE
  return (
    <div className="px-5 pt-4 pb-32 min-h-screen bg-black space-y-10">
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="text-center">
              <Sparkles size={64} className="text-amber-400 mx-auto mb-4 animate-pulse" />
              <h2 className="text-3xl font-bold text-white mb-2">Workout Complete!</h2>
              <p className="text-[#666666]">Great work today.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-1">
        <button onClick={() => { setLoggingMode(false); setEnergyLevel(null); }} className="flex items-center gap-1.5 text-[#666666] hover:text-white transition-colors text-sm">
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="flex items-center gap-2">
          {energyBadge && (
            <span className="px-4 py-2 rounded-full bg-[#141414] border border-white/[0.10] text-[15px]" style={{ color: energyBadge.color }}>
              {energyBadge.emoji} {energyBadge.label}
            </span>
          )}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-dark-500 text-[#666666] text-xs">
            <Clock size={12} />
            <span className="tabular-nums">{Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}</span>
          </div>
          {todayWorkout.type === 'strength' && <RestTimer defaultSeconds={loadingInfo.restMin === '2 min' ? 120 : 180} />}
        </div>
      </div>

      <div>
        <p className="text-xs text-[#666666]">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        <h2 className="text-xl font-semibold text-white">{todayWorkout.name}</h2>
        {energyLevel && energyLevel !== 'ready' && (
          <p className="text-xs mt-1" style={{ color: energyBadge?.color }}>
            {energyLevel === 'good' && 'Adjusted to 85% intensity'}
            {energyLevel === 'low' && 'Reduced volume - 2 main lifts, week 1 loading'}
            {energyLevel === 'recovery' && 'Recovery mode - light mobility & cardio'}
          </p>
        )}
      </div>

      {activeSuggestion && whoopConnected && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl border" style={{ backgroundColor: getZoneColor(activeSuggestion.zone) + '15', borderColor: getZoneColor(activeSuggestion.zone) + '30' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getZoneColor(activeSuggestion.zone) }} />
            <span className="text-xs text-[#B3B3B3]">
              Recovery {activeSuggestion.score}%
              {activeSuggestion.modifications?.intensityMultiplier && (
                <> · Intensity at {Math.round(activeSuggestion.modifications.intensityMultiplier * 100)}%</>
              )}
            </span>
          </div>
          <button
            onClick={() => setOverrideSuggestion(true)}
            className="text-[11px] text-[#666] hover:text-white transition-colors ml-3 flex-shrink-0"
          >
            Override
          </button>
        </div>
      )}

      {todayLogged && (
        <div className="bg-emerald-950/30 border border-emerald-800/20 rounded-xl px-4 py-3 text-emerald-400 text-sm font-medium flex items-center gap-2">
          <Check size={16} /> Already logged today. Logging again will add another entry.
        </div>
      )}

      {/* RECOVERY MODE */}
      {energyLevel === 'recovery' && (
        <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[17px] font-semibold text-white">Recovery Session</h3>
            <span className="text-[13px] text-[#666666]">~50 min total</span>
          </div>
          <p className="text-[13px] text-[#666666] mb-4">Check off each item as you complete it</p>
          <div className="space-y-2">
            {RECOVERY_ITEMS.map((item) => {
              const checked = !!recoveryChecked[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => setRecoveryChecked((p) => ({ ...p, [item.id]: !p[item.id] }))}
                  className={`w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-sm transition-colors active:scale-[0.98] ${
                    checked ? 'bg-emerald-950/30 border border-emerald-800/20' : 'bg-dark-600 border border-white/[0.03]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-[#333333]'}`}>
                    {checked && <Check size={12} className="text-white" />}
                  </div>
                  <div className="text-left">
                    <div className={`text-sm font-medium ${checked ? 'text-emerald-400 line-through' : 'text-white'}`}>{item.label}</div>
                    <div className="text-xs text-[#666666]">{item.duration}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCompleteRecovery}
            className="w-full mt-4 min-h-[52px] rounded-2xl bg-accent-green hover:bg-accent-green/90 text-white font-semibold text-[17px] tracking-wide transition-colors"
          >
            Complete Recovery
          </motion.button>
        </div>
      )}

      {/* STRENGTH */}
      {todayWorkout.type === 'strength' && energyLevel !== 'recovery' && (
        <div className="space-y-3">
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5 text-center">
            <span className="text-[15px] text-[#A0A0A0]">Week {settings.week}: </span>
            <span className="text-[15px] font-semibold text-white">{loadingInfo.sets}×{loadingInfo.reps} @ {loadingInfo.percentage}%</span>
            <span className="text-[13px] text-[#666666] ml-2">· Rest {loadingInfo.restMin}–{loadingInfo.restMax}</span>
            {energyLevel === 'good' && <span className="text-[13px] text-accent-blue ml-2">(85%)</span>}
          </div>

          {getActiveLifts().map((lift) => {
            const weight = getTodayLiftWeight(lift.name);
            const programmed = getProgrammedWeight(lift.name);
            const hasAdjustment = activeSuggestion?.modifications?.intensityMultiplier && activeSuggestion.modifications.intensityMultiplier < 1 && weight !== programmed;
            return (
              <div key={lift.name} className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
                <h3 className="text-[17px] font-semibold text-white mb-1">{lift.name}</h3>
                <p className="text-[13px] text-[#666666] mb-4">
                  {loadingInfo.sets} × {loadingInfo.reps} @{' '}
                  {hasAdjustment ? <><span className="line-through">{programmed}</span> {weight} lbs</> : <>{weight} lbs</>}
                </p>
                {/* Set table */}
                <div>
                  <div className="flex items-center py-2 border-b border-white/[0.10] gap-3">
                    <div className="w-12 text-[12px] uppercase tracking-wider text-[#555555]">SET</div>
                    <div className="flex-1 text-[12px] uppercase tracking-wider text-[#555555] text-center">WEIGHT</div>
                    <div className="w-20 text-[12px] uppercase tracking-wider text-[#555555] text-center">REPS</div>
                    <div className="w-8 text-[12px] uppercase tracking-wider text-[#555555] text-center">✓</div>
                  </div>
                  {Array.from({ length: loadingInfo.sets }).map((_, i) => {
                    const key = `${lift.name}-${i + 1}`;
                    const done = completedSets[key];
                    return (
                      <div key={i} className="flex items-center py-3 min-h-[48px] gap-3">
                        <div className="w-12 text-[15px] text-[#666666]">{i + 1}</div>
                        <input type="number" placeholder={weight.toString()} value={liftData[`${lift.name}-weight`] || ''}
                          onChange={(e) => setLiftData((p) => ({ ...p, [`${lift.name}-weight`]: e.target.value }))}
                          className="flex-1 bg-[#1A1A1A] rounded-lg px-3 py-2.5 text-center text-[17px] text-white min-h-[44px] border-0 outline-none" />
                        <input type="number" placeholder={loadingInfo.reps.toString()} value={liftData[`${lift.name}-reps`] || ''}
                          onChange={(e) => setLiftData((p) => ({ ...p, [`${lift.name}-reps`]: e.target.value }))}
                          className="w-20 bg-[#1A1A1A] rounded-lg px-3 py-2.5 text-center text-[17px] text-white min-h-[44px] border-0 outline-none" />
                        <button onClick={() => setCompletedSets((p) => ({ ...p, [key]: !p[key] }))}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            done ? 'bg-emerald-500' : 'bg-[#1A1A1A] border border-white/[0.10]'
                          }`}>
                          {done && <Check size={14} className="text-white" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Accessories {todayWorkout.accessories}</h3>
            {(ACCESSORIES[todayWorkout.accessories] || []).map((acc, idx) => {
              const lastData = getLastAccessoryData(acc.name);
              const isExpanded = expandedLifts[acc.name] !== false;
              return (
                <div key={idx} className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
                  <button className="w-full flex items-center justify-between mb-1" onClick={() => setExpandedLifts((p) => ({ ...p, [acc.name]: !isExpanded }))}>
                    <div className="text-left">
                      <div className="text-[17px] font-semibold text-white">{acc.name}</div>
                      <div className="text-[13px] text-[#666666]">{acc.sets} × {acc.reps}{acc.category ? ` · ${acc.category}` : ''}{lastData ? ` · Last: ${lastData.weight || 0} lbs` : ''}</div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-[#666666]" /> : <ChevronDown size={16} className="text-[#666666]" />}
                  </button>
                  {isExpanded && (
                    <div className="mt-3">
                      {/* Set table */}
                      <div>
                        <div className="flex items-center py-2 border-b border-white/[0.10] gap-3">
                          <div className="w-12 text-[12px] uppercase tracking-wider text-[#555555]">SET</div>
                          <div className="flex-1 text-[12px] uppercase tracking-wider text-[#555555] text-center">WEIGHT</div>
                          <div className="w-20 text-[12px] uppercase tracking-wider text-[#555555] text-center">REPS</div>
                          <div className="w-8 text-[12px] uppercase tracking-wider text-[#555555] text-center">✓</div>
                        </div>
                        {Array.from({ length: acc.sets }).map((_, i) => {
                          const key = `${acc.name}-${i + 1}`;
                          const done = completedAccessorySets[key];
                          return (
                            <div key={i} className="flex items-center py-3 min-h-[48px] gap-3">
                              <div className="w-12 text-[15px] text-[#666666]">{i + 1}</div>
                              <input type="number" placeholder={lastData?.weight?.toString() || ''} value={accessoryData[`${acc.name}-weight`] || ''}
                                onChange={(e) => setAccessoryData((p) => ({ ...p, [`${acc.name}-weight`]: e.target.value }))}
                                className="flex-1 bg-[#1A1A1A] rounded-lg px-3 py-2.5 text-center text-[17px] text-white min-h-[44px] border-0 outline-none" />
                              <input type="number" placeholder={acc.reps.toString()} value={accessoryData[`${acc.name}-reps`] || ''}
                                onChange={(e) => setAccessoryData((p) => ({ ...p, [`${acc.name}-reps`]: e.target.value }))}
                                className="w-20 bg-[#1A1A1A] rounded-lg px-3 py-2.5 text-center text-[17px] text-white min-h-[44px] border-0 outline-none" />
                              <button onClick={() => setCompletedAccessorySets((p) => ({ ...p, [key]: !p[key] }))}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                  done ? 'bg-emerald-500' : 'bg-[#1A1A1A] border border-white/[0.10]'
                                }`}>
                                {done && <Check size={14} className="text-white" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TRI / LONG - Cardio Section */}
      {(todayWorkout.type === 'tri' || todayWorkout.type === 'long') && energyLevel !== 'recovery' && (
        <div className="space-y-3">
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <h3 className="text-[17px] font-semibold text-white mb-3">Cardio Session</h3>
            {activeSuggestion?.modifications?.intensityMultiplier && activeSuggestion.modifications.intensityMultiplier < 1 && (
              <div className="mb-3 px-3 py-2.5 rounded-lg border" style={{ backgroundColor: getZoneColor(activeSuggestion.zone) + '10', borderColor: getZoneColor(activeSuggestion.zone) + '20' }}>
                <p className="text-xs" style={{ color: getZoneColor(activeSuggestion.zone) }}>
                  Zone 2 effort recommended — recovery at {activeSuggestion.score}%
                </p>
              </div>
            )}
            {energyLevel && energyLevel !== 'ready' && (
              <div className="mb-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-xs" style={{ color: energyBadge?.color }}>
                  {energyLevel === 'good' && '\uD83D\uDCAA Good Energy \u2014 Keep intensity moderate, Zone 2-3 effort'}
                  {energyLevel === 'low' && '\uD83D\uDE10 Low Energy \u2014 Scale distances to ~60%, or substitute with 30-min easy bike/walk'}
                </p>
              </div>
            )}
            {getAvailableModalities().length > 1 && (
              <div className="flex gap-1 mb-3 bg-dark-600 rounded-lg p-1">
                {getAvailableModalities().map((mod) => (
                  <button key={mod.value}
                    onClick={() => { setCardioModality(mod.value); setSelectedCardio(null); setCardioMetrics({}); }}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${
                      cardioModality === mod.value ? 'bg-accent-blue text-white' : 'text-[#666666]'
                    }`}>
                    {mod.label}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {getCardioPresetsForModality(showAllCardio).map((preset, idx) => (
                <button key={idx}
                  onClick={() => { setSelectedCardio(preset.name); setCardioMetrics({}); }}
                  className={`w-full text-left p-3 min-h-[44px] rounded-lg border transition-colors ${
                    selectedCardio === preset.name ? 'bg-accent-blue/10 border-accent-blue/30 text-white' : 'bg-dark-600 border-white/[0.03] text-[#B3B3B3]'
                  }`}>
                  <div className="font-medium text-sm">{preset.name}{preset.week ? ` (Wk ${preset.week})` : ''}</div>
                  <div className="text-[11px] text-[#666666] mt-0.5">{preset.time}{preset.distance ? ` / ${preset.distance}` : ''}</div>
                  <div className="text-xs text-[#B3B3B3] mt-2 whitespace-pre-line leading-relaxed">{preset.description}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowAllCardio(!showAllCardio)}
              className="w-full mt-2 py-2 text-xs text-[#666666] hover:text-accent-blue transition-colors">
              {showAllCardio ? 'Show This Week Only' : 'Show All Weeks'}
            </button>
          </div>

          {selectedCardio && (
            <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
              <h3 className="text-[17px] font-semibold text-white mb-4">{selectedCardio} - Log</h3>
              {(() => {
                const preset = getCardioPresetsForModality(true).find((p) => p.name === selectedCardio);
                return preset?.inputFields?.map((field, idx) => (
                  <div key={idx} className="mb-4">
                    <label className="text-[13px] text-[#666666] block mb-1">{field.label}</label>
                    <input type={field.type} placeholder={field.label} value={cardioMetrics[field.key] || ''}
                      onChange={(e) => setCardioMetrics((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full bg-[#1A1A1A] rounded-xl px-4 py-3 min-h-[48px] text-[17px] text-white border-0 outline-none" />
                  </div>
                ));
              })()}
            </div>
          )}

          {/* HIC Section - only for tri */}
          {todayWorkout.type === 'tri' && (
            <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[17px] font-semibold text-white">HIC</h3>
                <button
                  onClick={() => { setSkippedHic(!skippedHic); if (!skippedHic) { setSelectedHic(null); setHicMetrics({}); } }}
                  className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                    skippedHic ? 'bg-amber-600 border-amber-500 text-white' : 'border-[#333333] text-[#666666] hover:border-amber-600'
                  }`}>
                  {skippedHic ? 'HIC Skipped' : 'Skip HIC'}
                </button>
              </div>
              {skippedHic && <p className="text-center text-sm text-[#666666] italic py-4">HIC skipped for today</p>}
              {!skippedHic && (
                <div className="space-y-1.5">
                  {/* Recommended section */}
                  {recommendedHics.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-[#666666] mb-1">Recommended for you</p>
                      {recommendedHics.map((hic, idx) => (
                        <button key={`rec-${idx}`}
                          onClick={() => { setSelectedHic(hic.name); setSkippedHic(false); setHicMetrics({}); }}
                          className={`w-full text-left p-3 min-h-[44px] rounded-lg border transition-colors ${
                            selectedHic === hic.name ? 'bg-accent-blue/10 border-accent-blue/30' : 'bg-dark-600 border-white/[0.03]'
                          }`}>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/20 text-accent-blue uppercase">★</span>
                            <span className="font-medium text-sm text-white">{hic.name}</span>
                            <span className="text-[11px] text-[#666666] ml-auto">{hic.time}</span>
                          </div>
                          <div className="text-xs text-[#B3B3B3] mt-1">{hic.description}</div>
                        </button>
                      ))}
                      <div className="border-t border-white/[0.06] my-2" />
                      <p className="text-[10px] uppercase tracking-wider text-[#666666] mb-1">All HICs</p>
                    </>
                  )}
                  {/* Full HIC list — always visible */}
                  {HIC_PRESETS.filter(h => !recommendedHics.find(r => r.name === h.name)).map((hic, idx) => (
                    <button key={`all-${idx}`}
                      onClick={() => { setSelectedHic(hic.name); setSkippedHic(false); setHicMetrics({}); }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                        selectedHic === hic.name ? 'bg-accent-blue/10 border-accent-blue/30 text-white' : 'bg-dark-600 text-[#B3B3B3] border border-white/[0.03]'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{hic.name}</span>
                        <span className="text-[11px] text-[#666666]">{hic.time}</span>
                      </div>
                      <div className="text-[11px] text-[#555] mt-0.5">{hic.description}</div>
                    </button>
                  ))}
                </div>
              )}
              {!skippedHic && selectedHic && (
                <div className="mt-4 pt-4 border-t border-white/[0.10]">
                  <h4 className="text-[15px] font-semibold text-white mb-3">{selectedHic} - Log</h4>
                  {hicFields.map((field, idx) => (
                    <div key={idx} className="mb-4">
                      <label className="text-[13px] text-[#666666] block mb-1">{field.label}</label>
                      <input type={field.type} placeholder={field.label} value={hicMetrics[field.key] || ''}
                        onChange={(e) => setHicMetrics((p) => ({ ...p, [field.key]: e.target.value }))}
                        className="w-full bg-[#1A1A1A] rounded-xl px-4 py-3 min-h-[48px] text-[17px] text-white border-0 outline-none" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Long notes */}
          {todayWorkout.type === 'long' && (
            <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
              <label className="text-[13px] text-[#666666] block mb-1">Workout Notes</label>
              <textarea value={longNotes} onChange={(e) => setLongNotes(e.target.value)}
                placeholder="Describe your workout..."
                className="w-full bg-[#1A1A1A] rounded-xl px-4 py-3 text-[17px] text-white min-h-[100px] resize-y border-0 outline-none" />
            </div>
          )}
        </div>
      )}

      {energyLevel !== 'recovery' && (
        <>
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <label className="text-[13px] text-[#666666] block mb-1">Duration (minutes, optional)</label>
            <input type="number" placeholder={elapsedSeconds > 60 ? `~${Math.round(elapsedSeconds / 60)} min (auto)` : 'e.g. 45'}
              value={durationMin} onChange={(e) => setDurationMin(e.target.value)}
              className="w-full bg-[#1A1A1A] rounded-xl px-4 py-3 min-h-[48px] text-[17px] text-white border-0 outline-none" />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleComplete}
            className="w-full min-h-[52px] rounded-2xl bg-accent-green hover:bg-accent-green/90 text-white font-semibold text-[17px] tracking-wide transition-colors"
          >
            Complete Workout
          </motion.button>
        </>
      )}
    </div>
  );
}
