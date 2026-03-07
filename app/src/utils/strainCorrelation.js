import { categorizeForTrainingPlan } from './whoopSports';

/**
 * Match training plan workouts to Whoop activities by date proximity.
 * Returns correlation data grouped by workout type.
 */
export function getStrainCorrelation(workoutHistory, whoopWorkouts) {
  if (!workoutHistory?.length || !whoopWorkouts?.length) return {};

  const correlations = {};

  for (const logged of workoutHistory) {
    const loggedTime = new Date(logged.date).getTime();

    // Find closest Whoop workout within 2 hours
    let bestMatch = null;
    let bestDiff = Infinity;

    for (const whoop of whoopWorkouts) {
      const whoopTime = new Date(whoop.start || whoop.date).getTime();
      const diff = Math.abs(whoopTime - loggedTime);
      if (diff < bestDiff && diff <= 2 * 60 * 60 * 1000) {
        bestDiff = diff;
        bestMatch = whoop;
      }
    }

    // Also try same-day match if no 2-hour match found
    if (!bestMatch) {
      const loggedDay = new Date(logged.date).toDateString();
      for (const whoop of whoopWorkouts) {
        const whoopDay = new Date(whoop.start || whoop.date).toDateString();
        if (whoopDay === loggedDay && whoop.score) {
          if (!bestMatch || whoop.score.strain > (bestMatch.score?.strain ?? 0)) {
            bestMatch = whoop;
          }
        }
      }
    }

    if (!bestMatch?.score) continue;

    const type = logged.type || 'other';
    if (!correlations[type]) {
      correlations[type] = { totalStrain: 0, totalHR: 0, count: 0, sessions: [] };
    }

    const entry = correlations[type];
    entry.totalStrain += bestMatch.score.strain ?? 0;
    entry.totalHR += bestMatch.score.average_heart_rate ?? 0;
    entry.count++;
    entry.sessions.push({
      date: logged.date,
      strain: bestMatch.score.strain,
      hr: bestMatch.score.average_heart_rate,
      workoutName: logged.workoutName || logged.name,
    });
  }

  // Compute averages
  const result = {};
  for (const [type, data] of Object.entries(correlations)) {
    result[type] = {
      avgStrain: data.count > 0 ? Math.round((data.totalStrain / data.count) * 10) / 10 : 0,
      avgHR: data.count > 0 ? Math.round(data.totalHR / data.count) : 0,
      count: data.count,
      sessions: data.sessions,
    };
  }

  return result;
}

/**
 * Predict expected strain for a workout type based on historical correlation.
 */
export function getExpectedStrain(workoutType, correlationData) {
  const data = correlationData?.[workoutType];
  if (!data || data.count < 2) return null;
  return data.avgStrain;
}

/**
 * Get weekly strain totals for trend analysis.
 */
export function getWeeklyStrainTrend(whoopWorkouts, weeks = 4) {
  if (!whoopWorkouts?.length) return [];

  const now = new Date();
  const result = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (w + 1) * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    let totalStrain = 0;
    let count = 0;

    for (const workout of whoopWorkouts) {
      const dt = new Date(workout.start || workout.date);
      if (dt >= weekStart && dt < weekEnd && workout.score?.strain) {
        totalStrain += workout.score.strain;
        count++;
      }
    }

    result.push({ weekStart: weekStart.toISOString(), totalStrain: Math.round(totalStrain * 10) / 10, count });
  }

  return result;
}
