import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar, AreaChart, Area, Tooltip } from 'recharts';
import MuscleHeatmap from '../components/MuscleHeatmap';
import { Trophy, TrendingUp, Activity } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

export default function Stats() {
  const { workoutHistory } = useApp();
  const [heatmapPeriod, setHeatmapPeriod] = useState('week');

  // Strength Progress - weight over time per lift
  const strengthProgress = useMemo(() => {
    const byLift = {};
    workoutHistory
      .filter((e) => e.type === 'strength' && e.details?.lifts)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((entry) => {
        const d = new Date(entry.date);
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        entry.details.lifts.forEach((lift) => {
          if (!byLift[lift.name]) byLift[lift.name] = [];
          byLift[lift.name].push({ date: label, weight: lift.weight, reps: lift.reps });
        });
      });
    return byLift;
  }, [workoutHistory]);

  // Weekly Compliance Radar
  const complianceData = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEntries = workoutHistory.filter((e) => new Date(e.date) >= weekStart);
    const types = { strength: 0, tri: 0, long: 0 };
    const targets = { strength: 3, tri: 2, long: 1 };
    weekEntries.forEach((e) => { if (types[e.type] !== undefined) types[e.type]++; });
    return Object.entries(targets).map(([type, target]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      completion: Math.min(100, Math.round(((types[type] || 0) / target) * 100)),
    }));
  }, [workoutHistory]);

  // HIC Distribution
  const hicDistribution = useMemo(() => {
    const cats = {};
    workoutHistory.forEach((e) => {
      if (e.type === 'tri' && e.details?.hic && !e.details.hic.skipped) {
        const hic = e.details.hic;
        const cat = hic.category || 'Unknown';
        cats[cat] = (cats[cat] || 0) + 1;
      }
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [workoutHistory]);

  // Cumulative Distance
  const cumulativeDistance = useMemo(() => {
    const sorted = [...workoutHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    let bike = 0, run = 0, swim = 0;
    return sorted
      .filter((e) => e.details?.cardio?.metrics)
      .map((e) => {
        const d = new Date(e.date);
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        const m = e.details.cardio.metrics;
        const cn = e.details.cardio.name.toLowerCase();
        if (cn.includes('bike') && m.distance) bike += parseFloat(m.distance) || 0;
        if (cn.includes('run') && m.distance) run += parseFloat(m.distance) || 0;
        if (cn.includes('swim') && m.totalDistance) swim += parseFloat(m.totalDistance) || 0;
        return { date: label, bike, run, swim };
      });
  }, [workoutHistory]);

  // Training Load Heatmap (GitHub-style)
  const trainingHeatmap = useMemo(() => {
    const map = {};
    workoutHistory.forEach((e) => {
      const d = new Date(e.date).toISOString().split('T')[0];
      map[d] = (map[d] || 0) + 1;
    });
    const weeks = [];
    const now = new Date();
    for (let w = 25; w >= 0; w--) {
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(now.getDate() - (w * 7) + d - now.getDay());
        const key = date.toISOString().split('T')[0];
        weekDays.push({ date: key, count: map[key] || 0 });
      }
      weeks.push(weekDays);
    }
    return weeks;
  }, [workoutHistory]);

  // Personal Records
  const personalRecords = useMemo(() => {
    const prs = {};
    workoutHistory
      .filter((e) => e.type === 'strength' && e.details?.lifts)
      .forEach((entry) => {
        entry.details.lifts.forEach((lift) => {
          if (!prs[lift.name] || lift.weight > prs[lift.name].weight) {
            prs[lift.name] = { weight: lift.weight, reps: lift.reps, date: entry.date };
          }
        });
      });
    return Object.entries(prs).map(([name, data]) => ({ name, ...data }));
  }, [workoutHistory]);

  const heatColor = (count) => {
    if (count === 0) return '#1e293b';
    if (count === 1) return '#164e63';
    if (count === 2) return '#0e7490';
    return '#10b981';
  };

  if (workoutHistory.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <Activity size={48} className="text-slate-700 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-slate-300 mb-2">No Stats Yet</h2>
        <p className="text-sm text-slate-500">Complete some workouts to see your progress.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-8 space-y-6">
      {/* Muscle Heatmap */}
      <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">Muscle Impact</h3>
          <div className="flex gap-1 bg-dark-800 rounded-lg p-0.5">
            {['week', 'month'].map((p) => (
              <button key={p} onClick={() => setHeatmapPeriod(p)}
                className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                  heatmapPeriod === p ? 'bg-accent-blue text-white' : 'text-slate-500'
                }`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <MuscleHeatmap period={heatmapPeriod} />
      </div>

      {/* Personal Records */}
      {personalRecords.length > 0 && (
        <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">Personal Records</h3>
          </div>
          <div className="space-y-2">
            {personalRecords.map((pr) => (
              <div key={pr.name} className="flex items-center justify-between bg-dark-600 rounded-lg px-3 py-2">
                <span className="text-sm text-white font-medium">{pr.name}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-amber-400">{pr.weight} lbs</span>
                  <span className="text-xs text-slate-500 ml-1">x{pr.reps}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strength Progress */}
      {Object.keys(strengthProgress).length > 0 && (
        <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-accent-blue" />
            <h3 className="text-sm font-semibold text-slate-200">Strength Progress</h3>
          </div>
          {Object.entries(strengthProgress).map(([lift, data]) => (
            <div key={lift} className="mb-4 last:mb-0">
              <h4 className="text-xs text-slate-400 mb-2">{lift}</h4>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {/* Weekly Compliance Radar */}
      {complianceData.length > 0 && (
        <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Weekly Compliance</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={complianceData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="type" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Radar dataKey="completion" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cumulative Distance */}
      {cumulativeDistance.length > 0 && (
        <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Cumulative Distance</h3>
          <div className="flex justify-center gap-4 mb-2 text-[11px]">
            <span className="text-accent-blue">Bike (mi)</span>
            <span className="text-emerald-400">Run (mi)</span>
            <span className="text-purple-400">Swim (yds)</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={cumulativeDistance}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="bike" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Area type="monotone" dataKey="run" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              <Area type="monotone" dataKey="swim" stackId="3" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* HIC Distribution */}
      {hicDistribution.length > 0 && (
        <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">HIC Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={hicDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {hicDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Training Load Heatmap */}
      <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Training Load (26 Weeks)</h3>
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-[3px]" style={{ minWidth: `${26 * 14}px` }}>
            {trainingHeatmap.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <div key={day.date} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: heatColor(day.count) }} title={`${day.date}: ${day.count} workouts`} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className="text-[9px] text-slate-600">Less</span>
          {[0, 1, 2, 3].map((c) => (
            <div key={c} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: heatColor(c) }} />
          ))}
          <span className="text-[9px] text-slate-600">More</span>
        </div>
      </div>
    </div>
  );
}
