import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { getMusclePoints, getWorkoutSummaryForDate } from '../utils/workout'
import { WEEKLY_TEMPLATE } from '../data/training'
import MuscleHeatmap from '../components/MuscleHeatmap'
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, getDay, isSameDay, isToday as checkIsToday } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, RadialBarChart, RadialBar, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts'
import { Flame, TrendingUp, Calendar, Zap } from 'lucide-react'

export default function Dashboard() {
  const { settings, workoutHistory } = useApp()
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 0 }), [today])
  const weekHistory = useMemo(() =>
    workoutHistory.filter((e) => new Date(e.date) >= weekStart),
    [workoutHistory, weekStart]
  )

  const musclePoints = useMemo(() => getMusclePoints(weekHistory), [weekHistory])

  const streak = useMemo(() => {
    let s = 0
    let d = new Date(today)
    const dates = workoutHistory.map((e) => new Date(e.date).toDateString())
    while (dates.includes(d.toDateString())) { s++; d.setDate(d.getDate() - 1) }
    return s
  }, [workoutHistory, today])

  const compliance = useMemo(() => {
    const dayNum = today.getDay()
    const expected = dayNum === 0 ? 0 : dayNum
    const actual = weekHistory.length
    return expected > 0 ? Math.round((actual / expected) * 100) : 100
  }, [weekHistory, today])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i)
      const workout = WEEKLY_TEMPLATE[d.getDay()]
      const logged = workoutHistory.some((e) => new Date(e.date).toDateString() === d.toDateString())
      return { date: d, workout, logged, isToday: checkIsToday(d) }
    })
  }, [weekStart, workoutHistory])

  const todayWorkout = WEEKLY_TEMPLATE[today.getDay()]

  const strengthData = useMemo(() => {
    return workoutHistory
      .filter((e) => e.type === 'strength' && Array.isArray(e.details?.lifts))
      .slice(-12)
      .map((e) => {
        const row = { date: format(new Date(e.date), 'M/d') }
        e.details.lifts.forEach((l) => { row[l.name] = l.weight })
        return row
      })
  }, [workoutHistory])

  const cumulativeData = useMemo(() => {
    const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const daily = Array.from({ length: 7 }, () => ({ bike: 0, run: 0, swim: 0 }))
    workoutHistory.forEach((e) => {
      const ed = new Date(e.date)
      if (ed < weekStart) return
      const idx = ed.getDay()
      const m = e.details?.cardio?.metrics
      if (!m) return
      const cn = (e.details?.cardio?.name || '').toLowerCase()
      if (cn.includes('bike') && m.distance) daily[idx].bike += parseFloat(m.distance) || 0
      else if (cn.includes('run') && m.distance) daily[idx].run += parseFloat(m.distance) || 0
      else if (cn.includes('swim') && m.totalDistance) daily[idx].swim += parseFloat(m.totalDistance) || 0
    })
    const cum = []
    for (let i = 0; i < 7; i++) {
      cum.push({
        day: dayLabels[i],
        bike: (cum[i-1]?.bike || 0) + daily[i].bike,
        run: (cum[i-1]?.run || 0) + daily[i].run,
        swim: (cum[i-1]?.swim || 0) + daily[i].swim,
      })
    }
    return cum
  }, [workoutHistory, weekStart])

  const hicDistribution = useMemo(() => {
    const catMap = {}
    workoutHistory.forEach((e) => {
      if (e.type === 'tri' && e.details?.hic?.name && !e.details.hic.skipped) {
        catMap[e.details.hic.name] = (catMap[e.details.hic.name] || 0) + 1
      }
    })
    return Object.entries(catMap).map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, value }))
  }, [workoutHistory])

  const complianceData = useMemo(() => [
    { name: 'Compliance', value: compliance, fill: '#3b82f6' }
  ], [compliance])

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div className="p-4 pb-8 space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase mb-1"><Flame size={12} /> Streak</div>
          <div className="text-2xl font-bold text-blue-500">{streak}</div>
        </div>
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase mb-1"><TrendingUp size={12} /> Weekly</div>
          <div className="text-2xl font-bold text-blue-500">{weekHistory.length}</div>
        </div>
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase mb-1"><Zap size={12} /> Comp.</div>
          <div className="text-2xl font-bold text-blue-500">{compliance}%</div>
        </div>
      </div>

      {/* Next Workout */}
      <div className="bg-[#1a1a1a] border-2 border-blue-600 rounded-lg p-4">
        <div className="text-xs text-slate-400 mb-1">{format(today, 'EEEE, MMM d')}</div>
        <div className="text-lg font-bold text-slate-100">{todayWorkout.name}</div>
        <div className="text-xs text-slate-500 mt-1">Block {settings.block} / Week {settings.week}</div>
      </div>

      {/* Week Schedule Strip */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
        <div className="text-xs text-slate-500 uppercase mb-3 font-semibold">This Week</div>
        <div className="flex gap-1.5">
          {weekDays.map((wd, i) => {
            const summary = getWorkoutSummaryForDate(wd.date)
            return (
              <div
                key={i}
                className={`flex-1 rounded-md p-1.5 text-center transition-all ${wd.isToday ? 'ring-2 ring-blue-500' : ''}`}
                style={{ backgroundColor: summary.color + '33', borderColor: wd.logged ? '#10b981' : 'transparent', borderWidth: wd.logged ? '1px' : '0' }}
              >
                <div className="text-[10px] text-slate-400">{format(wd.date, 'EEE')}</div>
                <div className={`text-[10px] font-semibold ${wd.isToday ? 'text-slate-100' : 'text-slate-300'}`}>{format(wd.date, 'd')}</div>
                {wd.logged && <div className="text-[8px] text-emerald-400 font-bold mt-0.5">done</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Muscle Heatmap */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
        <div className="text-sm font-semibold text-slate-200 mb-3">Weekly Muscle Impact</div>
        <MuscleHeatmap musclePoints={musclePoints} />
        <div className="flex justify-center items-center gap-2 mt-4">
          <span className="text-[10px] text-slate-600">Rest</span>
          <div className="w-28 h-2.5 rounded-full" style={{ background: 'linear-gradient(to right, #1e293b, #164e63, #0e7490, #f59e0b, #ef4444)' }} />
          <span className="text-[10px] text-slate-600">Destroyed</span>
        </div>
      </div>

      {/* Strength Progress */}
      {strengthData.length > 1 && (
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-slate-200 mb-3">Strength Trends</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={strengthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #374151', borderRadius: '6px' }} />
              <Line type="monotone" dataKey="Bench Press" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Back Squat" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Weighted Pull-up" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2 text-[10px]">
            <span className="text-red-400">Bench</span>
            <span className="text-blue-400">Squat</span>
            <span className="text-emerald-400">Pull-up</span>
          </div>
        </div>
      )}

      {/* Cumulative Distance */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
        <div className="text-sm font-semibold text-slate-200 mb-3">Weekly Cumulative Distance</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #374151', borderRadius: '6px' }} />
            <Area type="monotone" dataKey="bike" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            <Area type="monotone" dataKey="run" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            <Area type="monotone" dataKey="swim" stackId="3" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2 text-[10px]">
          <span className="text-blue-400">Bike (mi)</span>
          <span className="text-emerald-400">Run (mi)</span>
          <span className="text-violet-400">Swim (yds)</span>
        </div>
      </div>

      {/* HIC Distribution Donut */}
      {hicDistribution.length > 0 && (
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-slate-200 mb-3">HIC Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={hicDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {hicDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #374151', borderRadius: '6px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {hicDistribution.map((h, i) => (
              <span key={i} className="text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
