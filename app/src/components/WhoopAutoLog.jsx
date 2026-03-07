import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { getSwappedWorkoutForDate } from '../utils/workout';
import { getSportName, getSportIcon, getSportColor, formatDuration } from '../utils/whoopSports';

/**
 * Matches Whoop activities to unlogged planned workouts.
 * Shows a confirmation card for each match:
 * "Whoop detected [activity] on [date]. Was this your planned [workout]?"
 * Accept → auto-logs the workout. Dismiss → skips.
 */

// Sport types that map to planned workout types
const SPORT_TYPE_MAP = {
  // Strength-like activities
  63: 'strength', // Weightlifting  
  44: 'strength', // Functional Fitness
  39: 'strength', // CrossFit
  // Cardio/tri-like activities
  0: 'tri',   // Running
  1: 'tri',   // Cycling
  33: 'tri',  // Swimming
  71: 'tri',  // Spinning
  84: 'tri',  // Rowing
  47: 'tri',  // Rowing
  // Endurance/long
  96: 'long', // Hiking
  35: 'long', // Triathlon
};

function guessWorkoutType(whoopActivity) {
  const sportId = whoopActivity.sport_id;
  if (SPORT_TYPE_MAP[sportId]) return SPORT_TYPE_MAP[sportId];
  
  // Infer from sport_name
  const name = (whoopActivity.sport_name || '').toLowerCase();
  if (name.includes('weight') || name.includes('strength') || name.includes('crossfit') || name.includes('functional')) return 'strength';
  if (name.includes('run') || name.includes('swim') || name.includes('bike') || name.includes('cycling') || name.includes('spin')) return 'tri';
  if (name.includes('hike') || name.includes('triathlon')) return 'long';
  
  // High strain + long duration = likely cardio
  const strain = whoopActivity.score?.strain || 0;
  const durationMs = whoopActivity.start && whoopActivity.end 
    ? new Date(whoopActivity.end) - new Date(whoopActivity.start) 
    : 0;
  const durationMin = durationMs / 60000;
  
  if (durationMin > 60 && strain > 10) return 'long';
  if (strain > 8) return 'tri';
  
  return null; // Can't determine
}

export default function WhoopAutoLog() {
  const { workoutHistory, setWorkoutHistory, weekSwaps } = useApp();
  const { connected, workouts: whoopWorkouts } = useWhoop();
  const [dismissed, setDismissed] = useState(new Set());
  const [confirming, setConfirming] = useState(null); // activity being confirmed

  const loggedDates = useMemo(
    () => new Set(workoutHistory.map(e => new Date(e.date).toDateString())),
    [workoutHistory]
  );

  // Find Whoop activities that match unlogged planned workouts
  const pendingMatches = useMemo(() => {
    if (!connected || !whoopWorkouts?.length) return [];

    const matches = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const activity of whoopWorkouts) {
      const actDate = new Date(activity.start || activity.date);
      actDate.setHours(0, 0, 0, 0);
      
      // Only look at last 7 days
      if (actDate < sevenDaysAgo) continue;
      
      const dateStr = actDate.toDateString();
      
      // Skip if already logged for this date
      if (loggedDates.has(dateStr)) continue;
      
      // Skip if dismissed
      const actId = activity.id || `${activity.sport_id}-${activity.start}`;
      if (dismissed.has(actId)) continue;
      
      // Get planned workout for this date
      const planned = getSwappedWorkoutForDate(actDate, weekSwaps);
      if (!planned || planned.type === 'rest') continue;
      
      // Check if the Whoop activity could match the planned workout
      const guessedType = guessWorkoutType(activity);
      const isLikelyMatch = guessedType === planned.type;
      
      // Only show high-confidence matches or ask about any activity on that day
      const strain = activity.score?.strain || 0;
      if (strain < 3) continue; // Skip very low strain (probably auto-detected)
      
      matches.push({
        id: actId,
        activity,
        planned,
        date: actDate,
        isLikelyMatch,
        guessedType,
      });
    }

    // Sort by date descending (most recent first), limit to 3
    return matches
      .sort((a, b) => b.date - a.date)
      .slice(0, 3);
  }, [connected, whoopWorkouts, loggedDates, weekSwaps, dismissed]);

  const handleConfirm = useCallback((match) => {
    const { activity, planned, date } = match;
    const duration = activity.start && activity.end
      ? Math.round((new Date(activity.end) - new Date(activity.start)) / 60000)
      : undefined;
    
    const sportName = getSportName(activity.sport_id, activity);
    
    setWorkoutHistory(prev => [...prev, {
      date: date.toISOString(),
      workoutName: planned.name,
      type: planned.type,
      ...(duration ? { duration } : {}),
      source: 'whoop',
      whoopActivity: {
        sportName,
        sportId: activity.sport_id,
        strain: activity.score?.strain,
        avgHR: activity.score?.average_heart_rate,
        maxHR: activity.score?.max_heart_rate,
        calories: activity.score?.kilojoule ? Math.round(activity.score.kilojoule * 0.239006) : undefined,
      },
      details: planned.type === 'strength' 
        ? { source: 'whoop-auto', note: `Auto-logged from Whoop: ${sportName}` }
        : { 
            cardio: { name: sportName, metrics: {} },
            source: 'whoop-auto',
            note: `Auto-logged from Whoop: ${sportName}`,
          },
    }]);
    
    setConfirming(null);
  }, [setWorkoutHistory]);

  const handleDismiss = useCallback((matchId) => {
    setDismissed(prev => new Set([...prev, matchId]));
    setConfirming(null);
  }, []);

  if (!pendingMatches.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Detected Workouts</h2>
      
      <AnimatePresence mode="popLayout">
        {pendingMatches.map((match) => {
          const { id, activity, planned, date, isLikelyMatch } = match;
          const SportIcon = getSportIcon(activity.sport_id, activity);
          const color = getSportColor(activity.sport_id);
          const sportName = getSportName(activity.sport_id, activity);
          const strain = activity.score?.strain;
          const duration = formatDuration(activity.start, activity.end);
          const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const isConfirming = confirming === id;

          return (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden"
            >
              {/* Accent bar */}
              <div className="h-0.5 w-full" style={{ backgroundColor: isLikelyMatch ? color : '#F59E0B' }} />
              
              <div className="p-5">
                {!isConfirming ? (
                  <>
                    {/* Activity info */}
                    <div className="flex items-center gap-3.5 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '15' }}>
                        <SportIcon size={20} color={color} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold text-white">{sportName}</div>
                        <div className="text-[12px] text-[#888888]">
                          {dateLabel} · {duration !== '—' ? duration : ''}
                          {strain != null && <> · {strain.toFixed(1)} strain</>}
                        </div>
                      </div>
                    </div>

                    {/* Question */}
                    <p className="text-[13px] text-[#A0A0A0] mb-4 leading-relaxed">
                      {isLikelyMatch
                        ? <>Was this your planned <span className="text-white font-medium">{planned.name}</span> workout?</>
                        : <>You had <span className="text-white font-medium">{planned.name}</span> scheduled. Was this it?</>
                      }
                    </p>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirming(id)}
                        className="flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-[13px] font-semibold text-white transition-colors active:scale-[0.98]"
                        style={{ backgroundColor: color }}
                      >
                        <Check size={16} />
                        Yes, Log It
                      </button>
                      <button
                        onClick={() => handleDismiss(id)}
                        className="flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-[13px] font-semibold text-[#A0A0A0] border border-white/[0.12] bg-transparent transition-colors active:scale-[0.98]"
                      >
                        Not This
                      </button>
                    </div>
                  </>
                ) : (
                  /* Confirmation state */
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p className="text-[14px] text-white font-medium mb-1">
                      Log as: {planned.name}
                    </p>
                    <p className="text-[12px] text-[#888888] mb-4">
                      {dateLabel} · Whoop data (strain, HR, duration) will be saved
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleConfirm(match)}
                        className="flex-1 flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-[13px] font-semibold text-white bg-accent-green transition-colors active:scale-[0.98]"
                      >
                        <Check size={16} />
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="px-4 flex items-center justify-center min-h-[42px] rounded-xl text-[13px] text-[#666666] border border-white/[0.08] transition-colors active:scale-[0.98]"
                      >
                        Back
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
