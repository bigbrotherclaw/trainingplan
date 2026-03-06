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

function sleepHours(latestSleep) {
  if (!latestSleep) return null;
  // duration can be in milliseconds or seconds depending on Whoop API version
  const dur = latestSleep.qualityDuration || latestSleep.duration || 0;
  // Whoop API returns milliseconds
  return dur / (1000 * 60 * 60);
}

function countConsecutiveWorkoutDays(workoutHistory) {
  if (!workoutHistory || workoutHistory.length === 0) return 0;
  // workoutHistory assumed sorted most-recent-first
  let count = 0;
  for (const entry of workoutHistory) {
    if (entry.completed || entry.logged) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function bumpZoneConservative(zone) {
  if (zone === 'green') return 'yellow';
  if (zone === 'yellow') return 'red';
  return 'red';
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

export function getRecoverySuggestion({ latestRecovery, latestSleep, latestCycle, todayWorkout, workoutHistory, settings }) {
  // No Whoop data = no suggestion
  if (!latestRecovery || latestRecovery.score == null) return null;

  const score = latestRecovery.score;
  const hrv = latestRecovery.hrv || 0;
  const sleepScore = latestSleep?.score ?? null;
  const hours = sleepHours(latestSleep);

  let zone = getZone(score);

  // Sleep score < 50 bumps one tier more conservative
  if (sleepScore != null && sleepScore < 50) {
    zone = bumpZoneConservative(zone);
  }

  // Consecutive strain check: 3+ workout days with recovery < 60 = prioritize rest
  const consecutiveWorkoutDays = countConsecutiveWorkoutDays(workoutHistory);
  const shouldPrioritizeRest = consecutiveWorkoutDays >= 3 && score < 60;

  if (shouldPrioritizeRest && todayWorkout?.type !== 'rest') {
    const result = {
      zone,
      score,
      hrv,
      sleepScore,
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

    // Sleep < 6h floor
    if (hours != null && hours < 6 && result.modifications.suggestedEnergyLevel === 'ready') {
      result.modifications.suggestedEnergyLevel = 'good';
    }

    return result;
  }

  // Build suggestion based on workout type
  const workoutType = todayWorkout?.type || 'rest';
  let suggestion;

  if (workoutType === 'strength') {
    suggestion = buildStrengthSuggestion(zone, score);
  } else if (workoutType === 'tri' || workoutType === 'long') {
    suggestion = buildCardioSuggestion(zone, score);
  } else {
    // rest day
    const consecutiveRestDays = countConsecutiveRestDays(workoutHistory);
    suggestion = buildRestSuggestion(zone, score, consecutiveRestDays);
  }

  // Sleep < 6 hours: always suggest at minimum 'good' energy level
  if (hours != null && hours < 6) {
    const levels = ['recovery', 'low', 'good', 'ready'];
    const current = levels.indexOf(suggestion.modifications.suggestedEnergyLevel);
    const goodIdx = levels.indexOf('good');
    if (current > goodIdx) {
      suggestion.modifications.suggestedEnergyLevel = 'good';
    }
  }

  return {
    zone,
    score,
    hrv,
    sleepScore,
    ...suggestion,
    dismissed: false,
  };
}
