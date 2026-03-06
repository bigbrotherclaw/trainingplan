import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { Trophy, BarChart3 } from 'lucide-react';
import { OPERATOR_LIFTS, EXERCISE_MUSCLE_MAP } from '../data/training';
import { getSwappedWorkoutForDate } from '../utils/workout';

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

function epley(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export default function Stats() {
  const { workoutHistory, weekSwaps } = useApp();
  const [selectedLift, setSelectedLift] = useState('Bench Press');
  const [timeRange, setTimeRange] = useState('All');

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

  if (workoutHistory.length === 0) {
    return (
      <div className="px-5 pt-4 pb-28 bg-black min-h-screen flex flex-col items-center justify-center text-center">
        <BarChart3 size={48} className="text-[#333333] mx-auto mb-4" />
        <p className="text-[17px] text-[#555555] mb-2">Log workouts to see your stats</p>
        <p className="text-[13px] text-[#444444]">Complete your first workout to unlock charts and trends</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-28 min-h-screen bg-black space-y-5">
      <h1 className="text-[28px] font-bold text-white mb-2">Stats</h1>

      {/* STRENGTH JOURNEY */}
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
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
                  {personalBest.weight} lbs <span className="text-[13px] font-medium text-[#666666]">×{personalBest.reps}</span>
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-[13px] text-[#555555] py-8">No data for this lift in this time range.</p>
        )}
      </div>

      {/* VOLUME THIS WEEK */}
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
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
        <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
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
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
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
    </div>
  );
}
