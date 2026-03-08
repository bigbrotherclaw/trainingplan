import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { getSwappedWorkoutForDate } from '../utils/workout';
import { getSportName, getSportIcon, getSportColor, formatDuration } from '../utils/whoopSports';

/**
 * Intelligently matches Whoop activities to planned workouts.
 * Groups all activities by date, then maps each to a component of the planned workout.
 */

// ─── Activity categorization ────────────────────────────────────────────────

const SPORT_CATEGORY = {
  0: 'running', 1: 'cycling', 33: 'swimming', 71: 'cycling',
  84: 'rowing', 47: 'rowing', 63: 'strength', 44: 'strength',
  39: 'strength', 96: 'endurance', 35: 'endurance',
};

function categorizeActivity(activity) {
  if (SPORT_CATEGORY[activity.sport_id]) return SPORT_CATEGORY[activity.sport_id];
  const name = (activity.sport_name || '').toLowerCase();
  if (name.includes('run')) return 'running';
  if (name.includes('swim')) return 'swimming';
  if (name.includes('bike') || name.includes('cycling') || name.includes('spin')) return 'cycling';
  if (name.includes('row')) return 'rowing';
  if (name.includes('weight') || name.includes('strength') || name.includes('crossfit') || name.includes('functional')) return 'strength';
  if (name.includes('hike') || name.includes('triathlon')) return 'endurance';
  return 'unknown';
}

function mapActivitiesToWorkout(activities, planned) {
  const categorized = activities.map(a => ({
    activity: a,
    category: categorizeActivity(a),
    strain: a.score?.strain || 0,
    durationMin: a.start && a.end ? Math.round((new Date(a.end) - new Date(a.start)) / 60000) : 0,
  }));

  const workoutName = (planned.name || '').toLowerCase();

  if (planned.type === 'tri') {
    const isRunDay = workoutName.includes('run');
    const isSwimBikeDay = workoutName.includes('swim') || workoutName.includes('bike');
    const cardioMatch = categorized.find(a => {
      if (isRunDay) return a.category === 'running';
      if (isSwimBikeDay) return a.category === 'swimming' || a.category === 'cycling';
      return ['running', 'swimming', 'cycling', 'rowing'].includes(a.category);
    });
    const hicMatch = categorized.find(a => {
      if (a.activity === cardioMatch?.activity) return false;
      if (a.category === 'strength') return true;
      if (a.strain >= 5 && ['running', 'cycling', 'rowing'].includes(a.category)) return true;
      return false;
    });
    const mapped = [];
    if (cardioMatch) mapped.push({ activity: cardioMatch.activity, role: 'cardio', label: isRunDay ? 'Run' : isSwimBikeDay ? 'Swim/Bike' : 'Cardio' });
    if (hicMatch) mapped.push({ activity: hicMatch.activity, role: 'hic', label: 'HIC' });
    if (mapped.length === 0 && categorized.length > 0) {
      const best = [...categorized].sort((a, b) => b.strain - a.strain)[0];
      mapped.push({ activity: best.activity, role: 'full', label: planned.name });
    }
    return mapped;
  }

  if (planned.type === 'strength') {
    const match = categorized.find(a => a.category === 'strength') || [...categorized].sort((a, b) => b.strain - a.strain)[0];
    return match ? [{ activity: match.activity, role: 'full', label: planned.name }] : [];
  }

  if (planned.type === 'long') {
    const match = categorized.find(a => a.category === 'endurance')
      || [...categorized].filter(a => ['running', 'cycling', 'swimming', 'rowing'].includes(a.category)).sort((a, b) => b.durationMin - a.durationMin)[0]
      || [...categorized].sort((a, b) => b.strain - a.strain)[0];
    return match ? [{ activity: match.activity, role: 'full', label: planned.name }] : [];
  }

  return [];
}

// ─── MODULE-LEVEL state + localStorage persistence ──────────────────────────
// Module-level Sets are immune to React rendering/batching/unmounts.
// We also persist to localStorage so they survive app reloads.
function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

const _confirmedDates = loadSet('whoopAutoLog_confirmed');
const _dismissedDates = loadSet('whoopAutoLog_dismissed');

export default function WhoopAutoLog() {
  const { workoutHistory, addWorkout, weekSwaps } = useApp();
  const { connected, workouts: whoopWorkouts } = useWhoop();
  const [, forceUpdate] = useState(0);

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map(e => new Date(e.date).toDateString())),
    [workoutHistory]
  );

  const pendingDayMatches = useMemo(() => {
    if (!connected || !whoopWorkouts?.length) return [];

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const byDate = {};
    for (const activity of whoopWorkouts) {
      const actDate = new Date(activity.start || activity.date);
      actDate.setHours(0, 0, 0, 0);
      if (actDate < sevenDaysAgo) continue;
      const strain = activity.score?.strain || 0;
      if (strain < 3) continue;
      const dateKey = actDate.toDateString();
      if (!byDate[dateKey]) byDate[dateKey] = { date: actDate, activities: [] };
      byDate[dateKey].activities.push(activity);
    }

    const dayMatches = [];
    for (const [dateKey, { date, activities }] of Object.entries(byDate)) {
      if (loggedDates.has(dateKey) || _confirmedDates.has(dateKey) || _dismissedDates.has(dateKey)) continue;

      const planned = getSwappedWorkoutForDate(date, weekSwaps);
      
      // If it's a rest day or no plan, still show the activity — user worked out anyway
      const effectivePlanned = (!planned || planned.type === 'rest')
        ? { name: 'Extra Workout', type: 'extra' }
        : planned;

      let mapped = mapActivitiesToWorkout(activities, effectivePlanned);
      // For unmatched activities (extra days or mismatched types), create a generic mapping
      if (mapped.length === 0) {
        const best = [...activities].sort((a, b) => (b.score?.strain || 0) - (a.score?.strain || 0))[0];
        if (best) mapped = [{ activity: best, role: 'full', label: effectivePlanned.name }];
      }
      if (mapped.length === 0) continue;

      const totalStrain = activities.reduce((sum, a) => sum + (a.score?.strain || 0), 0);
      const totalDuration = activities.reduce((sum, a) => {
        if (!a.start || !a.end) return sum;
        return sum + Math.round((new Date(a.end) - new Date(a.start)) / 60000);
      }, 0);

      dayMatches.push({ dateKey, date, planned, mapped, allActivities: activities, totalStrain, totalDuration });
    }

    return dayMatches.sort((a, b) => b.date - a.date).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, whoopWorkouts, loggedDates, weekSwaps, _confirmedDates.size, _dismissedDates.size]);

  const handleConfirm = useCallback((dayMatch) => {
    const { dateKey, date, planned, mapped, totalStrain, totalDuration } = dayMatch;

    // Mark as confirmed in module-level Set FIRST, then persist
    _confirmedDates.add(dateKey);
    saveSet('whoopAutoLog_confirmed', _confirmedDates);

    // Force React to re-render so the card disappears
    forceUpdate(n => n + 1);

    // Now save to workout history
    const components = mapped.map(({ activity, role, label }) => ({
      role, label,
      sportName: getSportName(activity.sport_id, activity),
      sportId: activity.sport_id,
      strain: activity.score?.strain,
      avgHR: activity.score?.average_heart_rate,
      maxHR: activity.score?.max_heart_rate,
      calories: activity.score?.kilojoule ? Math.round(activity.score.kilojoule * 0.239006) : undefined,
      duration: activity.start && activity.end ? Math.round((new Date(activity.end) - new Date(activity.start)) / 60000) : undefined,
    }));

    const primarySport = components[0]?.sportName || 'Activity';
    const allSports = components.map(c => `${c.label}: ${c.sportName}`).join(', ');

    addWorkout({
      id: `whoop-${date.toISOString().split('T')[0]}-${Date.now()}`,
      date: date.toISOString(),
      workoutName: planned.name,
      type: planned.type,
      ...(totalDuration ? { duration: totalDuration } : {}),
      source: 'whoop',
      whoopActivity: {
        sportName: primarySport,
        strain: totalStrain,
        avgHR: components[0]?.avgHR,
        maxHR: Math.max(...components.map(c => c.maxHR || 0)) || undefined,
        calories: components.reduce((sum, c) => sum + (c.calories || 0), 0) || undefined,
        components,
      },
      details: planned.type === 'strength'
        ? { source: 'whoop-auto', note: `Auto-logged from Whoop: ${allSports}` }
        : { cardio: { name: primarySport, metrics: {} }, source: 'whoop-auto', note: `Auto-logged from Whoop: ${allSports}` },
    });
  }, [addWorkout]);

  const handleDismiss = useCallback((dateKey) => {
    _dismissedDates.add(dateKey);
    saveSet('whoopAutoLog_dismissed', _dismissedDates);
    forceUpdate(n => n + 1);
  }, []);

  if (!pendingDayMatches.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Detected Workouts</h2>

      <AnimatePresence mode="popLayout">
        {pendingDayMatches.map((dayMatch) => {
          const { dateKey, date, planned, mapped, totalStrain, totalDuration } = dayMatch;
          const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const isMultiPart = mapped.length > 1;
          const accentColor = planned.type === 'strength' ? '#F59E0B'
            : planned.type === 'tri' ? '#14B8A6' : planned.type === 'long' ? '#10B981' : planned.type === 'extra' ? '#8B5CF6' : '#6B7280';

          return (
            <motion.div
              key={dateKey}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden"
            >
              <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[15px] font-semibold text-white">{planned.name}</div>
                    <div className="text-[12px] text-[#888888]">{dateLabel}</div>
                  </div>
                  <div className="text-right">
                    {totalStrain > 0 && <div className="text-[13px] font-semibold" style={{ color: accentColor }}>{totalStrain.toFixed(1)} strain</div>}
                    {totalDuration > 0 && <div className="text-[11px] text-[#666666]">{totalDuration}m total</div>}
                  </div>
                </div>

                <div className={`${isMultiPart ? 'space-y-2.5' : ''} mb-4`}>
                  {mapped.map(({ activity, role, label }, idx) => {
                    const SportIcon = getSportIcon(activity.sport_id, activity);
                    const sportColor = getSportColor(activity.sport_id);
                    const sportName = getSportName(activity.sport_id, activity);
                    const strain = activity.score?.strain;
                    const duration = formatDuration(activity.start, activity.end);
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: sportColor + '15' }}>
                          <SportIcon size={17} color={sportColor} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-white">{sportName}</span>
                            {isMultiPart && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.06] text-[#888888] uppercase">{label}</span>}
                          </div>
                          <div className="text-[11px] text-[#666666]">
                            {duration !== '—' ? duration : ''}{strain != null && <>{duration !== '—' ? ' · ' : ''}{strain.toFixed(1)} strain</>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[13px] text-[#A0A0A0] mb-4 leading-relaxed">
                  {isMultiPart
                    ? <>Detected <span className="text-white font-medium">{mapped.length} activities</span> matching your planned <span className="text-white font-medium">{planned.name}</span>. Log it?</>
                    : <>Was this your planned <span className="text-white font-medium">{planned.name}</span> workout?</>}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleConfirm(dayMatch)}
                    className="flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-[13px] font-semibold text-white transition-colors active:scale-[0.98]"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check size={16} /> Yes, Log It
                  </button>
                  <button
                    onClick={() => handleDismiss(dateKey)}
                    className="flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-[13px] font-semibold text-[#A0A0A0] border border-white/[0.12] bg-transparent transition-colors active:scale-[0.98]"
                  >
                    Not This
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
