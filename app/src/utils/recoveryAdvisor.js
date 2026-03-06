/**
 * Recovery Advisor Engine
 * 
 * Takes Whoop API v2 data and today's workout to produce intelligent suggestions.
 * 
 * Whoop v2 API response shapes (cached in Supabase as-is):
 * 
 * Recovery record:
 *   { score_state, score: { recovery_score, resting_heart_rate, hrv_rmssd_milli, spo2_percentage, skin_temp_celsius } }
 * 
 * Sleep record:
 *   { score_state, score: { stage_summary: { total_in_bed_time_milli, total_awake_time_milli, ... }, 
 *     sleep_performance_percentage, sleep_consistency_percentage, sleep_efficiency_percentage, respiratory_rate } }
 * 
 * Cycle record:
 *   { score_state, score: { strain, kilojoule, average_heart_rate, max_heart_rate } }
 */

const ZONE_COLORS = {
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
};

export function getZoneColor(zone) {
  return ZONE_COLORS[zone] || ZONE_COLORS.yellow;
}

function getZone(score) {
  if (score >= 67) return 'green';
  if (score >= 34) return 'yellow';
  return 'red';
}

/**
 * Extract recovery score (0-100) from a Whoop recovery record.
 * Handles both the raw API shape and a pre-flattened shape.
 */
function extractRecoveryScore(rec) {
  if (!rec) return null;
  // v2 API: rec.score.recovery_score
  if (rec.score && typeof rec.score.recovery_score === 'number') return rec.score.recovery_score;
  // Fallback: maybe already flattened
  if (typeof rec.recovery_score === 'number') return rec.recovery_score;
  return null;
}

function extractHrv(rec) {
  if (!rec) return 0;
  if (rec.score && typeof rec.score.hrv_rmssd_milli === 'number') return rec.score.hrv_rmssd_milli;
  if (typeof rec.hrv_rmssd_milli === 'number') return rec.hrv_rmssd_milli;
  return 0;
}

function extractRestingHr(rec) {
  if (!rec) return null;
  if (rec.score && typeof rec.score.resting_heart_rate === 'number') return rec.score.resting_heart_rate;
  if (typeof rec.resting_heart_rate === 'number') return rec.resting_heart_rate;
  return null;
}

/**
 * Extract sleep performance percentage (0-100) from a Whoop sleep record.
 */
function extractSleepScore(rec) {
  if (!rec) return null;
  if (rec.score && typeof rec.score.sleep_performance_percentage === 'number') return rec.score.sleep_performance_percentage;
  if (typeof rec.sleep_performance_percentage === 'number') return rec.sleep_performance_percentage;
  return null;
}

/**
 * Extract total sleep hours from a Whoop sleep record.
 * Sleep time = total_in_bed_time - total_awake_time (both in milliseconds)
 */
function extractSleepHours(rec) {
  if (!rec) return null;
  const stages = rec.score?.stage_summary || rec.stage_summary;
  if (stages && typeof stages.total_in_bed_time_milli === 'number') {
    const sleepMs = stages.total_in_bed_time_milli - (stages.total_awake_time_milli || 0);
    return sleepMs / (1000 * 60 * 60);
  }
  // Fallback: try start/end timestamps
  if (rec.start && rec.end) {
    const ms = new Date(rec.end).getTime() - new Date(rec.start).getTime();
    if (ms > 0) return ms / (1000 * 60 * 60);
  }
  return null;
}

/**
 * Extract day strain from a Whoop cycle record.
 */
function extractStrain(rec) {
  if (!rec) return null;
  if (rec.score && typeof rec.score.strain === 'number') return rec.score.strain;
  if (typeof rec.strain === 'number') return rec.strain;
  return null;
}

function countConsecutiveWorkoutDays(workoutHistory) {
  if (!workoutHistory || workoutHistory.length === 0) return 0;
  let count = 0;
  // workoutHistory assumed sorted most-recent-first
  for (const entry of workoutHistory) {
    if (entry.completed || entry.logged) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function countConsecutiveRestDays(workoutHistory) {
  if (!workoutHistory || workoutHistory.length === 0) return 0;
  let count = 0;
  for (const entry of workoutHistory) {
    if (!entry.completed && !entry.logged) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function bumpZoneConservative(zone) {
  if (zone === 'green') return 'yellow';
  return 'red'; // yellow or red both go to red
}

function buildStrengthSuggestion(zone, score) {
  if (zone === 'green') {
    return {
      headline: "You're recovered — full send today",
      suggestion: "Recovery looks solid. Hit your programmed weights and don't hold back.",
      modifications: {
        type: 'none',
        intensityMultiplier: 1,
        volumeMultiplier: 1,
        suggestedEnergyLevel: 'ready',
      },
    };
  }
  if (zone === 'yellow' && score >= 50) {
    return {
      headline: 'Recovery is moderate — ease off a bit',
      suggestion: "You're not fully topped off. Consider dropping to about 85% intensity and listening to your body on the heavy sets.",
      modifications: {
        type: 'reduce_intensity',
        intensityMultiplier: 0.85,
        volumeMultiplier: 1,
        suggestedEnergyLevel: 'good',
      },
    };
  }
  if (zone === 'yellow') {
    return {
      headline: 'Recovery is below average — scale it back',
      suggestion: "Your body is still catching up. Reduce volume to your top 2 main lifts at lighter loads. Skip the ego sets.",
      modifications: {
        type: 'reduce_volume',
        intensityMultiplier: 0.75,
        volumeMultiplier: 0.66,
        suggestedEnergyLevel: 'low',
      },
    };
  }
  // red
  return {
    headline: 'Recovery is poor — protect yourself today',
    suggestion: "You're running on fumes. Swap to active recovery or an easy walk. The weights will be there tomorrow.",
    modifications: {
      type: 'swap_to_recovery',
      intensityMultiplier: 0.5,
      volumeMultiplier: 0.5,
      suggestedEnergyLevel: 'recovery',
    },
  };
}

function buildCardioSuggestion(zone, score) {
  if (zone === 'green') {
    return {
      headline: "Green light — full cardio day",
      suggestion: "Recovery is strong. Hit the prescribed workout at full effort.",
      modifications: {
        type: 'none',
        intensityMultiplier: 1,
        volumeMultiplier: 1,
        suggestedEnergyLevel: 'ready',
      },
    };
  }
  if (zone === 'yellow') {
    return {
      headline: 'Keep it steady — Zone 2 effort today',
      suggestion: "Recovery is middling. Scale your cardio to Zone 2, and lighten or skip any HIC work. Steady effort, not max effort.",
      modifications: {
        type: 'reduce_intensity',
        intensityMultiplier: 0.8,
        volumeMultiplier: 0.8,
        suggestedEnergyLevel: score >= 50 ? 'good' : 'low',
      },
    };
  }
  // red
  return {
    headline: 'Your body needs a break',
    suggestion: "Swap to an easy 30-minute walk or take full rest. Pushing through when you're this low just digs a deeper hole.",
    modifications: {
      type: 'swap_to_recovery',
      intensityMultiplier: 0.5,
      volumeMultiplier: 0.5,
      suggestedEnergyLevel: 'recovery',
    },
  };
}

function buildRestSuggestion(zone, score, consecutiveRestish) {
  if (zone === 'green' && consecutiveRestish >= 3) {
    return {
      headline: 'Feeling fresh — optional light session?',
      suggestion: "You've been resting and your recovery is high. If you're itching to move, a light session won't hurt. Totally optional.",
      modifications: {
        type: 'swap_to_cardio',
        intensityMultiplier: 0.6,
        volumeMultiplier: 0.5,
        suggestedEnergyLevel: 'good',
      },
    };
  }
  return {
    headline: `Rest day — recovery at ${score}%`,
    suggestion: "Good call resting. Let your body do its thing.",
    modifications: {
      type: 'none',
      intensityMultiplier: 1,
      volumeMultiplier: 1,
      suggestedEnergyLevel: 'ready',
    },
  };
}

/**
 * Main entry point. Takes Whoop data + today's workout and returns a suggestion.
 * Returns null if no Whoop data available.
 * 
 * @param {Object} params
 * @param {Object|null} params.latestRecovery - Most recent Whoop recovery record (v2 API shape)
 * @param {Object|null} params.latestSleep - Most recent Whoop sleep record (v2 API shape)
 * @param {Object|null} params.latestCycle - Most recent Whoop cycle record (v2 API shape)
 * @param {Object} params.todayWorkout - Today's scheduled workout from WEEKLY_TEMPLATE
 * @param {Array} params.workoutHistory - Recent workout history
 * @param {Object} params.settings - User settings
 */
export function getRecoverySuggestion({ latestRecovery, latestSleep, latestCycle, todayWorkout, workoutHistory, settings }) {
  // No Whoop data = no suggestion
  const recoveryScore = extractRecoveryScore(latestRecovery);
  if (recoveryScore == null) return null;

  const hrv = extractHrv(latestRecovery);
  const restingHr = extractRestingHr(latestRecovery);
  const sleepScore = extractSleepScore(latestSleep);
  const sleepHrs = extractSleepHours(latestSleep);
  const strain = extractStrain(latestCycle);

  let zone = getZone(recoveryScore);

  // Sleep score < 50 bumps one tier more conservative
  if (sleepScore != null && sleepScore < 50) {
    zone = bumpZoneConservative(zone);
  }

  // Consecutive strain check: 3+ workout days with recovery < 60 = prioritize rest
  const consecutiveWorkoutDays = countConsecutiveWorkoutDays(workoutHistory);
  const shouldPrioritizeRest = consecutiveWorkoutDays >= 3 && recoveryScore < 60;

  if (shouldPrioritizeRest && todayWorkout?.type !== 'rest') {
    const result = {
      zone,
      score: recoveryScore,
      hrv,
      restingHr,
      sleepScore,
      sleepHours: sleepHrs,
      strain,
      headline: "You've been grinding — time to recover",
      suggestion: `${consecutiveWorkoutDays} straight days of training with sub-60 recovery. Your body is asking for a break. Consider rest or very light movement today.`,
      modifications: {
        type: 'swap_to_recovery',
        intensityMultiplier: 0.5,
        volumeMultiplier: 0.5,
        suggestedEnergyLevel: 'recovery',
      },
      dismissed: false,
    };
    return result;
  }

  // Build suggestion based on workout type
  const workoutType = todayWorkout?.type || 'rest';
  let suggestion;

  if (workoutType === 'strength') {
    suggestion = buildStrengthSuggestion(zone, recoveryScore);
  } else if (workoutType === 'tri' || workoutType === 'long') {
    suggestion = buildCardioSuggestion(zone, recoveryScore);
  } else {
    const consecutiveRestDays = countConsecutiveRestDays(workoutHistory);
    suggestion = buildRestSuggestion(zone, recoveryScore, consecutiveRestDays);
  }

  // Sleep < 6 hours: cap energy level at 'good' (never suggest 'ready')
  if (sleepHrs != null && sleepHrs < 6) {
    const levels = ['recovery', 'low', 'good', 'ready'];
    const current = levels.indexOf(suggestion.modifications.suggestedEnergyLevel);
    const goodIdx = levels.indexOf('good');
    if (current > goodIdx) {
      suggestion.modifications.suggestedEnergyLevel = 'good';
    }
  }

  return {
    zone,
    score: recoveryScore,
    hrv,
    restingHr,
    sleepScore,
    sleepHours: sleepHrs,
    strain,
    ...suggestion,
    dismissed: false,
  };
}
