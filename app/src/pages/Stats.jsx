import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { Trophy, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { OPERATOR_LIFTS, EXERCISE_MUSCLE_MAP } from '../data/training';
import { getSwappedWorkoutForDate } from '../utils/workout';
import { useWhoop } from '../hooks/useWhoop';
import { getSportName, getSportIcon, getSportColor, formatDuration as formatWhoopDuration, metersToMiles, kjToKcal } from '../utils/whoopSports';
import { getStrainCorrelation, getWeeklyStrainTrend } from '../utils/strainCorrelation';

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

function formatPace(pace) {
  if (!pace && pace !== 0) return '--';
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  const [selectedLift, setSelectedLift] = useState('Bench Press');
  const [timeRange, setTimeRange] = useState('All');
  const [statsView, setStatsView] = useState(null);
  const [selectedSport, setSelectedSport] = useState('run');
  const [expandedActivity, setExpandedActivity] = useState(null);

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

  if (workoutHistory.length === 0) {
    return (
      <div className="px-5 pt-4 pb-28 bg-black min-h-screen flex flex-col items-center justify-center text-center">
        <BarChart3 size={48} className="text-[#333333] mx-auto mb-4" />
        <p className="text-[17px] text-[#555555] mb-2">Log workouts to see your stats</p>
        <p className="text-[13px] text-[#444444]">Complete your first workout to unlock charts and trends</p>
      </div>
    );
  }

  const currentPBs = endurancePBs[selectedSport] || {};

  return (
    <div className="px-5 pt-4 pb-28 min-h-screen bg-black space-y-5">
      <h1 className="text-[28px] font-bold text-white mb-2">Stats</h1>

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
                  {lift.short}
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
                      contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px' }}
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
                  contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px' }}
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
                    {enduranceOverview.run.count > 0 ? `${formatPace(enduranceOverview.run.paceSum / enduranceOverview.run.count)} /mi avg` : 'No data'}
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
                      tickFormatter={v => selectedSport === 'bike' ? `${v}W` : selectedSport === 'run' ? formatPace(v) : `${Math.round(v)}s`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(value, name) => {
                        if (name === 'pace') return [selectedSport === 'run' ? `${formatPace(value)} /mi` : `${Math.round(value)}s /100y`, 'Pace'];
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
                          {currentPBs.fastestPace ? `${formatPace(currentPBs.fastestPace)} /mi` : '--'}
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
                  contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px' }}
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
        </>
      )}

      {activeView === 'activity' && (
        <ActivityTab
          whoopConnected={whoopConnected}
          whoopWorkouts={whoopData?.workout || []}
          workoutHistory={workoutHistory}
          expandedActivity={expandedActivity}
          setExpandedActivity={setExpandedActivity}
        />
      )}
    </div>
  );
}

function ActivityTab({ whoopConnected, whoopWorkouts, workoutHistory, expandedActivity, setExpandedActivity }) {
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

  // Weekly strain - last 7 days, per-day
  const weeklyStrain = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      let totalStrain = 0;
      for (const w of whoopWorkouts) {
        const wk = w.date || (w.start ? w.start.split('T')[0] : null);
        if (wk === key && w.score?.strain) totalStrain += w.score.strain;
      }
      days.push({ day: dayLabel, strain: Math.round(totalStrain * 10) / 10, isToday: i === 0 });
    }
    return days;
  }, [whoopWorkouts]);

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
    <>
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

      {/* WEEKLY STRAIN CHART */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
        <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Weekly Strain</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyStrain} barCategoryGap="20%">
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', fontSize: '12px' }}
              formatter={(value) => [`${value}`, 'Strain']}
            />
            <Bar dataKey="strain" radius={[4, 4, 0, 0]}>
              {weeklyStrain.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isToday ? '#3B82F6' : strainColor(entry.strain)}
                  opacity={entry.strain === 0 ? 0.15 : 1}
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
    </>
  );
}
