import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { getSwappedWorkoutForDate } from '../utils/workout';
import { getSportName, getSportIcon, getSportColor, formatDuration } from '../utils/whoopSports';

/**
 * Intelligently matches Whoop activities to planned workouts.
 * Groups all activities by date, then maps each to a component of the planned workout.
 * 
 * Examples:
 * - "Run + HIC" day: Running activity → Run portion, Weightlifting → HIC portion
 * - "Swim or Bike + HIC" day: Swimming → Swim portion, Functional Fitness → HIC
 * - "TB Operator + Accessories" day: Single Weightlifting → full strength session
 * - "Long Tri Session": Long run/bike/swim → endurance session
 */

// Categorize Whoop sport types into broad buckets
const SPORT_CATEGORY = {
  // Cardio - Running
  0: 'running',     // Running
  // Cardio - Cycling
  1: 'cycling',     // Cycling
  71: 'cycling',    // Spinning
  // Cardio - Swimming
  33: 'swimming',   // Swimming
  // Cardio - Rowing
  84: 'rowing',     // Rowing
  47: 'rowing',     // Rowing (duplicate sport id)
  // Strength / HIC-like
  63: 'strength',   // Weightlifting
  44: 'strength',   // Functional Fitness
  39: 'strength',   // CrossFit
  // Endurance
  96: 'endurance',  // Hiking
  35: 'endurance',  // Triathlon
};

function categorizeActivity(activity) {
  const sportId = activity.sport_id;
  if (SPORT_CATEGORY[sportId]) return SPORT_CATEGORY[sportId];
  
  const name = (activity.sport_name || '').toLowerCase();
  if (name.includes('run')) return 'running';
  if (name.includes('swim')) return 'swimming';
  if (name.includes('bike') || name.includes('cycling') || name.includes('spin')) return 'cycling';
  if (name.includes('row')) return 'rowing';
  if (name.includes('weight') || name.includes('strength') || name.includes('crossfit') || name.includes('functional')) return 'strength';
  if (name.includes('hike') || name.includes('triathlon')) return 'endurance';
  
  return 'unknown';
}

/**
 * Map activities to workout components based on the planned workout type.
 * Returns an array of { activity, role, label } objects.
 */
function mapActivitiesToWorkout(activities, planned) {
  const categorized = activities.map(a => ({
    activity: a,
    category: categorizeActivity(a),
    strain: a.score?.strain || 0,
    durationMin: a.start && a.end
      ? Math.round((new Date(a.end) - new Date(a.start)) / 60000)
      : 0,
  }));

  const workoutName = (planned.name || '').toLowerCase();
  
  // "Run + HIC" or "Swim or Bike + HIC" (tri type)
  if (planned.type === 'tri') {
    const isRunDay = workoutName.includes('run');
    const isSwimBikeDay = workoutName.includes('swim') || workoutName.includes('bike');
    
    // Find the cardio portion
    const cardioMatch = categorized.find(a => {
      if (isRunDay) return a.category === 'running';
      if (isSwimBikeDay) return a.category === 'swimming' || a.category === 'cycling';
      return ['running', 'swimming', 'cycling', 'rowing'].includes(a.category);
    });
    
    // Find the HIC portion - strength/functional activities, or a second cardio activity
    const hicMatch = categorized.find(a => {
      if (a.activity === cardioMatch?.activity) return false; // skip the cardio match
      // Strength activities are likely HIC
      if (a.category === 'strength') return true;
      // A second cardio activity with decent strain could be HIC (e.g., rowing, assault bike)
      if (a.strain >= 5 && ['running', 'cycling', 'rowing'].includes(a.category)) return true;
      return false;
    });

    const mapped = [];
    if (cardioMatch) {
      mapped.push({
        activity: cardioMatch.activity,
        role: 'cardio',
        label: isRunDay ? 'Run' : isSwimBikeDay ? 'Swim/Bike' : 'Cardio',
      });
    }
    if (hicMatch) {
      mapped.push({
        activity: hicMatch.activity,
        role: 'hic',
        label: 'HIC',
      });
    }
    
    // If only one activity found and nothing mapped as HIC, it might be the whole workout
    if (mapped.length === 0 && categorized.length > 0) {
      // Just use the highest strain activity
      const best = [...categorized].sort((a, b) => b.strain - a.strain)[0];
      mapped.push({
        activity: best.activity,
        role: 'full',
        label: planned.name,
      });
    }
    
    return mapped;
  }
  
  // Strength day - single activity covers the whole workout
  if (planned.type === 'strength') {
    const strengthMatch = categorized.find(a => a.category === 'strength');
    const best = strengthMatch || [...categorized].sort((a, b) => b.strain - a.strain)[0];
    if (best) {
      return [{
        activity: best.activity,
        role: 'full',
        label: planned.name,
      }];
    }
    return [];
  }
  
  // Long day - endurance or longest cardio session
  if (planned.type === 'long') {
    const enduranceMatch = categorized.find(a => a.category === 'endurance');
    const longCardio = [...categorized]
      .filter(a => ['running', 'cycling', 'swimming', 'rowing'].includes(a.category))
      .sort((a, b) => b.durationMin - a.durationMin)[0];
    const best = enduranceMatch || longCardio || [...categorized].sort((a, b) => b.strain - a.strain)[0];
    if (best) {
      return [{
        activity: best.activity,
        role: 'full',
        label: planned.name,
      }];
    }
    return [];
  }
  
  return [];
}

export default function WhoopAutoLog() {
  const { workoutHistory, setWorkoutHistory, weekSwaps } = useApp();
  const { connected, workouts: whoopWorkouts } = useWhoop();
  const [dismissed, setDismissed] = useState(new Set()); // dismissed date keys
  const [logging, setLogging] = useState(new Set());

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map(e => new Date(e.date).toDateString())),
    [workoutHistory]
  );

  // Group activities by date and match to planned workouts
  const pendingDayMatches = useMemo(() => {
    if (!connected || !whoopWorkouts?.length) return [];

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Group activities by date
    const byDate = {};
    for (const activity of whoopWorkouts) {
      const actDate = new Date(activity.start || activity.date);
      actDate.setHours(0, 0, 0, 0);
      if (actDate < sevenDaysAgo) continue;
      
      const strain = activity.score?.strain || 0;
      if (strain < 3) continue; // Skip very low strain
      
      const dateKey = actDate.toDateString();
      if (!byDate[dateKey]) byDate[dateKey] = { date: actDate, activities: [] };
      byDate[dateKey].activities.push(activity);
    }

    const dayMatches = [];
    
    for (const [dateKey, { date, activities }] of Object.entries(byDate)) {
      // Skip if already logged or dismissed
      if (loggedDates.has(dateKey)) continue;
      if (dismissed.has(dateKey)) continue;
      
      // Get planned workout
      const planned = getSwappedWorkoutForDate(date, weekSwaps);
      if (!planned || planned.type === 'rest') continue;
      
      // Map activities to workout components
      const mapped = mapActivitiesToWorkout(activities, planned);
      if (mapped.length === 0) continue;
      
      // Calculate combined stats
      const totalStrain = activities.reduce((sum, a) => sum + (a.score?.strain || 0), 0);
      const totalDuration = activities.reduce((sum, a) => {
        if (!a.start || !a.end) return sum;
        return sum + Math.round((new Date(a.end) - new Date(a.start)) / 60000);
      }, 0);
      
      dayMatches.push({
        dateKey,
        date,
        planned,
        mapped,
        allActivities: activities,
        totalStrain,
        totalDuration,
      });
    }

    return dayMatches
      .sort((a, b) => b.date - a.date)
      .slice(0, 3);
  }, [connected, whoopWorkouts, loggedDates, weekSwaps, dismissed]);

  const handleConfirm = useCallback((dayMatch) => {
    const { dateKey, date, planned, mapped, totalStrain, totalDuration } = dayMatch;
    
    setLogging(prev => new Set([...prev, dateKey]));

    // Build whoop activity data from all mapped components
    const components = mapped.map(({ activity, role, label }) => {
      const sportName = getSportName(activity.sport_id, activity);
      const duration = activity.start && activity.end
        ? Math.round((new Date(activity.end) - new Date(activity.start)) / 60000)
        : undefined;
      return {
        role,
        label,
        sportName,
        sportId: activity.sport_id,
        strain: activity.score?.strain,
        avgHR: activity.score?.average_heart_rate,
        maxHR: activity.score?.max_heart_rate,
        calories: activity.score?.kilojoule ? Math.round(activity.score.kilojoule * 0.239006) : undefined,
        duration,
      };
    });

    const primarySport = components[0]?.sportName || 'Activity';
    const allSports = components.map(c => `${c.label}: ${c.sportName}`).join(', ');
    
    setWorkoutHistory(prev => [...prev, {
      id: `whoop-${date.toISOString().split('T')[0]}-${Date.now()}`,
      date: date.toISOString(),
      workoutName: planned.name,
      type: planned.type,
      ...(totalDuration ? { duration: totalDuration } : {}),
      source: 'whoop',
      whoopActivity: {
        // Primary stats (combined)
        sportName: primarySport,
        strain: totalStrain,
        avgHR: components[0]?.avgHR,
        maxHR: Math.max(...components.map(c => c.maxHR || 0)) || undefined,
        calories: components.reduce((sum, c) => sum + (c.calories || 0), 0) || undefined,
        // Detailed breakdown
        components,
      },
      details: planned.type === 'strength'
        ? { source: 'whoop-auto', note: `Auto-logged from Whoop: ${allSports}` }
        : {
            cardio: { name: primarySport, metrics: {} },
            source: 'whoop-auto',
            note: `Auto-logged from Whoop: ${allSports}`,
          },
    }]);
  }, [setWorkoutHistory]);

  const handleDismiss = useCallback((dateKey) => {
    setDismissed(prev => new Set([...prev, dateKey]));
  }, []);

  if (!pendingDayMatches.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Detected Workouts</h2>
      
      <AnimatePresence mode="popLayout">
        {pendingDayMatches.map((dayMatch) => {
          const { dateKey, date, planned, mapped, totalStrain, totalDuration } = dayMatch;
          const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const isLogging = logging.has(dateKey);
          const isMultiPart = mapped.length > 1;
          
          // Use the planned workout type for the accent color
          const accentColor = planned.type === 'strength' ? '#F59E0B'
            : planned.type === 'tri' ? '#14B8A6'
            : planned.type === 'long' ? '#10B981'
            : '#6B7280';

          return (
            <motion.div
              key={dateKey}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: isLogging ? 0.5 : 1, scale: isLogging ? 0.98 : 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden"
            >
              {/* Accent bar */}
              <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />
              
              <div className="p-5">
                {/* Header: date + planned workout name */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[15px] font-semibold text-white">{planned.name}</div>
                    <div className="text-[12px] text-[#888888]">{dateLabel}</div>
                  </div>
                  <div className="text-right">
                    {totalStrain > 0 && (
                      <div className="text-[13px] font-semibold" style={{ color: accentColor }}>
                        {totalStrain.toFixed(1)} strain
                      </div>
                    )}
                    {totalDuration > 0 && (
                      <div className="text-[11px] text-[#666666]">{totalDuration}m total</div>
                    )}
                  </div>
                </div>

                {/* Activity breakdown */}
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
                            {isMultiPart && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.06] text-[#888888] uppercase">
                                {label}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#666666]">
                            {duration !== '—' ? duration : ''}
                            {strain != null && <>{duration !== '—' ? ' · ' : ''}{strain.toFixed(1)} strain</>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Question */}
                <p className="text-[13px] text-[#A0A0A0] mb-4 leading-relaxed">
                  {isMultiPart
                    ? <>Detected <span className="text-white font-medium">{mapped.length} activities</span> matching your planned <span className="text-white font-medium">{planned.name}</span>. Log it?</>
                    : <>Was this your planned <span className="text-white font-medium">{planned.name}</span> workout?</>
                  }
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleConfirm(dayMatch)}
                    disabled={isLogging}
                    className="flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-[13px] font-semibold text-white transition-colors active:scale-[0.98] disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check size={16} />
                    {isLogging ? 'Logged ✓' : 'Yes, Log It'}
                  </button>
                  <button
                    onClick={() => handleDismiss(dateKey)}
                    disabled={isLogging}
                    className="flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-[13px] font-semibold text-[#A0A0A0] border border-white/[0.12] bg-transparent transition-colors active:scale-[0.98] disabled:opacity-50"
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
