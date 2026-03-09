import { getGarminActivityName, getGarminActivityColor } from './garminSports';

// ── Time overlap matching ──

function parseGarminTime(activity) {
  // startTimeLocal is "YYYY-MM-DD HH:MM:SS"
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

// ── Activity type helpers ──

const SWIM_TYPES = new Set([
  'lap_swimming', 'open_water_swimming', 'pool_swimming', 'swimming',
]);

const RUN_TYPES = new Set([
  'running', 'trail_running', 'treadmill_running', 'track_running',
]);

const CYCLE_TYPES = new Set([
  'cycling', 'indoor_cycling', 'mountain_biking',
]);

function getTypeKey(garminActivity) {
  return garminActivity?.activityType?.typeKey || '';
}

function isSwim(garminActivity) {
  return SWIM_TYPES.has(getTypeKey(garminActivity));
}

function isRun(garminActivity) {
  return RUN_TYPES.has(getTypeKey(garminActivity));
}

function isCycle(garminActivity) {
  return CYCLE_TYPES.has(getTypeKey(garminActivity));
}

// ── Merge multiple Whoop activities into one (when both map to same Garmin workout) ──

function mergeWhoopActivities(whoops) {
  if (whoops.length === 1) return whoops[0];
  // Pick the one with highest strain as primary, sum the metrics
  const primary = whoops.reduce((best, w) => (w.score?.strain || 0) > (best.score?.strain || 0) ? w : best, whoops[0]);
  return {
    ...primary,
    score: {
      ...primary.score,
      strain: whoops.reduce((s, w) => s + (w.score?.strain || 0), 0),
      average_heart_rate: Math.round(whoops.reduce((s, w) => s + (w.score?.average_heart_rate || 0), 0) / whoops.length),
      max_heart_rate: Math.max(...whoops.map(w => w.score?.max_heart_rate || 0)),
      kilojoule: whoops.reduce((s, w) => s + (w.score?.kilojoule || 0), 0),
    },
    _mergedCount: whoops.length,
  };
}

// ── Main merge function ──

export function mergeActivitiesForDate(garminActivities, whoopActivities, date) {
  const garminList = (garminActivities || []).slice();
  const whoopList = (whoopActivities || []).slice();
  const results = [];

  // Phase 1: Build overlap map — which Whoop activities overlap which Garmin activities
  // Allow one Whoop activity to overlap MULTIPLE Garmin activities (e.g. cycling+strength = one Whoop session)
  const garminToWhoops = new Map();   // garminIdx → Set<whoopIdx>
  const whoopToGarmins = new Map();   // whoopIdx → Set<garminIdx>
  const matchedWhoop = new Set();

  for (let gi = 0; gi < garminList.length; gi++) {
    const gTime = parseGarminTime(garminList[gi]);
    if (!gTime) continue;
    const gDuration = gTime.end.getTime() - gTime.start.getTime();

    for (let wi = 0; wi < whoopList.length; wi++) {
      const wTime = parseWhoopTime(whoopList[wi]);
      if (!wTime) continue;
      const wDuration = wTime.end.getTime() - wTime.start.getTime();

      const overlap = getOverlapMs(gTime, wTime);
      const startDiffMs = Math.abs(gTime.start.getTime() - wTime.start.getTime());
      const closeStart = startDiffMs < 10 * 60 * 1000;
      const hasOverlap = overlap > 0 && (overlap / gDuration > 0.2 || overlap / wDuration > 0.2);

      if (closeStart || hasOverlap) {
        if (!garminToWhoops.has(gi)) garminToWhoops.set(gi, new Set());
        garminToWhoops.get(gi).add(wi);
        if (!whoopToGarmins.has(wi)) whoopToGarmins.set(wi, new Set());
        whoopToGarmins.get(wi).add(gi);
      }
    }
  }

  // Phase 2: Identify shared Whoop sessions (one Whoop → multiple Garmin)
  // Group Garmin activities that share the same Whoop activity into "session groups"
  const sessionGroups = []; // array of { garminIndices: Set, whoopIndices: Set }
  const garminAssigned = new Set();

  for (let wi = 0; wi < whoopList.length; wi++) {
    const garmins = whoopToGarmins.get(wi);
    if (!garmins || garmins.size === 0) continue;

    // Find or create a session group that includes any of these garmin indices
    let existingGroup = null;
    for (const sg of sessionGroups) {
      for (const gi of garmins) {
        if (sg.garminIndices.has(gi)) { existingGroup = sg; break; }
      }
      if (existingGroup) break;
    }

    if (existingGroup) {
      existingGroup.whoopIndices.add(wi);
      for (const gi of garmins) existingGroup.garminIndices.add(gi);
    } else {
      sessionGroups.push({
        garminIndices: new Set(garmins),
        whoopIndices: new Set([wi]),
      });
    }
    matchedWhoop.add(wi);
  }

  // Phase 3: Build results
  for (const group of sessionGroups) {
    const garminItems = [...group.garminIndices].map(gi => garminList[gi]);
    const whoopItems = [...group.whoopIndices].map(wi => whoopList[wi]);
    const mergedWhoop = mergeWhoopActivities(whoopItems);

    // Is this Whoop session shared across multiple distinct Garmin activities?
    const isSharedSession = group.garminIndices.size > 1;
    const sharedSessionId = isSharedSession ? `session-${[...group.garminIndices].sort().join('-')}` : null;

    for (const garmin of garminItems) {
      garminAssigned.add(garminList.indexOf(garmin));
      const merged = buildMergedActivity(garmin, mergedWhoop);
      if (isSharedSession) {
        merged.sharedSessionId = sharedSessionId;
        merged.sharedSessionCount = group.garminIndices.size;
      }
      results.push(merged);
    }
  }

  // Add unmatched Garmin activities
  for (let gi = 0; gi < garminList.length; gi++) {
    if (garminAssigned.has(gi)) continue;
    results.push(buildMergedActivity(garminList[gi], null));
  }

  // Add unmatched Whoop activities
  for (let wi = 0; wi < whoopList.length; wi++) {
    if (matchedWhoop.has(wi)) continue;
    results.push(buildWhoopOnly(whoopList[wi]));
  }

  // Sort by start time
  results.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return results;
}

function buildMergedActivity(garmin, whoop) {
  const typeKey = getTypeKey(garmin);
  const gTime = parseGarminTime(garmin);

  const merged = {
    source: whoop ? 'merged' : 'garmin',
    type: typeKey,
    name: getGarminActivityName(garmin),
    color: getGarminActivityColor(garmin),
    startTime: gTime ? gTime.start.toISOString() : garmin.startTimeLocal,
    duration: garmin.duration || 0,
    distance: garmin.distance || 0,
    calories: (garmin._raw?.bmrCalories && garmin.calories)
      ? garmin.calories - garmin._raw.bmrCalories
      : garmin.calories || 0,
    avgHR: garmin.averageHR || 0,
    maxHR: garmin.maxHR || 0,
    garmin: {
      activityId: garmin.activityId,
      pace: garmin.averageSpeed > 0 ? {
        avg: garmin.averageSpeed,    // m/s
        best: garmin.maxSpeed || 0,  // m/s
      } : null,
      cadence: garmin.averageRunningCadenceInStepsPerMinute || garmin.detail?.avgRunCadence || 0,
      strideLength: garmin.avgStrideLength || garmin.detail?.strideLength || 0,
      elevationGain: garmin.elevationGain || 0,
      vO2Max: garmin.vO2MaxValue || garmin.detail?.vO2MaxValue || 0,
      trainingEffect: garmin.detail?.aerobicTrainingEffect || garmin.trainingEffectLabel || '',
      splits: garmin.splits || [],
      // Swimming specific
      strokeCount: garmin.detail?.totalNumberOfStrokes || 0,
      swolf: garmin.detail?.averageSwolf || 0,
      strokeType: garmin.detail?.swimStrokeType || '',
      poolLength: garmin.detail?.poolLength || 0,
      swimCadence: garmin.detail?.averageSwimCadenceInStrokesPerMinute || 0,
      // Power (cycling)
      avgPower: garmin.detail?.avgPower || 0,
      normPower: garmin.detail?.normPower || 0,
    },
    whoop: whoop ? {
      strain: whoop.score?.strain || 0,
      avgHR: whoop.score?.average_heart_rate || 0,
      maxHR: whoop.score?.max_heart_rate || 0,
      calories: whoop.score?.kilojoule ? Math.round(whoop.score.kilojoule * 0.239) : 0,
      sportId: whoop.sport_id,
      zones: whoop.score?.zone_duration || null,
    } : null,
  };

  return merged;
}

function buildWhoopOnly(whoop) {
  const wTime = parseWhoopTime(whoop);
  const durationMs = wTime ? wTime.end.getTime() - wTime.start.getTime() : 0;

  return {
    source: 'whoop',
    type: '',
    name: '',  // Will be resolved via whoopSports in the component
    color: '#44b700',
    startTime: whoop.start || '',
    duration: durationMs / 1000,
    distance: whoop.score?.distance_meter || 0,
    calories: whoop.score?.kilojoule ? Math.round(whoop.score.kilojoule * 0.239) : 0,
    avgHR: whoop.score?.average_heart_rate || 0,
    maxHR: whoop.score?.max_heart_rate || 0,
    garmin: null,
    whoop: {
      strain: whoop.score?.strain || 0,
      avgHR: whoop.score?.average_heart_rate || 0,
      maxHR: whoop.score?.max_heart_rate || 0,
      calories: whoop.score?.kilojoule ? Math.round(whoop.score.kilojoule * 0.239) : 0,
      sportId: whoop.sport_id,
      zones: whoop.score?.zone_duration || null,
      rawWorkout: whoop,
    },
  };
}

// ── Formatting helpers ──

/**
 * Convert m/s speed to pace string like "7:30 /mi"
 */
export function formatPace(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond <= 0) return '—';
  // minutes per mile = 26.8224 / speed(m/s)
  const minPerMile = 26.8224 / metersPerSecond;
  const mins = Math.floor(minPerMile);
  const secs = Math.round((minPerMile - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')} /mi`;
}

/**
 * Convert seconds per 100m to pace string like "1:45 /100m"
 */
export function formatSwimPace(secondsPer100m) {
  if (!secondsPer100m || secondsPer100m <= 0) return '—';
  const mins = Math.floor(secondsPer100m / 60);
  const secs = Math.round(secondsPer100m % 60);
  return `${mins}:${String(secs).padStart(2, '0')} /100m`;
}

/**
 * Calculate swim pace from distance and duration
 * Returns seconds per 100m
 */
export function calcSwimPace(distanceMeters, durationSeconds) {
  if (!distanceMeters || !durationSeconds || distanceMeters <= 0) return 0;
  return (durationSeconds / distanceMeters) * 100;
}

/**
 * Format distance: miles for running/cycling, meters for swimming
 */
export function formatDistance(meters, type) {
  if (!meters || meters <= 0) return '—';
  if (SWIM_TYPES.has(type)) {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  }
  const miles = meters * 0.000621371;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format duration in seconds to "H:MM:SS" or "MM:SS"
 */
export function formatDurationCompact(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format split lap data for display
 */
export function formatSplitPace(split, type) {
  if (SWIM_TYPES.has(type)) {
    // Swim splits: distance and SWOLF
    const dist = split.distance || 0;
    const dur = split.duration || split.movingDuration || 0;
    if (dist > 0 && dur > 0) {
      const pace = (dur / dist) * 100;
      return formatSwimPace(pace);
    }
    return '—';
  }
  // Run/cycle splits: pace from speed
  const speed = split.averageSpeed || 0;
  if (speed > 0) return formatPace(speed);
  // Fallback: compute from distance/duration
  const dist = split.distance || 0;
  const dur = split.duration || split.movingDuration || 0;
  if (dist > 0 && dur > 0) return formatPace(dist / dur);
  return '—';
}
