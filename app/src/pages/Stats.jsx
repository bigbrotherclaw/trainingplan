import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { Trophy, BarChart3, ChevronDown, ChevronUp, Timer, Zap } from 'lucide-react';
import { OPERATOR_LIFTS, EXERCISE_MUSCLE_MAP } from '../data/training';
import { getSwappedWorkoutForDate } from '../utils/workout';
import { useWhoop } from '../hooks/useWhoop';
import { useGarmin } from '../hooks/useGarmin';
import { getSportName, getSportIcon, getSportColor, formatDuration as formatWhoopDuration, metersToMiles, kjToKcal } from '../utils/whoopSports';
import { LiftIcon } from '../components/LiftIcons';
import { getStrainCorrelation, getWeeklyStrainTrend } from '../utils/strainCorrelation';
import { formatPace, formatSwimPace, calcSwimPace, formatDistance, formatDurationCompact, formatSplitPace } from '../utils/mergeActivities';

const LIFT_COLORS = { 'Bench Press': '#3b82f6', 'Back Squat': '#ef4444', 'Weighted Pull-up': '#10b981' };
const LIFT_TABS = [
  { name: 'Bench Press', short: 'Bench' },
  { name: 'Back Squat', short: 'Squat' },
  { name: 'Weighted Pull-up', short: 'Pull-up' },
];
const TIME_RANGES = ['4W', '3M', '6M', 'All'];

const TYPE_BAR_COLORS = {
  strength: '#F59E0B',
  tri: '#14B8A6',
  long: '#10B981',
  rest: '#6B7280',
};

const SPORT_TABS = [
  { key: 'run', label: 'Run', color: '#3B82F6' },
  { key: 'bike', label: 'Bike', color: '#F59E0B' },
  { key: 'swim', label: 'Swim', color: '#14B8A6' },
];
const SPORT_COLORS = { run: '#3B82F6', bike: '#F59E0B', swim: '#14B8A6' };

function identifySport(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes('run')) return 'run';
  if (lower.includes('swim') || lower.includes('ows')) return 'swim';
  if (lower.includes('bike') || lower.includes('ride')) return 'bike';
  return null;
}

function formatPaceLocal(pace) {
  if (!pace && pace !== 0) return '--';
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ── Garmin activity type detection ──
const RUN_TYPE_KEYS = new Set(['running', 'trail_running', 'treadmill_running', 'track_running']);
const SWIM_TYPE_KEYS = new Set(['lap_swimming', 'open_water_swimming', 'pool_swimming', 'swimming']);
const CYCLE_TYPE_KEYS = new Set(['cycling', 'indoor_cycling', 'mountain_biking']);

function getGarminSportType(activity) {
  const typeKey = activity?.activityType?.typeKey || '';
  if (RUN_TYPE_KEYS.has(typeKey)) return 'run';
  if (SWIM_TYPE_KEYS.has(typeKey)) return 'swim';
  if (CYCLE_TYPE_KEYS.has(typeKey)) return 'bike';
  return null;
}

// ── Interval Detection Algorithm ──

function roundToStandardDistance(meters) {
  const standards = [100, 200, 400, 800, 1200, 1600, 2000, 3200, 5000];
  let closest = standards[0];
  let minDiff = Math.abs(meters - standards[0]);
  for (const s of standards) {
    const diff = Math.abs(meters - s);
    if (diff < minDiff) { minDiff = diff; closest = s; }
  }
  // Only snap if within 15% of a standard distance
  return minDiff / closest < 0.15 ? closest : Math.round(meters / 50) * 50;
}

function analyzeGarminSplits(activity) {
  const sportType = getGarminSportType(activity);
  if (!sportType) return null;

  const splits = activity.splits || [];
  if (splits.length < 2) return null;

  const date = activity.startTimeLocal ? activity.startTimeLocal.split(' ')[0] : activity.date || '';
  const totalDistance = activity.distance || 0;
  const totalDuration = activity.duration || 0;
  const avgPace = totalDistance > 0 && totalDuration > 0 ? totalDistance / totalDuration : 0;
  const avgHR = activity.averageHR || 0;

  // Parse splits into normalized form
  const parsed = splits.map((s, i) => ({
    index: i,
    distance: s.distance || 0,
    duration: s.duration || s.movingDuration || 0,
    avgSpeed: s.averageSpeed || (s.distance && s.duration ? s.distance / s.duration : 0),
    hr: s.averageHR || s.averageHeartRate || 0,
    pace: s.averageSpeed > 0 ? s.averageSpeed : (s.distance && s.duration ? s.distance / s.duration : 0),
  })).filter(s => s.distance > 0 && s.duration > 0);

  if (parsed.length < 2) return {
    date, type: sportType, activityName: activity.activityName || '', workoutType: 'easy',
    intervals: null, totalDistance, totalDuration, avgPace, avgHR,
  };

  // Compute overall avg pace across all splits
  const totalSplitDist = parsed.reduce((s, p) => s + p.distance, 0);
  const totalSplitDur = parsed.reduce((s, p) => s + p.duration, 0);
  const overallPace = totalSplitDist / totalSplitDur;

  // Find splits that are significantly faster than average (>15% faster = higher m/s)
  const fastThreshold = overallPace * 1.15;
  const fastSplits = parsed.filter(s => s.pace >= fastThreshold);

  // Group fast splits by distance similarity (within 10%)
  const distanceGroups = [];
  for (const split of fastSplits) {
    let foundGroup = false;
    for (const group of distanceGroups) {
      const groupAvgDist = group.reduce((s, g) => s + g.distance, 0) / group.length;
      if (Math.abs(split.distance - groupAvgDist) / groupAvgDist < 0.10) {
        group.push(split);
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) distanceGroups.push([split]);
  }

  // Find the largest group of similar-distance fast splits (these are our intervals)
  const bestGroup = distanceGroups.sort((a, b) => b.length - a.length)[0];

  if (bestGroup && bestGroup.length >= 2) {
    const avgDist = bestGroup.reduce((s, g) => s + g.distance, 0) / bestGroup.length;
    const standardDist = roundToStandardDistance(avgDist);
    const intervalSplits = bestGroup.map(s => ({
      pace: s.pace,
      hr: s.hr,
      duration: s.duration,
      distance: s.distance,
    }));
    const intervalAvgPace = intervalSplits.reduce((s, sp) => s + sp.pace, 0) / intervalSplits.length;
    const bestPace = Math.max(...intervalSplits.map(s => s.pace));
    const intervalAvgHR = intervalSplits.filter(s => s.hr > 0).length > 0
      ? Math.round(intervalSplits.filter(s => s.hr > 0).reduce((s, sp) => s + sp.hr, 0) / intervalSplits.filter(s => s.hr > 0).length)
      : 0;

    return {
      date, type: sportType, activityName: activity.activityName || '', workoutType: 'interval',
      intervals: {
        count: bestGroup.length,
        distance: standardDist,
        label: `${bestGroup.length}x${standardDist}m`,
        splits: intervalSplits,
        avgPace: intervalAvgPace,
        bestPace,
        avgHR: intervalAvgHR,
      },
      totalDistance, totalDuration, avgPace, avgHR,
    };
  }

  // Check for tempo: consistent pace (low variance)
  const paces = parsed.map(s => s.pace);
  const avgP = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((s, p) => s + Math.pow(p - avgP, 2), 0) / paces.length;
  const cv = Math.sqrt(variance) / avgP; // coefficient of variation

  const workoutType = cv < 0.08 ? 'tempo' : (totalDuration > 2400 ? 'long' : 'easy');

  return {
    date, type: sportType, activityName: activity.activityName || '', workoutType,
    intervals: null, totalDistance, totalDuration, avgPace, avgHR,
  };
}

function epley(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function formatDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min} min`;
}

function strainColor(s) {
  return s > 14 ? '#EF4444' : s >= 8 ? '#F59E0B' : '#10B981';
}

const ZONE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#DC2626'];
const ZONE_KEYS = ['zone_one_milli', 'zone_two_milli', 'zone_three_milli', 'zone_four_milli', 'zone_five_milli'];

export default function Stats() {
  const { workoutHistory, weekSwaps } = useApp();
  const { connected: whoopConnected, data: whoopData } = useWhoop();
  const { activities: garminActivities } = useGarmin();
  const [selectedLift, setSelectedLift] = useState('Bench Press');
  const [timeRange, setTimeRange] = useState('All');
  const [statsView, setStatsView] = useState('activity');
  const [selectedSport, setSelectedSport] = useState('run');
  const [expandedActivity, setExpandedActivity] = useState(null);
  const [expandedInterval, setExpandedInterval] = useState(null);
  const [intervalDistFilter, setIntervalDistFilter] = useState('all');
  const [enduranceSportTab, setEnduranceSportTab] = useState('run');

  const now = useMemo(() => new Date(), []);

  const filterByRange = (data) => {
    if (timeRange === 'All') return data;
    const cutoff = new Date(now);
    if (timeRange === '4W') cutoff.setDate(cutoff.getDate() - 28);
    else if (timeRange === '3M') cutoff.setMonth(cutoff.getMonth() - 3);
    else if (timeRange === '6M') cutoff.setMonth(cutoff.getMonth() - 6);
    return data.filter(d => new Date(d.fullDate) >= cutoff);
  };

  // Strength Journey data per lift
  const liftData = useMemo(() => {
    const sessions = workoutHistory
      .filter((e) => e.type === 'strength' && e.details?.lifts)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const byLift = {};
    LIFT_TABS.forEach(l => { byLift[l.name] = []; });
    sessions.forEach((entry) => {
      const d = new Date(entry.date);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      entry.details.lifts.forEach((lift) => {
        if (byLift[lift.name]) {
          byLift[lift.name].push({
            date: label,
            fullDate: entry.date,
            weight: lift.weight,
            e1rm: epley(lift.weight, lift.reps),
            reps: lift.reps,
          });
        }
      });
    });
    return byLift;
  }, [workoutHistory]);

  const chartData = useMemo(() => filterByRange(liftData[selectedLift] || []), [liftData, selectedLift, timeRange]);

  // Personal best for selected lift
  const personalBest = useMemo(() => {
    const data = liftData[selectedLift] || [];
    if (data.length === 0) return null;
    return data.reduce((best, d) => (!best || d.weight > best.weight) ? d : best, null);
  }, [liftData, selectedLift]);

  // Volume This Week - daily bars
  const volumeWeek = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = days.map((day, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toDateString();
      const isToday = dateStr === today.toDateString();
      const workout = getSwappedWorkoutForDate(date, weekSwaps);
      let tonnage = 0;
      workoutHistory
        .filter(e => new Date(e.date).toDateString() === dateStr && e.type === 'strength' && e.details?.lifts)
        .forEach(entry => {
          entry.details.lifts.forEach(lift => {
            tonnage += lift.weight * lift.reps * (lift.setsCompleted || 1);
          });
          if (entry.details.accessories) {
            entry.details.accessories.forEach(acc => {
              tonnage += (acc.weight || 0) * acc.reps * (acc.setsCompleted || 1);
            });
          }
        });
      return { day, tonnage, isToday, type: workout.type };
    });
    return result;
  }, [workoutHistory, weekSwaps]);

  // Body Balance - horizontal bars by muscle group
  const muscleBalance = useMemo(() => {
    const points = {};
    workoutHistory.forEach((entry) => {
      if (entry.type === 'strength') {
        const addPoints = (name) => {
          const mapping = EXERCISE_MUSCLE_MAP[name];
          if (mapping) {
            Object.entries(mapping).forEach(([muscle, pts]) => {
              points[muscle] = (points[muscle] || 0) + pts;
            });
          }
        };
        if (entry.details?.lifts) entry.details.lifts.forEach(l => addPoints(l.name));
        if (entry.details?.accessories) entry.details.accessories.forEach(a => addPoints(a.name));
      }
    });
    const labels = { chest: 'Chest', shoulders: 'Shoulders', lats: 'Lats', traps: 'Traps', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', core: 'Core', obliques: 'Obliques', lowerBack: 'Lower Back', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves' };
    const list = Object.entries(points)
      .map(([key, val]) => ({ key, label: labels[key] || key, points: val }))
      .sort((a, b) => b.points - a.points);
    if (list.length === 0) return [];
    const maxPts = list[0].points;
    return list.map(m => ({
      ...m,
      pct: Math.round((m.points / maxPts) * 100),
      color: m.points >= maxPts * 0.7 ? '#10B981' : m.points >= maxPts * 0.3 ? '#F59E0B' : '#6B7280',
    }));
  }, [workoutHistory]);

  // Streak & Consistency - last 12 weeks
  const weeklyConsistency = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weeks = [];
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() - w * 7);
      let logged = 0, planned = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        const workout = getSwappedWorkoutForDate(date, weekSwaps);
        if (workout.type !== 'rest') planned++;
        if (workoutHistory.some(e => new Date(e.date).toDateString() === date.toDateString())) logged++;
      }
      const pct = planned > 0 ? Math.round((logged / planned) * 100) : 0;
      weeks.push({ weekStart, pct, logged, planned });
    }
    return weeks;
  }, [workoutHistory, weekSwaps]);

  // === ENDURANCE DATA ===

  const enduranceSessions = useMemo(() => {
    return workoutHistory
      .filter(e => (e.type === 'tri' || e.type === 'long') && e.details?.cardio)
      .map(e => {
        const sport = identifySport(e.details.cardio.name);
        const metrics = e.details.cardio.metrics || {};
        return { date: e.date, sport, metrics, name: e.details.cardio.name };
      })
      .filter(e => e.sport)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [workoutHistory]);

  const defaultView = useMemo(() => {
    const sc = workoutHistory.filter(e => e.type === 'strength').length;
    return enduranceSessions.length > sc ? 'endurance' : 'strength';
  }, [workoutHistory, enduranceSessions]);

  const activeView = statsView ?? defaultView;

  const enduranceOverview = useMemo(() => {
    const t = {
      run: { distance: 0, time: 0, paceSum: 0, count: 0 },
      bike: { distance: 0, time: 0, powerSum: 0, count: 0 },
      swim: { distance: 0, time: 0, paceSum: 0, count: 0 },
    };
    enduranceSessions.forEach(s => {
      const o = t[s.sport];
      o.count++;
      o.time += s.metrics.totalTime || 0;
      if (s.sport === 'run') {
        o.distance += s.metrics.distance || 0;
        if (s.metrics.avgPace) o.paceSum += s.metrics.avgPace;
      } else if (s.sport === 'bike') {
        o.distance += s.metrics.distance || 0;
        if (s.metrics.avgPower) o.powerSum += s.metrics.avgPower;
      } else {
        o.distance += s.metrics.totalDistance || 0;
        if (s.metrics.avgPace) o.paceSum += s.metrics.avgPace;
      }
    });
    return t;
  }, [enduranceSessions]);

  const enduranceTrends = useMemo(() => {
    const bySport = { run: [], bike: [], swim: [] };
    enduranceSessions.forEach(s => {
      const d = new Date(s.date);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const base = { date: label, fullDate: s.date };
      if (s.sport === 'run') {
        bySport.run.push({ ...base, pace: s.metrics.avgPace || null, distance: s.metrics.distance || 0 });
      } else if (s.sport === 'bike') {
        bySport.bike.push({ ...base, power: s.metrics.avgPower || null, distance: s.metrics.distance || 0 });
      } else {
        bySport.swim.push({ ...base, pace: s.metrics.avgPace || null, distance: s.metrics.totalDistance || 0 });
      }
    });
    return bySport;
  }, [enduranceSessions]);

  const enduranceTrendData = useMemo(() => filterByRange(enduranceTrends[selectedSport] || []), [enduranceTrends, selectedSport, timeRange]);

  const endurancePBs = useMemo(() => {
    const pbs = { run: {}, bike: {}, swim: {} };
    enduranceSessions.forEach(s => {
      const p = pbs[s.sport];
      if (s.sport === 'run') {
        if (s.metrics.avgPace && (!p.fastestPace || s.metrics.avgPace < p.fastestPace)) p.fastestPace = s.metrics.avgPace;
        if (s.metrics.distance && (!p.longestDist || s.metrics.distance > p.longestDist)) p.longestDist = s.metrics.distance;
      } else if (s.sport === 'bike') {
        if (s.metrics.avgPower && (!p.highestPower || s.metrics.avgPower > p.highestPower)) p.highestPower = s.metrics.avgPower;
        if (s.metrics.distance && (!p.longestDist || s.metrics.distance > p.longestDist)) p.longestDist = s.metrics.distance;
      } else {
        if (s.metrics.avgPace && (!p.fastestPace || s.metrics.avgPace < p.fastestPace)) p.fastestPace = s.metrics.avgPace;
        if (s.metrics.totalDistance && (!p.longestDist || s.metrics.totalDistance > p.longestDist)) p.longestDist = s.metrics.totalDistance;
      }
    });
    return pbs;
  }, [enduranceSessions]);

  const enduranceWeekVolume = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((day, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toDateString();
      const isToday = dateStr === today.toDateString();
      let run = 0, bike = 0, swim = 0;
      enduranceSessions
        .filter(s => new Date(s.date).toDateString() === dateStr)
        .forEach(s => {
          if (s.sport === 'run') run += s.metrics.distance || 0;
          else if (s.sport === 'bike') bike += s.metrics.distance || 0;
          else swim += ((s.metrics.totalDistance || 0) / 1760);
        });
      return { day, run, bike, swim, isToday };
    });
  }, [enduranceSessions]);

  const sportDistribution = useMemo(() => {
    const totalTime = { run: 0, bike: 0, swim: 0 };
    enduranceSessions.forEach(s => { totalTime[s.sport] += s.metrics.totalTime || 0; });
    const total = totalTime.run + totalTime.bike + totalTime.swim;
    if (total === 0) return [];
    return SPORT_TABS.map(s => ({
      ...s,
      time: Math.round(totalTime[s.key]),
      pct: Math.round((totalTime[s.key] / total) * 100),
    }));
  }, [enduranceSessions]);

  // === GARMIN SPLIT ANALYSIS ===

  const garminAnalysis = useMemo(() => {
    if (!garminActivities || garminActivities.length === 0) return [];
    return garminActivities
      .map(a => analyzeGarminSplits(a))
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [garminActivities]);

  const garminIntervalWorkouts = useMemo(() => {
    return garminAnalysis.filter(a => a.workoutType === 'interval' && a.intervals);
  }, [garminAnalysis]);

  const garminByType = useMemo(() => {
    const byType = { run: [], swim: [], bike: [] };
    garminAnalysis.forEach(a => { if (byType[a.type]) byType[a.type].push(a); });
    return byType;
  }, [garminAnalysis]);

  // Available interval distances for filter
  const availableDistances = useMemo(() => {
    const dists = new Set();
    garminIntervalWorkouts
      .filter(w => w.type === enduranceSportTab)
      .forEach(w => dists.add(w.intervals.distance));
    return [...dists].sort((a, b) => a - b);
  }, [garminIntervalWorkouts, enduranceSportTab]);

  // Interval progression data (filtered by sport tab and distance)
  const intervalProgressionData = useMemo(() => {
    let workouts = garminIntervalWorkouts.filter(w => w.type === enduranceSportTab);
    if (intervalDistFilter !== 'all') {
      workouts = workouts.filter(w => w.intervals.distance === Number(intervalDistFilter));
    }
    return filterByRange(workouts.map(w => {
      const d = new Date(w.date);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const isSwim = w.type === 'swim';
      // For chart: use avg interval duration in seconds for consistent comparison
      const avgDuration = w.intervals.splits.reduce((s, sp) => s + sp.duration, 0) / w.intervals.splits.length;
      return {
        date: label,
        fullDate: w.date,
        avgDuration,
        avgPace: w.intervals.avgPace,
        bestPace: w.intervals.bestPace,
        label: w.intervals.label,
        avgHR: w.intervals.avgHR,
        count: w.intervals.count,
        distance: w.intervals.distance,
      };
    }));
  }, [garminIntervalWorkouts, enduranceSportTab, intervalDistFilter, timeRange]);

  // Pace trend data (all runs/swims, not just intervals)
  const garminPaceTrend = useMemo(() => {
    const activities = garminByType[enduranceSportTab] || [];
    return filterByRange(activities.map(a => {
      const d = new Date(a.date);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      return {
        date: label,
        fullDate: a.date,
        avgPace: a.avgPace,
        workoutType: a.workoutType,
        intervalPace: a.intervals ? a.intervals.avgPace : null,
      };
    }));
  }, [garminByType, enduranceSportTab, timeRange]);

  // Personal records from intervals
  const intervalPRs = useMemo(() => {
    const prs = {};
    garminIntervalWorkouts
      .filter(w => w.type === enduranceSportTab)
      .forEach(w => {
        const dist = w.intervals.distance;
        w.intervals.splits.forEach(s => {
          if (!prs[dist] || s.pace > prs[dist].pace) {
            prs[dist] = { pace: s.pace, duration: s.duration, distance: s.distance, date: w.date, hr: s.hr };
          }
        });
      });
    return Object.entries(prs)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([dist, pr]) => ({ distance: Number(dist), ...pr }));
  }, [garminIntervalWorkouts, enduranceSportTab]);

  // Split comparison table data
  const splitTableData = useMemo(() => {
    let workouts = garminIntervalWorkouts.filter(w => w.type === enduranceSportTab);
    return filterByRange(workouts.map(w => ({
      ...w,
      fullDate: w.date,
    }))).reverse(); // Most recent first
  }, [garminIntervalWorkouts, enduranceSportTab, timeRange]);

  const hasGarminEnduranceData = garminByType[enduranceSportTab]?.length > 0;

  if (workoutHistory.length === 0 && garminActivities.length === 0) {
    return (
      <div className="px-5 pt-2 pb-32 bg-black min-h-screen flex flex-col items-center justify-center text-center">
        <BarChart3 size={48} className="text-[#333333] mx-auto mb-4" />
        <p className="text-[17px] text-[#555555] mb-2">Log workouts to see your stats</p>
        <p className="text-[13px] text-[#444444]">Complete your first workout to unlock charts and trends</p>
      </div>
    );
  }

  const currentPBs = endurancePBs[selectedSport] || {};

  return (
    <div className="px-5 pt-4 pb-32 min-h-screen bg-black space-y-3">
      {/* Title handled by App header */}

      {/* VIEW TOGGLE */}
      <div className="flex bg-[#1A1A1A] rounded-xl p-1">
        <button
          onClick={() => setStatsView('strength')}
          className={`flex-1 py-2.5 min-h-[40px] rounded-lg text-[13px] font-semibold transition-colors ${
            activeView === 'strength' ? 'bg-white/10 text-white' : 'text-[#555555]'
          }`}
        >
          Strength
        </button>
        <button
          onClick={() => setStatsView('endurance')}
          className={`flex-1 py-2.5 min-h-[40px] rounded-lg text-[13px] font-semibold transition-colors ${
            activeView === 'endurance' ? 'bg-white/10 text-white' : 'text-[#555555]'
          }`}
        >
          Endurance
        </button>
        <button
          onClick={() => setStatsView('activity')}
          className={`flex-1 py-2.5 min-h-[40px] rounded-lg text-[13px] font-semibold transition-colors ${
            activeView === 'activity' ? 'bg-white/10 text-white' : 'text-[#555555]'
          }`}
        >
          Activity
        </button>
      </div>

      {activeView === 'strength' && (
        <>
          {/* STRENGTH JOURNEY */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Strength Journey</h2>

            {/* Lift tabs */}
            <div className="flex gap-2 mb-4">
              {LIFT_TABS.map(lift => (
                <button
                  key={lift.name}
                  onClick={() => setSelectedLift(lift.name)}
                  className={`px-4 py-2 min-h-[40px] rounded-xl text-[13px] font-medium transition-colors ${
                    selectedLift === lift.name
                      ? 'bg-accent-blue text-white'
                      : 'bg-[#1A1A1A] text-[#666666]'
                  }`}
                >
                  <span className="flex items-center gap-1.5"><LiftIcon name={lift.name} size={15} color={selectedLift === lift.name ? '#fff' : '#666'} />{lift.short}</span>
                </button>
              ))}
            </div>

            {/* Time range toggles */}
            <div className="flex gap-2 mb-4">
              {TIME_RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[12px] font-medium transition-colors ${
                    timeRange === r ? 'bg-white/10 text-white' : 'text-[#555555]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {chartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px', color: '#fff' }} labelStyle={{ color: '#999' }} itemStyle={{ color: '#fff' }}
                      formatter={(value, name) => [`${value} lbs`, name === 'e1rm' ? 'E1RM' : 'Weight']}
                    />
                    <Line type="monotone" dataKey="weight" stroke={LIFT_COLORS[selectedLift]} strokeWidth={2} dot={{ r: 4, fill: LIFT_COLORS[selectedLift] }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                    <Line type="monotone" dataKey="e1rm" stroke={LIFT_COLORS[selectedLift]} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>

                {/* Personal Best */}
                {personalBest && (
                  <div className="flex items-center justify-between mt-4 p-3 bg-[#1A1A1A] rounded-xl">
                    <span className="text-[13px] text-[#666666]">Personal Best</span>
                    <span className="text-[17px] font-bold text-accent-amber">
                      {personalBest.weight} lbs <span className="text-[13px] font-medium text-[#666666]">x{personalBest.reps}</span>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-[13px] text-[#555555] py-8">No data for this lift in this time range.</p>
            )}
          </div>

          {/* VOLUME THIS WEEK */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Volume This Week</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={volumeWeek} barCategoryGap="20%">
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px', color: '#fff' }} labelStyle={{ color: '#999' }} itemStyle={{ color: '#fff' }}
                  formatter={(value) => [`${value.toLocaleString()} lbs`, 'Tonnage']}
                />
                <Bar dataKey="tonnage" radius={[4, 4, 0, 0]}>
                  {volumeWeek.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isToday ? '#3B82F6' : (TYPE_BAR_COLORS[entry.type] || '#333333')}
                      opacity={entry.tonnage === 0 ? 0.15 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* BODY BALANCE */}
          {muscleBalance.length > 0 && (
            <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
              <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Body Balance</h2>
              <div className="space-y-3">
                {muscleBalance.map(m => (
                  <div key={m.key} className="min-h-[40px] flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] text-[#A0A0A0]">{m.label}</span>
                      <span className="text-[11px] text-[#555555]">{m.points} pts</span>
                    </div>
                    <div className="bg-[#1A1A1A] h-3 rounded-full overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{ width: `${m.pct}%`, backgroundColor: m.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONSISTENCY GRID */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Streak & Consistency</h2>
            <p className="text-[11px] text-[#555555] mb-3">Last 12 weeks</p>
            <div className="grid grid-cols-12 gap-1.5">
              {weeklyConsistency.map((w, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-sm"
                  style={{
                    backgroundColor: w.pct === 0 ? '#1a1a1a' :
                      w.pct <= 33 ? '#F59E0B33' :
                      w.pct <= 66 ? '#F59E0B80' :
                      w.pct <= 99 ? '#10B98180' : '#10B981',
                  }}
                  title={`${w.logged}/${w.planned} workouts (${w.pct}%)`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 text-[11px] text-[#555555]">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#1a1a1a' }} />
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#F59E0B33' }} />
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#F59E0B80' }} />
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#10B98180' }} />
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#10B981' }} />
              </div>
              <span>More</span>
            </div>
          </div>
        </>
      )}

      {activeView === 'endurance' && (
        <>
          {/* ENDURANCE OVERVIEW */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Endurance Overview</h2>
            {enduranceSessions.length === 0 ? (
              <p className="text-center text-[13px] text-[#555555] py-8">Log endurance workouts to see stats</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold mb-2">Run</div>
                  <p className="text-[17px] font-bold text-white">{enduranceOverview.run.distance.toFixed(1)}<span className="text-[11px] text-[#666666] font-normal"> mi</span></p>
                  <p className="text-[11px] text-[#555555] mt-1">
                    {enduranceOverview.run.count > 0 ? `${formatPaceLocal(enduranceOverview.run.paceSum / enduranceOverview.run.count)} /mi avg` : 'No data'}
                  </p>
                </div>
                <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold mb-2">Bike</div>
                  <p className="text-[17px] font-bold text-white">{enduranceOverview.bike.distance.toFixed(1)}<span className="text-[11px] text-[#666666] font-normal"> mi</span></p>
                  <p className="text-[11px] text-[#555555] mt-1">
                    {enduranceOverview.bike.count > 0 ? `${Math.round(enduranceOverview.bike.powerSum / enduranceOverview.bike.count)}W avg` : 'No data'}
                  </p>
                </div>
                <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold mb-2">Swim</div>
                  <p className="text-[17px] font-bold text-white">{enduranceOverview.swim.distance.toLocaleString()}<span className="text-[11px] text-[#666666] font-normal"> yds</span></p>
                  <p className="text-[11px] text-[#555555] mt-1">
                    {enduranceOverview.swim.count > 0 ? `${Math.round(enduranceOverview.swim.paceSum / enduranceOverview.swim.count)}s /100y avg` : 'No data'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ENDURANCE TRENDS */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Endurance Trends</h2>

            {/* Sport tabs */}
            <div className="flex gap-2 mb-4">
              {SPORT_TABS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSelectedSport(s.key)}
                  className={`px-4 py-2 min-h-[40px] rounded-xl text-[13px] font-medium transition-colors ${
                    selectedSport === s.key ? 'text-white' : 'bg-[#1A1A1A] text-[#666666]'
                  }`}
                  style={selectedSport === s.key ? { backgroundColor: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Time range */}
            <div className="flex gap-2 mb-4">
              {TIME_RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[12px] font-medium transition-colors ${
                    timeRange === r ? 'bg-white/10 text-white' : 'text-[#555555]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {enduranceTrendData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={enduranceTrendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#666666' }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      reversed={selectedSport !== 'bike'}
                      tickFormatter={v => selectedSport === 'bike' ? `${v}W` : selectedSport === 'run' ? formatPaceLocal(v) : `${Math.round(v)}s`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px', color: '#fff' }} labelStyle={{ color: '#999' }} itemStyle={{ color: '#fff' }}
                      formatter={(value, name) => {
                        if (name === 'pace') return [selectedSport === 'run' ? `${formatPaceLocal(value)} /mi` : `${Math.round(value)}s /100y`, 'Pace'];
                        if (name === 'power') return [`${value}W`, 'Avg Power'];
                        if (name === 'distance') return [selectedSport === 'swim' ? `${value} yds` : `${value} mi`, 'Distance'];
                        return [value, name];
                      }}
                    />
                    {selectedSport === 'bike' ? (
                      <Line type="monotone" dataKey="power" stroke={SPORT_COLORS.bike} strokeWidth={2} dot={{ r: 4, fill: SPORT_COLORS.bike }} connectNulls />
                    ) : (
                      <Line type="monotone" dataKey="pace" stroke={SPORT_COLORS[selectedSport]} strokeWidth={2} dot={{ r: 4, fill: SPORT_COLORS[selectedSport] }} connectNulls />
                    )}
                  </LineChart>
                </ResponsiveContainer>

                {/* Personal Bests */}
                <div className="mt-4 space-y-2">
                  {selectedSport === 'run' && (
                    <>
                      <div className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl">
                        <span className="text-[13px] text-[#666666]">Fastest Pace</span>
                        <span className="text-[15px] font-bold" style={{ color: SPORT_COLORS.run }}>
                          {currentPBs.fastestPace ? `${formatPaceLocal(currentPBs.fastestPace)} /mi` : '--'}
                        </span>
                      </div>
                      {currentPBs.longestDist && (
                        <div className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl">
                          <span className="text-[13px] text-[#666666]">Longest Run</span>
                          <span className="text-[15px] font-bold" style={{ color: SPORT_COLORS.run }}>{currentPBs.longestDist} mi</span>
                        </div>
                      )}
                    </>
                  )}
                  {selectedSport === 'bike' && (
                    <>
                      <div className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl">
                        <span className="text-[13px] text-[#666666]">Highest Avg Power</span>
                        <span className="text-[15px] font-bold" style={{ color: SPORT_COLORS.bike }}>
                          {currentPBs.highestPower ? `${currentPBs.highestPower}W` : '--'}
                        </span>
                      </div>
                      {currentPBs.longestDist && (
                        <div className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl">
                          <span className="text-[13px] text-[#666666]">Longest Ride</span>
                          <span className="text-[15px] font-bold" style={{ color: SPORT_COLORS.bike }}>{currentPBs.longestDist} mi</span>
                        </div>
                      )}
                    </>
                  )}
                  {selectedSport === 'swim' && (
                    <>
                      <div className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl">
                        <span className="text-[13px] text-[#666666]">Fastest Pace</span>
                        <span className="text-[15px] font-bold" style={{ color: SPORT_COLORS.swim }}>
                          {currentPBs.fastestPace ? `${Math.round(currentPBs.fastestPace)}s /100y` : '--'}
                        </span>
                      </div>
                      {currentPBs.longestDist && (
                        <div className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl">
                          <span className="text-[13px] text-[#666666]">Longest Swim</span>
                          <span className="text-[15px] font-bold" style={{ color: SPORT_COLORS.swim }}>{currentPBs.longestDist.toLocaleString()} yds</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="text-center text-[13px] text-[#555555] py-8">Log endurance workouts to see trends</p>
            )}
          </div>

          {/* WEEKLY ENDURANCE VOLUME */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Weekly Endurance Volume</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={enduranceWeekVolume} barCategoryGap="20%">
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} width={35} tickFormatter={v => `${v.toFixed(1)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px', color: '#fff' }} labelStyle={{ color: '#999' }} itemStyle={{ color: '#fff' }}
                  formatter={(value, name) => [`${value.toFixed(2)} mi`, name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                <Bar dataKey="run" stackId="endurance" fill={SPORT_COLORS.run} />
                <Bar dataKey="bike" stackId="endurance" fill={SPORT_COLORS.bike} />
                <Bar dataKey="swim" stackId="endurance" fill={SPORT_COLORS.swim} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-3">
              {SPORT_TABS.map(s => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[11px] text-[#666666]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SPORT DISTRIBUTION */}
          {sportDistribution.length > 0 && (
            <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
              <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Sport Distribution</h2>
              <div className="space-y-3">
                {sportDistribution.map(s => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] text-[#A0A0A0]">{s.label}</span>
                      <span className="text-[11px] text-[#555555]">{s.pct}% &middot; {s.time} min</span>
                    </div>
                    <div className="bg-[#1A1A1A] h-3 rounded-full overflow-hidden">
                      <div className="h-3 rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ GARMIN SPLIT ANALYSIS ═══ */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Timer size={14} className="text-[#555555]" />
              <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Interval Progression</h2>
            </div>

            {/* Sport sub-tabs */}
            <div className="flex gap-2 mb-4">
              {SPORT_TABS.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setEnduranceSportTab(s.key); setIntervalDistFilter('all'); }}
                  className={`px-4 py-2 min-h-[40px] rounded-xl text-[13px] font-medium transition-colors ${
                    enduranceSportTab === s.key ? 'text-white' : 'bg-[#1A1A1A] text-[#666666]'
                  }`}
                  style={enduranceSportTab === s.key ? { backgroundColor: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Distance filter */}
            {availableDistances.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => setIntervalDistFilter('all')}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[12px] font-medium transition-colors ${
                    intervalDistFilter === 'all' ? 'bg-white/10 text-white' : 'text-[#555555]'
                  }`}
                >
                  All
                </button>
                {availableDistances.map(d => (
                  <button
                    key={d}
                    onClick={() => setIntervalDistFilter(String(d))}
                    className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[12px] font-medium transition-colors ${
                      intervalDistFilter === String(d) ? 'bg-white/10 text-white' : 'text-[#555555]'
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            )}

            {/* Time range */}
            <div className="flex gap-2 mb-4">
              {TIME_RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[12px] font-medium transition-colors ${
                    timeRange === r ? 'bg-white/10 text-white' : 'text-[#555555]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {intervalProgressionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={intervalProgressionData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#666666' }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    reversed
                    tickFormatter={v => formatDurationCompact(v)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                    labelStyle={{ color: '#999' }}
                    formatter={(value, name) => {
                      if (name === 'avgDuration') return [formatDurationCompact(value), 'Avg Interval Time'];
                      return [value, name];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgDuration"
                    stroke={SPORT_COLORS[enduranceSportTab]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: SPORT_COLORS[enduranceSportTab] }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-[13px] text-[#555555] py-8">
                {hasGarminEnduranceData ? 'No interval workouts detected in this range' : 'No Garmin data yet — sync to see split analysis'}
              </p>
            )}
          </div>

          {/* PACE TREND (all workouts) */}
          {garminPaceTrend.length > 0 && (
            <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
              <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">
                {enduranceSportTab === 'swim' ? 'Swim' : enduranceSportTab === 'bike' ? 'Bike' : 'Run'} Pace Trend
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={garminPaceTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#666666' }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                    reversed={enduranceSportTab !== 'bike'}
                    tickFormatter={v => {
                      if (enduranceSportTab === 'swim') return formatSwimPace(v > 0 ? 100 / v : 0);
                      return formatPace(v);
                    }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                    labelStyle={{ color: '#999' }}
                    formatter={(value, name) => {
                      if (name === 'avgPace') {
                        if (enduranceSportTab === 'swim') return [formatSwimPace(value > 0 ? 100 / value : 0), 'Avg Pace'];
                        return [formatPace(value), 'Avg Pace'];
                      }
                      if (name === 'intervalPace') {
                        if (enduranceSportTab === 'swim') return [formatSwimPace(value > 0 ? 100 / value : 0), 'Interval Pace'];
                        return [formatPace(value), 'Interval Pace'];
                      }
                      return [value, name];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgPace"
                    stroke={SPORT_COLORS[enduranceSportTab]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: SPORT_COLORS[enduranceSportTab] }}
                    connectNulls
                    name="avgPace"
                  />
                  <Line
                    type="monotone"
                    dataKey="intervalPace"
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: '#EF4444' }}
                    connectNulls
                    name="intervalPace"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 rounded" style={{ backgroundColor: SPORT_COLORS[enduranceSportTab] }} />
                  <span className="text-[11px] text-[#666666]">Avg Pace</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 rounded border-dashed" style={{ borderTop: '2px dashed #EF4444' }} />
                  <span className="text-[11px] text-[#666666]">Interval Pace</span>
                </div>
              </div>
            </div>
          )}

          {/* SPLIT COMPARISON TABLE */}
          {splitTableData.length > 0 && (
            <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
              <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Interval Workouts</h2>
              <div className="space-y-2">
                {splitTableData.map((w, wi) => {
                  const d = new Date(w.date);
                  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
                  const isExpanded = expandedInterval === wi;
                  const isSwim = w.type === 'swim';
                  return (
                    <div key={wi}>
                      <button
                        onClick={() => setExpandedInterval(isExpanded ? null : wi)}
                        className="flex items-center w-full p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                      >
                        <span className="text-[12px] text-[#555] w-12 shrink-0">{dateLabel}</span>
                        <span className="text-[13px] font-semibold mr-2" style={{ color: SPORT_COLORS[w.type] }}>
                          {w.intervals.label}
                        </span>
                        <span className="text-[12px] text-[#888] flex-1 text-left">
                          {isSwim
                            ? formatSwimPace(w.intervals.avgPace > 0 ? 100 / w.intervals.avgPace : 0)
                            : formatPace(w.intervals.avgPace)
                          } avg
                        </span>
                        {w.intervals.avgHR > 0 && (
                          <span className="text-[11px] text-[#666] mr-2">{w.intervals.avgHR} bpm</span>
                        )}
                        {isExpanded ? <ChevronUp size={14} className="text-[#555]" /> : <ChevronDown size={14} className="text-[#555]" />}
                      </button>

                      {isExpanded && (
                        <div className="ml-4 mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <div className="grid grid-cols-4 gap-1 mb-2 text-[10px] uppercase text-[#555] font-semibold">
                            <span>Split</span>
                            <span>Pace</span>
                            <span>Time</span>
                            <span>HR</span>
                          </div>
                          {w.intervals.splits.map((s, si) => (
                            <div key={si} className="grid grid-cols-4 gap-1 py-1.5 border-t border-white/[0.04]">
                              <span className="text-[12px] text-[#888]">#{si + 1}</span>
                              <span className="text-[12px] font-medium text-white">
                                {isSwim
                                  ? formatSwimPace(s.pace > 0 ? 100 / s.pace : 0)
                                  : formatPace(s.pace)
                                }
                              </span>
                              <span className="text-[12px] text-[#888]">{formatDurationCompact(s.duration)}</span>
                              <span className="text-[12px] text-[#888]">{s.hr > 0 ? `${s.hr}` : '—'}</span>
                            </div>
                          ))}
                          <div className="grid grid-cols-4 gap-1 pt-2 border-t border-white/[0.08] mt-1">
                            <span className="text-[11px] text-[#666] font-semibold">Best</span>
                            <span className="text-[12px] font-bold" style={{ color: SPORT_COLORS[w.type] }}>
                              {isSwim
                                ? formatSwimPace(w.intervals.bestPace > 0 ? 100 / w.intervals.bestPace : 0)
                                : formatPace(w.intervals.bestPace)
                              }
                            </span>
                            <span className="text-[12px] text-[#888]">
                              {formatDurationCompact(Math.min(...w.intervals.splits.map(s => s.duration)))}
                            </span>
                            <span />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* INTERVAL PERSONAL RECORDS */}
          {intervalPRs.length > 0 && (
            <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={14} className="text-amber-500" />
                <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold">Interval PRs</h2>
              </div>
              <div className="space-y-2">
                {intervalPRs.map(pr => {
                  const d = new Date(pr.date);
                  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
                  const isSwim = enduranceSportTab === 'swim';
                  return (
                    <div key={pr.distance} className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl">
                      <div>
                        <span className="text-[14px] font-semibold text-white">{pr.distance}m</span>
                        <span className="text-[11px] text-[#555] ml-2">{dateLabel}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[15px] font-bold" style={{ color: SPORT_COLORS[enduranceSportTab] }}>
                          {isSwim
                            ? formatSwimPace(pr.pace > 0 ? 100 / pr.pace : 0)
                            : formatPace(pr.pace)
                          }
                        </span>
                        <span className="text-[11px] text-[#666] ml-2">{formatDurationCompact(pr.duration)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {activeView === 'activity' && (
        <ActivityTab
          whoopConnected={whoopConnected}
          whoopWorkouts={whoopData?.workout || []}
          whoopCycles={whoopData?.cycle || []}
          workoutHistory={workoutHistory}
          expandedActivity={expandedActivity}
          setExpandedActivity={setExpandedActivity}
        />
      )}
    </div>
  );
}

const CHART_METRICS = [
  { key: 'strain', label: 'Strain' },
  { key: 'avgHR', label: 'Avg HR' },
  { key: 'calories', label: 'Calories' },
];
const CHART_RANGES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function ActivityTab({ whoopConnected, whoopWorkouts, whoopCycles, workoutHistory, expandedActivity, setExpandedActivity }) {
  const [chartMetric, setChartMetric] = useState('strain');
  const [chartRange, setChartRange] = useState('daily');

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const todayWorkouts = useMemo(() => {
    return whoopWorkouts.filter(w => {
      const key = w.date || (w.start ? w.start.split('T')[0] : null);
      return key === todayStr;
    });
  }, [whoopWorkouts, todayStr]);

  // Build cycle calorie lookup (date → total daily kcal) from cycle data
  const cycleCals = useMemo(() => {
    const map = {};
    for (const c of whoopCycles) {
      const dk = c.date || (c.start ? c.start.split('T')[0] : null);
      if (dk && c.score?.kilojoule) map[dk] = Math.round(c.score.kilojoule * 0.239006);
    }
    return map;
  }, [whoopCycles]);

  // Configurable chart data
  const chartData = useMemo(() => {
    const now = new Date();
    const getDateKey = (w) => w.date || (w.start ? w.start.split('T')[0] : null);
    
    const getCalories = (keys) => {
      // Use cycle (total daily) calories, not workout calories
      const vals = keys.map(k => cycleCals[k]).filter(Boolean);
      return vals.reduce((s, v) => s + v, 0);
    };
    const getAvgCalories = (keys) => {
      const vals = keys.map(k => cycleCals[k]).filter(Boolean);
      return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    };

    if (chartRange === 'daily') {
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        const matching = whoopWorkouts.filter(w => getDateKey(w) === key && w.score);
        let value = 0;
        if (chartMetric === 'strain') {
          value = matching.reduce((s, w) => s + (w.score?.strain || 0), 0);
        } else if (chartMetric === 'avgHR') {
          const hrs = matching.filter(w => w.score?.average_heart_rate).map(w => w.score.average_heart_rate);
          value = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
        } else {
          value = cycleCals[key] || 0;
        }
        days.push({ label: dayLabel, value: Math.round(value * 10) / 10, isToday: i === 0 });
      }
      return days;
    }

    if (chartRange === 'weekly') {
      const weeks = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        // Collect all date keys in this week
        const weekKeys = [];
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
          weekKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        const matching = whoopWorkouts.filter(w => {
          const dk = getDateKey(w);
          return dk && w.score && weekKeys.includes(dk);
        });
        let value = 0;
        if (chartMetric === 'strain') {
          value = matching.reduce((s, w) => s + (w.score?.strain || 0), 0);
        } else if (chartMetric === 'avgHR') {
          const hrs = matching.filter(w => w.score?.average_heart_rate).map(w => w.score.average_heart_rate);
          value = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
        } else {
          value = getAvgCalories(weekKeys);
        }
        weeks.push({ label, value: Math.round(value * 10) / 10, isToday: i === 0 });
      }
      return weeks;
    }

    // monthly
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      const mKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      const label = m.toLocaleString('default', { month: 'short' });
      // Collect all date keys in this month
      const monthKeys = [];
      for (let d = 1; d <= mEnd.getDate(); d++) {
        monthKeys.push(`${mKey}-${String(d).padStart(2, '0')}`);
      }
      const matching = whoopWorkouts.filter(w => {
        const dk = getDateKey(w);
        return dk && w.score && dk.startsWith(mKey);
      });
      let value = 0;
      if (chartMetric === 'strain') {
        value = matching.reduce((s, w) => s + (w.score?.strain || 0), 0);
      } else if (chartMetric === 'avgHR') {
        const hrs = matching.filter(w => w.score?.average_heart_rate).map(w => w.score.average_heart_rate);
        value = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
      } else {
        value = getAvgCalories(monthKeys);
      }
      months.push({ label, value: Math.round(value * 10) / 10, isToday: i === 0 });
    }
    return months;
  }, [whoopWorkouts, whoopCycles, cycleCals, chartMetric, chartRange]);

  // Activity history - last 30 days grouped by week
  const activityHistory = useMemo(() => {
    const sorted = [...whoopWorkouts]
      .filter(w => w.score)
      .sort((a, b) => new Date(b.start || b.date) - new Date(a.start || a.date))
      .slice(0, 60);

    const weeks = [];
    let currentWeekLabel = null;
    let currentWeek = [];

    for (const w of sorted) {
      const d = new Date(w.start || w.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const label = `Week of ${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      if (label !== currentWeekLabel) {
        if (currentWeek.length > 0) weeks.push({ label: currentWeekLabel, items: currentWeek });
        currentWeekLabel = label;
        currentWeek = [];
      }
      currentWeek.push(w);
    }
    if (currentWeek.length > 0) weeks.push({ label: currentWeekLabel, items: currentWeek });

    return weeks;
  }, [whoopWorkouts]);

  // Strain by sport
  const strainBySport = useMemo(() => {
    const map = {};
    for (const w of whoopWorkouts) {
      if (!w.score?.strain) continue;
      const id = w.sport_id;
      if (!map[id]) map[id] = { totalStrain: 0, count: 0, sport_id: id };
      map[id].totalStrain += w.score.strain;
      map[id].count++;
    }
    return Object.values(map)
      .map(s => ({ ...s, avgStrain: Math.round((s.totalStrain / s.count) * 10) / 10 }))
      .sort((a, b) => b.count - a.count);
  }, [whoopWorkouts]);

  if (!whoopConnected) {
    return (
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5 text-center">
        <p className="text-[15px] text-[#555555]">Connect Whoop in Settings to see activity data</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* TODAY'S ACTIVITY */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
        <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Today's Activity</h2>
        {todayWorkouts.length === 0 ? (
          <p className="text-[13px] text-[#555555] text-center py-4">No Whoop activity detected today</p>
        ) : (
          <div className="space-y-3">
            {todayWorkouts.map((w, i) => {
              const strain = w.score?.strain || 0;
              const avgHR = w.score?.average_heart_rate;
              const distM = w.score?.distance_meter;
              const kj = w.score?.kilojoule;
              const durationMs = w.start && w.end ? new Date(w.end) - new Date(w.start) : 0;
              const zd = w.score?.zone_duration || {};
              const totalZone = ZONE_KEYS.reduce((s, k) => s + (zd[k] || 0), 0);

              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {(() => { const Icon = getSportIcon(w.sport_id, w); const c = getSportColor(w.sport_id); return (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c + '15' }}>
                          <Icon size={16} color={c} strokeWidth={2} />
                        </div>
                      ); })()}
                      <span className="text-[15px] font-medium text-white">{getSportName(w.sport_id, w)}</span>
                    </div>
                    <span className="text-[13px] text-[#777]">{formatDuration(durationMs)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div>
                      <div className="text-[10px] uppercase text-[#555] mb-0.5">Strain</div>
                      <div className="text-[17px] font-bold" style={{ color: strainColor(strain) }}>{strain.toFixed(1)}</div>
                    </div>
                    {avgHR && (
                      <div>
                        <div className="text-[10px] uppercase text-[#555] mb-0.5">Avg HR</div>
                        <div className="text-[15px] font-semibold text-white">{avgHR}</div>
                      </div>
                    )}
                    {distM && (
                      <div>
                        <div className="text-[10px] uppercase text-[#555] mb-0.5">Distance</div>
                        <div className="text-[15px] font-semibold text-white">{(distM * 0.000621371).toFixed(1)} mi</div>
                      </div>
                    )}
                    {kj && (
                      <div>
                        <div className="text-[10px] uppercase text-[#555] mb-0.5">Calories</div>
                        <div className="text-[15px] font-semibold text-white">{Math.round(kj * 0.239)}</div>
                      </div>
                    )}
                  </div>
                  {/* HR Zone bar */}
                  {totalZone > 0 && (
                    <div>
                      <div className="flex h-3 rounded-full overflow-hidden">
                        {ZONE_KEYS.map((k, zi) => {
                          const pct = ((zd[k] || 0) / totalZone) * 100;
                          if (pct === 0) return null;
                          return (
                            <div key={zi} style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS[zi] }} className="relative">
                              {pct > 10 && (
                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-white/70 font-medium">
                                  {Math.round(pct)}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1.5">
                        {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map((label, zi) => (
                          <span key={label} className="text-[8px] font-medium" style={{ color: ZONE_COLORS[zi] }}>{label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONFIGURABLE CHART */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
        {/* Metric toggle */}
        <div className="flex gap-1 mb-4 bg-white/[0.04] rounded-xl p-1">
          {CHART_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setChartMetric(m.key)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                chartMetric === m.key
                  ? 'bg-white text-black shadow-md'
                  : 'text-[#666] active:bg-white/[0.06]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {/* Time range toggle */}
        <div className="flex gap-1 mb-4 bg-white/[0.04] rounded-lg p-1">
          {CHART_RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setChartRange(r.key)}
              className={`flex-1 py-2 rounded-md text-[12px] font-semibold transition-all ${
                chartRange === r.key
                  ? 'bg-white/[0.12] text-white'
                  : 'text-[#555] active:bg-white/[0.06]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barCategoryGap="20%">
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', fontSize: '13px', padding: '8px 12px', color: '#fff' }} labelStyle={{ color: '#999' }} itemStyle={{ color: '#fff' }}
              labelStyle={{ color: '#888', fontSize: '11px', marginBottom: '2px' }}
              formatter={(value) => {
                const unit = chartMetric === 'strain' ? '' : chartMetric === 'avgHR' ? ' bpm' : ' kcal';
                const label = chartMetric === 'strain' ? 'Strain' : chartMetric === 'avgHR' ? 'Avg HR' : (chartRange === 'daily' ? 'Total Calories' : 'Avg Daily Cal');
                return [`${value.toLocaleString()}${unit}`, label];
              }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isToday ? '#3B82F6' : chartMetric === 'strain' ? strainColor(entry.value) : chartMetric === 'avgHR' ? '#8B5CF6' : '#F59E0B'}
                  opacity={entry.value === 0 ? 0.15 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* STRAIN BY SPORT */}
      {strainBySport.length > 0 && (
        <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
          <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Strain by Sport</h2>
          <div className="space-y-3">
            {strainBySport.map(s => {
              const maxStrain = Math.max(...strainBySport.map(x => x.avgStrain), 1);
              const pct = Math.round((s.avgStrain / maxStrain) * 100);
              return (
                <div key={s.sport_id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {(() => { const Icon = getSportIcon(s.sport_id, s); const c = getSportColor(s.sport_id); return <Icon size={14} color={c} strokeWidth={2} />; })()}
                      <span className="text-[13px] text-[#A0A0A0]">{getSportName(s.sport_id, s)}</span>
                    </div>
                    <span className="text-[11px] text-[#555555]">avg {s.avgStrain} · {s.count} sessions</span>
                  </div>
                  <div className="bg-[#1A1A1A] h-3 rounded-full overflow-hidden">
                    <div
                      className="h-3 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: getSportColor(s.sport_id) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVITY HISTORY */}
      {activityHistory.length > 0 && (
        <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
          <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Activity History</h2>
          <div className="space-y-4">
            {activityHistory.map((week, wi) => (
              <div key={wi}>
                <div className="text-[11px] text-[#555555] font-medium mb-2">{week.label}</div>
                <div className="space-y-1.5">
                  {week.items.map((w, i) => {
                    const strain = w.score?.strain || 0;
                    const avgHR = w.score?.average_heart_rate;
                    const durationMs = w.start && w.end ? new Date(w.end) - new Date(w.start) : 0;
                    const d = new Date(w.start || w.date);
                    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
                    const itemKey = `${wi}-${i}`;
                    const isExpanded = expandedActivity === itemKey;
                    const zd = w.score?.zone_duration || {};
                    const totalZone = ZONE_KEYS.reduce((s, k) => s + (zd[k] || 0), 0);
                    const maxHR = w.score?.max_heart_rate;
                    const distM = w.score?.distance_meter;
                    const kj = w.score?.kilojoule;

                    return (
                      <div key={i}>
                        <button
                          onClick={() => setExpandedActivity(isExpanded ? null : itemKey)}
                          className="flex items-center w-full p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                        >
                          <span className="text-[12px] text-[#555] w-10 shrink-0">{dateLabel}</span>
                          {(() => { const Icon = getSportIcon(w.sport_id, w); return <Icon size={14} color={getSportColor(w.sport_id)} strokeWidth={2} className="mr-1.5 shrink-0" />; })()}
                          <span className="text-[13px] text-white font-medium flex-1 text-left">{getSportName(w.sport_id, w)}</span>
                          <span className="text-[13px] font-semibold mr-3" style={{ color: strainColor(strain) }}>{strain.toFixed(1)}</span>
                          <span className="text-[12px] text-[#555] mr-2">{formatDuration(durationMs)}</span>
                          {isExpanded ? <ChevronUp size={14} className="text-[#555]" /> : <ChevronDown size={14} className="text-[#555]" />}
                        </button>

                        {isExpanded && (
                          <div className="ml-10 mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              {avgHR && (
                                <div>
                                  <div className="text-[10px] uppercase text-[#555] mb-0.5">Avg HR</div>
                                  <div className="text-[14px] font-semibold text-white">{avgHR} bpm</div>
                                </div>
                              )}
                              {maxHR && (
                                <div>
                                  <div className="text-[10px] uppercase text-[#555] mb-0.5">Max HR</div>
                                  <div className="text-[14px] font-semibold text-white">{maxHR} bpm</div>
                                </div>
                              )}
                              {distM && (
                                <div>
                                  <div className="text-[10px] uppercase text-[#555] mb-0.5">Distance</div>
                                  <div className="text-[14px] font-semibold text-white">{(distM * 0.000621371).toFixed(1)} mi</div>
                                </div>
                              )}
                              {kj && (
                                <div>
                                  <div className="text-[10px] uppercase text-[#555] mb-0.5">Calories</div>
                                  <div className="text-[14px] font-semibold text-white">{Math.round(kj * 0.239)} kcal</div>
                                </div>
                              )}
                            </div>
                            {totalZone > 0 && (
                              <div>
                                <div className="text-[10px] uppercase text-[#555] mb-1">HR Zones</div>
                                <div className="flex h-2.5 rounded-full overflow-hidden">
                                  {ZONE_KEYS.map((k, zi) => {
                                    const pct = ((zd[k] || 0) / totalZone) * 100;
                                    if (pct === 0) return null;
                                    return <div key={zi} style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS[zi] }} />;
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
