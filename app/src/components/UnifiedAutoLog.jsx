import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { useGarmin } from '../hooks/useGarmin';
import { getSwappedWorkoutForDate } from '../utils/workout';
import { getSportName, getSportIcon, getSportColor, formatDuration } from '../utils/whoopSports';
import { getGarminActivityName, getGarminActivityIcon, getGarminActivityColor, formatGarminDuration } from '../utils/garminSports';

/**
 * Unified auto-detection: Garmin as primary source, enriched with Whoop strain.
 * Falls back to Whoop-only when no Garmin data exists.
 */

// ─── Garmin activity categorization ─────────────────────────────────────────

const GARMIN_TYPE_CATEGORY = {
  running: 'running', trail_running: 'running', treadmill_running: 'running', track_running: 'running',
  cycling: 'cycling', indoor_cycling: 'cycling', mountain_biking: 'cycling',
  lap_swimming: 'swimming', open_water_swimming: 'swimming', pool_swimming: 'swimming', swimming: 'swimming',
  strength_training: 'strength', hiit: 'strength',
  rowing: 'rowing', indoor_rowing: 'rowing',
  hiking: 'endurance', walking: 'endurance',
  elliptical: 'endurance', stair_climbing: 'endurance',
  cardio: 'endurance',
};

function categorizeGarmin(activity) {
  const typeKey = activity?.activityType?.typeKey || '';
  if (GARMIN_TYPE_CATEGORY[typeKey]) return GARMIN_TYPE_CATEGORY[typeKey];
  const name = (activity?.activityName || '').toLowerCase();
  if (name.includes('run')) return 'running';
  if (name.includes('swim')) return 'swimming';
  if (name.includes('bike') || name.includes('cycling') || name.includes('spin')) return 'cycling';
  if (name.includes('row')) return 'rowing';
  if (name.includes('strength') || name.includes('weight') || name.includes('crossfit')) return 'strength';
  return 'unknown';
}

// ─── Whoop activity categorization (from WhoopAutoLog) ──────────────────────

const WHOOP_SPORT_CATEGORY = {
  0: 'running', 1: 'cycling', 33: 'swimming', 71: 'cycling',
  84: 'rowing', 47: 'rowing', 63: 'strength', 44: 'strength',
  39: 'strength', 96: 'endurance', 35: 'endurance',
};

function categorizeWhoop(activity) {
  if (WHOOP_SPORT_CATEGORY[activity.sport_id]) return WHOOP_SPORT_CATEGORY[activity.sport_id];
  const name = (activity.sport_name || '').toLowerCase();
  if (name.includes('run')) return 'running';
  if (name.includes('swim')) return 'swimming';
  if (name.includes('bike') || name.includes('cycling') || name.includes('spin')) return 'cycling';
  if (name.includes('row')) return 'rowing';
  if (name.includes('weight') || name.includes('strength') || name.includes('crossfit') || name.includes('functional')) return 'strength';
  if (name.includes('hike') || name.includes('triathlon')) return 'endurance';
  return 'unknown';
}

// ─── Time overlap matching ──────────────────────────────────────────────────

function parseGarminTime(activity) {
  if (!activity.startTimeLocal) return null;
  const start = new Date(activity.startTimeLocal.replace(' ', 'T'));
  const durationMs = (activity.duration || 0) * 1000;
  return { start, end: new Date(start.getTime() + durationMs) };
}

function parseWhoopTime(workout) {
  if (!workout.start || !workout.end) return null;
  return { start: new Date(workout.start), end: new Date(workout.end) };
}

function getOverlapMs(a, b) {
  const overlapStart = Math.max(a.start.getTime(), b.start.getTime());
  const overlapEnd = Math.min(a.end.getTime(), b.end.getTime());
  return Math.max(0, overlapEnd - overlapStart);
}

function findWhoopMatch(garminActivity, whoopWorkouts) {
  if (!whoopWorkouts?.length) return null;
  const gTime = parseGarminTime(garminActivity);
  if (!gTime) return null;
  const gDuration = gTime.end.getTime() - gTime.start.getTime();

  let bestMatch = null;
  let bestOverlap = 0;

  for (const whoop of whoopWorkouts) {
    const wTime = parseWhoopTime(whoop);
    if (!wTime) continue;
    const wDuration = wTime.end.getTime() - wTime.start.getTime();
    const overlap = getOverlapMs(gTime, wTime);
    const startDiffMs = Math.abs(gTime.start.getTime() - wTime.start.getTime());
    const closeStart = startDiffMs < 10 * 60 * 1000;
    const hasOverlap = overlap > 0 && (overlap / gDuration > 0.2 || overlap / wDuration > 0.2);

    if ((closeStart || hasOverlap) && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = whoop;
    }
  }
  return bestMatch;
}

// ─── Map activities to planned workout ──────────────────────────────────────

function mapGarminToWorkout(garminActivities, whoopWorkouts, planned) {
  const categorized = garminActivities.map(a => ({
    garmin: a,
    whoop: findWhoopMatch(a, whoopWorkouts),
    category: categorizeGarmin(a),
    durationMin: Math.round((a.duration || 0) / 60),
  }));

  const workoutName = (planned.name || '').toLowerCase();
  const mapped = [];
  const used = new Set();

  if (planned.type === 'tri') {
    const isRunDay = workoutName.includes('run');
    const isSwimBikeDay = workoutName.includes('swim') || workoutName.includes('bike');

    const cardioMatch = categorized.find(a => {
      if (isRunDay) return a.category === 'running';
      if (isSwimBikeDay) return a.category === 'swimming' || a.category === 'cycling';
      return ['running', 'swimming', 'cycling', 'rowing'].includes(a.category);
    });

    const hicMatch = categorized.find(a => {
      if (a === cardioMatch) return false;
      if (a.category === 'strength') return true;
      // High-intensity non-cardio activity
      if (['running', 'cycling', 'rowing'].includes(a.category) && a !== cardioMatch) return true;
      return false;
    });

    if (cardioMatch) {
      mapped.push({ ...cardioMatch, role: 'cardio', label: isRunDay ? 'Run' : isSwimBikeDay ? 'Swim/Bike' : 'Cardio' });
      used.add(cardioMatch);
    }
    if (hicMatch) {
      mapped.push({ ...hicMatch, role: 'hic', label: 'HIC' });
      used.add(hicMatch);
    }
  } else if (planned.type === 'strength') {
    const match = categorized.find(a => a.category === 'strength')
      || categorized[0]; // fallback to first
    if (match) {
      mapped.push({ ...match, role: 'full', label: planned.name });
      used.add(match);
    }
  } else if (planned.type === 'long') {
    const match = categorized.find(a => a.category === 'endurance')
      || categorized.find(a => ['running', 'cycling', 'swimming', 'rowing'].includes(a.category))
      || categorized[0];
    if (match) {
      mapped.push({ ...match, role: 'full', label: planned.name });
      used.add(match);
    }
  }

  // Fallback: if nothing matched the plan, use highest-duration activity
  if (mapped.length === 0 && categorized.length > 0) {
    const best = [...categorized].sort((a, b) => b.durationMin - a.durationMin)[0];
    mapped.push({ ...best, role: 'full', label: planned.name });
    used.add(best);
  }

  // Add remaining as extras
  for (const c of categorized) {
    if (!used.has(c)) {
      mapped.push({ ...c, role: 'extra', label: getGarminActivityName(c.garmin) });
    }
  }

  return mapped;
}

// ─── Whoop-only fallback mapping (from WhoopAutoLog) ────────────────────────

function mapWhoopOnlyToWorkout(whoopActivities, planned) {
  const categorized = whoopActivities.map(a => ({
    garmin: null,
    whoop: a,
    category: categorizeWhoop(a),
    durationMin: a.start && a.end ? Math.round((new Date(a.end) - new Date(a.start)) / 60000) : 0,
  }));

  const workoutName = (planned.name || '').toLowerCase();
  const mapped = [];
  const used = new Set();

  if (planned.type === 'tri') {
    const isRunDay = workoutName.includes('run');
    const isSwimBikeDay = workoutName.includes('swim') || workoutName.includes('bike');
    const cardioMatch = categorized.find(a => {
      if (isRunDay) return a.category === 'running';
      if (isSwimBikeDay) return a.category === 'swimming' || a.category === 'cycling';
      return ['running', 'swimming', 'cycling', 'rowing'].includes(a.category);
    });
    const hicMatch = categorized.find(a => {
      if (a === cardioMatch) return false;
      if (a.category === 'strength') return true;
      const strain = a.whoop?.score?.strain || 0;
      if (strain >= 5 && ['running', 'cycling', 'rowing'].includes(a.category)) return true;
      return false;
    });
    if (cardioMatch) { mapped.push({ ...cardioMatch, role: 'cardio', label: isRunDay ? 'Run' : isSwimBikeDay ? 'Swim/Bike' : 'Cardio' }); used.add(cardioMatch); }
    if (hicMatch) { mapped.push({ ...hicMatch, role: 'hic', label: 'HIC' }); used.add(hicMatch); }
  } else if (planned.type === 'strength') {
    const match = categorized.find(a => a.category === 'strength') || categorized[0];
    if (match) { mapped.push({ ...match, role: 'full', label: planned.name }); used.add(match); }
  } else if (planned.type === 'long') {
    const match = categorized.find(a => a.category === 'endurance')
      || categorized.find(a => ['running', 'cycling', 'swimming', 'rowing'].includes(a.category))
      || categorized[0];
    if (match) { mapped.push({ ...match, role: 'full', label: planned.name }); used.add(match); }
  }

  if (mapped.length === 0 && categorized.length > 0) {
    const best = categorized[0];
    mapped.push({ ...best, role: 'full', label: planned.name });
    used.add(best);
  }

  for (const c of categorized) {
    if (!used.has(c)) {
      const name = getSportName(c.whoop.sport_id, c.whoop);
      mapped.push({ ...c, role: 'extra', label: name });
    }
  }

  return mapped;
}

// ─── localStorage persistence ───────────────────────────────────────────────

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

const _confirmedDates = loadSet('unifiedAutoLog_confirmed');
const _dismissedDates = loadSet('unifiedAutoLog_dismissed');

// ─── Component ──────────────────────────────────────────────────────────────

export default function UnifiedAutoLog() {
  const { workoutHistory, addWorkout, setWorkoutHistory, weekSwaps } = useApp();
  const { connected: whoopConnected, workouts: whoopWorkouts } = useWhoop();
  const { connected: garminConnected, activities: garminActivities } = useGarmin();
  const [, forceUpdate] = useState(0);

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map(e => new Date(e.date).toDateString())),
    [workoutHistory]
  );

  const loggedByDate = useMemo(() => {
    const map = {};
    for (const e of workoutHistory) {
      const dk = new Date(e.date).toDateString();
      if (!map[dk] || new Date(e.date) > new Date(map[dk].date)) map[dk] = e;
    }
    return map;
  }, [workoutHistory]);

  const pendingDayMatches = useMemo(() => {
    const hasGarmin = garminConnected && garminActivities?.length > 0;
    const hasWhoop = whoopConnected && whoopWorkouts?.length > 0;
    if (!hasGarmin && !hasWhoop) return [];

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Group Garmin activities by date
    const garminByDate = {};
    if (hasGarmin) {
      for (const activity of garminActivities) {
        const actDate = new Date(activity.startTimeLocal?.replace(' ', 'T') || activity.date);
        actDate.setHours(0, 0, 0, 0);
        if (actDate < sevenDaysAgo) continue;
        // Skip very short / low-effort activities
        const durationMin = Math.round((activity.duration || 0) / 60);
        if (durationMin < 10) continue;
        const dateKey = actDate.toDateString();
        if (!garminByDate[dateKey]) garminByDate[dateKey] = { date: actDate, activities: [] };
        garminByDate[dateKey].activities.push(activity);
      }
    }

    // Group Whoop activities by date (for Whoop-only fallback or enrichment)
    const whoopByDate = {};
    if (hasWhoop) {
      for (const activity of whoopWorkouts) {
        const actDate = new Date(activity.start || activity.date);
        actDate.setHours(0, 0, 0, 0);
        if (actDate < sevenDaysAgo) continue;
        const strain = activity.score?.strain || 0;
        if (strain < 3) continue;
        const dateKey = actDate.toDateString();
        if (!whoopByDate[dateKey]) whoopByDate[dateKey] = { date: actDate, activities: [] };
        whoopByDate[dateKey].activities.push(activity);
      }
    }

    // Merge dates: prefer Garmin, fall back to Whoop-only
    const allDates = new Set([...Object.keys(garminByDate), ...Object.keys(whoopByDate)]);
    const dayMatches = [];

    for (const dateKey of allDates) {
      if (_confirmedDates.has(dateKey) || _dismissedDates.has(dateKey)) continue;

      const existingEntry = loggedByDate[dateKey];
      const alreadyHasWhoop = existingEntry?.whoopActivity || existingEntry?.source === 'whoop';
      const alreadyHasGarmin = existingEntry?.source === 'garmin-auto' || existingEntry?.garminActivity;
      if (alreadyHasWhoop && alreadyHasGarmin) continue;
      if (alreadyHasWhoop && !garminByDate[dateKey]) continue;

      const isMerge = !!existingEntry;
      const garminDay = garminByDate[dateKey];
      const whoopDay = whoopByDate[dateKey];
      const date = garminDay?.date || whoopDay?.date;

      const planned = getSwappedWorkoutForDate(date, weekSwaps);
      const effectivePlanned = (!planned || planned.type === 'rest')
        ? { name: 'Extra Workout', type: 'extra' }
        : planned;

      let mapped;
      let useGarminSource = false;

      if (garminDay?.activities?.length > 0) {
        // Garmin primary — enrich with Whoop
        mapped = mapGarminToWorkout(garminDay.activities, whoopDay?.activities || [], effectivePlanned);
        useGarminSource = true;
      } else if (whoopDay?.activities?.length > 0) {
        // Whoop-only fallback
        mapped = mapWhoopOnlyToWorkout(whoopDay.activities, effectivePlanned);
      }

      if (!mapped || mapped.length === 0) continue;

      // Compute totals
      const totalStrain = mapped.reduce((sum, m) => sum + (m.whoop?.score?.strain || 0), 0);
      const totalDuration = mapped.reduce((sum, m) => sum + (m.durationMin || 0), 0);

      dayMatches.push({
        dateKey, date, planned, mapped, totalStrain, totalDuration,
        isMerge, existingEntry, useGarminSource,
        garminActivities: garminDay?.activities || [],
        whoopActivities: whoopDay?.activities || [],
      });
    }

    return dayMatches.sort((a, b) => b.date - a.date).slice(0, 3);
  }, [garminConnected, garminActivities, whoopConnected, whoopWorkouts, loggedDates, weekSwaps, loggedByDate]);

  const handleConfirm = useCallback((dayMatch) => {
    const { dateKey, date, planned, mapped, totalStrain, totalDuration, isMerge, existingEntry } = dayMatch;

    _confirmedDates.add(dateKey);
    saveSet('unifiedAutoLog_confirmed', _confirmedDates);
    forceUpdate(n => n + 1);

    // Build components from mapped activities
    const components = mapped.map(({ garmin, whoop, role, label }) => {
      const name = garmin ? getGarminActivityName(garmin) : getSportName(whoop?.sport_id, whoop);
      const strain = whoop?.score?.strain || 0;
      const avgHR = garmin?.averageHR || whoop?.score?.average_heart_rate || 0;
      const maxHR = garmin?.maxHR || whoop?.score?.max_heart_rate || 0;
      const calories = whoop?.score?.kilojoule
        ? Math.round(whoop.score.kilojoule * 0.239006)
        : garmin?.calories || 0;
      const duration = garmin
        ? Math.round((garmin.duration || 0) / 60)
        : (whoop?.start && whoop?.end ? Math.round((new Date(whoop.end) - new Date(whoop.start)) / 60000) : 0);

      return { role, label, sportName: name, strain, avgHR, maxHR, calories, duration };
    });

    // Build details for stats
    let details = { source: dayMatch.useGarminSource ? 'garmin-auto' : 'whoop-auto', note: `Auto-logged: ${components.map(c => `${c.label}: ${c.sportName}`).join(', ')}` };

    if (planned.type === 'tri' || planned.type === 'long') {
      const cardioMapped = mapped.find(m => m.role === 'cardio' || m.role === 'full');
      const hicMapped = mapped.find(m => m.role === 'hic');

      if (cardioMapped) {
        const g = cardioMapped.garmin;
        const w = cardioMapped.whoop;
        const cardioMetrics = {};
        if (g) {
          const distM = g.distance || 0;
          const dur = Math.round((g.duration || 0) / 60);
          if (distM > 0) {
            const distMi = distM * 0.000621371;
            cardioMetrics.distance = parseFloat(distMi.toFixed(2));
            if (dur > 0 && distMi > 0) cardioMetrics.avgPace = parseFloat((dur / distMi).toFixed(2));
          }
          if (dur) cardioMetrics.totalTime = String(dur);
          if (g.averageHR) cardioMetrics.avgHR = String(g.averageHR);
          if (g.maxHR) cardioMetrics.maxHR = String(g.maxHR);
        } else if (w) {
          if (w.score?.average_heart_rate) cardioMetrics.avgHR = String(w.score.average_heart_rate);
          if (w.score?.max_heart_rate) cardioMetrics.maxHR = String(w.score.max_heart_rate);
          const dur = w.start && w.end ? Math.round((new Date(w.end) - new Date(w.start)) / 60000) : null;
          if (dur) cardioMetrics.totalTime = String(dur);
        }
        const name = g ? getGarminActivityName(g) : getSportName(w?.sport_id, w);
        details.cardio = { name, metrics: cardioMetrics };
      }

      if (planned.type === 'tri' && hicMapped) {
        const g = hicMapped.garmin;
        const w = hicMapped.whoop;
        const dur = g ? Math.round((g.duration || 0) / 60) : (w?.start && w?.end ? Math.round((new Date(w.end) - new Date(w.start)) / 60000) : null);
        details.hic = {
          name: g ? getGarminActivityName(g) : getSportName(w?.sport_id, w),
          metrics: { totalTime: dur ? String(dur) : undefined },
        };
      } else if (planned.type === 'tri') {
        details.hic = { name: 'Skipped', skipped: true };
      }
    }

    const whoopData = totalStrain > 0 ? {
      sportName: components[0]?.sportName || 'Activity',
      strain: totalStrain,
      avgHR: components[0]?.avgHR,
      maxHR: Math.max(...components.map(c => c.maxHR || 0)) || undefined,
      calories: components.reduce((sum, c) => sum + (c.calories || 0), 0) || undefined,
      components,
    } : undefined;

    if (isMerge && existingEntry) {
      const merged = {
        ...existingEntry,
        source: dayMatch.useGarminSource ? 'garmin-auto' : 'whoop',
        ...(whoopData ? { whoopActivity: whoopData } : {}),
        ...(totalDuration && !existingEntry.duration ? { duration: totalDuration } : {}),
        details: {
          ...existingEntry.details,
          ...(details.cardio && !existingEntry.details?.cardio?.metrics?.avgHR ? { cardio: details.cardio } : {}),
          ...(details.hic && !existingEntry.details?.hic ? { hic: details.hic } : {}),
          autoLogNote: details.note,
        },
      };
      setWorkoutHistory(prev => prev.map(e => {
        if (e === existingEntry || (e.id && e.id === existingEntry.id)) return merged;
        if (!e.id && new Date(e.date).toDateString() === dateKey && e.workoutName === existingEntry.workoutName) return merged;
        return e;
      }));
    } else {
      addWorkout({
        id: `auto-${date.toISOString().split('T')[0]}-${Date.now()}`,
        date: date.toISOString(),
        workoutName: planned.name,
        type: planned.type,
        ...(totalDuration ? { duration: totalDuration } : {}),
        source: dayMatch.useGarminSource ? 'garmin-auto' : 'whoop',
        ...(whoopData ? { whoopActivity: whoopData } : {}),
        details,
      });
    }
  }, [addWorkout, setWorkoutHistory]);

  const handleDismiss = useCallback((dateKey) => {
    _dismissedDates.add(dateKey);
    saveSet('unifiedAutoLog_dismissed', _dismissedDates);
    forceUpdate(n => n + 1);
  }, []);

  if (!pendingDayMatches.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Detected Workouts</h2>

      <AnimatePresence mode="popLayout">
        {pendingDayMatches.map((dayMatch) => {
          const { dateKey, date, planned, mapped, totalStrain, totalDuration, useGarminSource } = dayMatch;
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
                    <div className="text-[12px] text-[#888888]">
                      {dateLabel}
                      {useGarminSource && <span className="ml-2 text-[10px] text-[#555]">via Garmin</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {totalStrain > 0 && <div className="text-[13px] font-semibold" style={{ color: accentColor }}>{totalStrain.toFixed(1)} strain</div>}
                    {totalDuration > 0 && <div className="text-[11px] text-[#666666]">{totalDuration}m total</div>}
                  </div>
                </div>

                <div className={`${isMultiPart ? 'space-y-2.5' : ''} mb-4`}>
                  {mapped.map(({ garmin, whoop, role, label }, idx) => {
                    // Use Garmin info if available, Whoop as fallback
                    const isGarmin = !!garmin;
                    const SportIcon = isGarmin ? getGarminActivityIcon(garmin) : getSportIcon(whoop?.sport_id, whoop);
                    const sportColor = isGarmin ? getGarminActivityColor(garmin) : getSportColor(whoop?.sport_id);
                    const sportName = isGarmin ? getGarminActivityName(garmin) : getSportName(whoop?.sport_id, whoop);
                    const strain = whoop?.score?.strain;
                    const duration = isGarmin
                      ? formatGarminDuration(garmin.duration)
                      : formatDuration(whoop?.start, whoop?.end);
                    const isExtra = role === 'extra';

                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: sportColor + '15' }}>
                          <SportIcon size={17} color={sportColor} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-white">{sportName}</span>
                            {isMultiPart && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase ${isExtra ? 'bg-purple-500/10 text-purple-400' : 'bg-white/[0.06] text-[#888888]'}`}>
                                {isExtra ? 'Extra' : label}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#666666]">
                            {duration !== '—' ? duration : ''}{strain != null && strain > 0 && <>{duration !== '—' ? ' · ' : ''}{strain.toFixed(1)} strain</>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[13px] text-[#A0A0A0] mb-4 leading-relaxed">
                  {dayMatch.isMerge
                    ? <>Add {useGarminSource ? 'Garmin' : 'Whoop'} data to your logged <span className="text-white font-medium">{planned.name}</span>?</>
                    : mapped.length > 1
                    ? <>Detected <span className="text-white font-medium">{mapped.length} activities</span>{planned.type !== 'extra' ? <> for your <span className="text-white font-medium">{planned.name}</span></> : ''}. Log all?</>
                    : <>Was this your planned <span className="text-white font-medium">{planned.name}</span> workout?</>}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleConfirm(dayMatch)}
                    className="flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-[13px] font-semibold text-white transition-colors active:scale-[0.98]"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check size={16} /> {dayMatch.isMerge ? 'Merge Data' : 'Yes, Log It'}
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
