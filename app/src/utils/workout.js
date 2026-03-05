import { WEEKLY_TEMPLATE, OPERATOR_LOADING, OPERATOR_LIFTS, ACCESSORIES, EXERCISE_MUSCLE_MAP } from '../data/training'
import { SWIM_PRESETS, BIKE_PRESETS } from '../data/cardio'
import { HIC_PRESETS } from '../data/hic'

export function getWorkoutForDate(date) {
  return WEEKLY_TEMPLATE[date.getDay()]
}

export function getLoadingForWeek(week) {
  return OPERATOR_LOADING.find((l) => l.week === week) || OPERATOR_LOADING[0]
}

export function getLiftWeight(settings, liftName, loading) {
  const lift = OPERATOR_LIFTS.find((l) => l.name === liftName)
  if (!lift) return 0
  return Math.round(settings[lift.settingsKey] * (loading.percentage / 100))
}

export function getWorkoutSummaryForDate(date) {
  const workout = WEEKLY_TEMPLATE[date.getDay()]
  if (workout.type === 'rest') return { label: 'Rest', color: '#334155', accent: '#475569' }
  if (workout.type === 'strength') {
    const cats = [...new Set(ACCESSORIES[workout.accessories]?.map((a) => a.category) || [])]
    return { label: cats.join(' + '), color: '#92400e', accent: '#f59e0b' }
  }
  if (workout.type === 'tri') {
    if (workout.name.includes('Run')) return { label: 'Run + HIC', color: '#064e3b', accent: '#10b981' }
    return { label: 'Swim/Bike + HIC', color: '#1e3a5f', accent: '#3b82f6' }
  }
  if (workout.type === 'long') return { label: 'Long Tri', color: '#4c1d95', accent: '#8b5cf6' }
  return { label: workout.short, color: '#334155', accent: '#64748b' }
}

export function getMusclePoints(history) {
  const points = {}
  history.forEach((entry) => {
    if (entry.type === 'strength') {
      if (Array.isArray(entry.details?.lifts)) {
        entry.details.lifts.forEach((lift) => {
          const mapping = EXERCISE_MUSCLE_MAP[lift.name]
          if (mapping) Object.entries(mapping).forEach(([m, p]) => { points[m] = (points[m] || 0) + p })
        })
      }
      if (Array.isArray(entry.details?.accessories)) {
        entry.details.accessories.forEach((acc) => {
          const mapping = EXERCISE_MUSCLE_MAP[acc.name]
          if (mapping) Object.entries(mapping).forEach(([m, p]) => { points[m] = (points[m] || 0) + p })
        })
      }
    } else if (entry.type === 'tri') {
      if (entry.details?.cardio?.name) {
        const cn = entry.details.cardio.name.toLowerCase()
        if (cn.includes('run')) { points.quads = (points.quads || 0) + 2; points.hamstrings = (points.hamstrings || 0) + 2; points.calves = (points.calves || 0) + 2; points.glutes = (points.glutes || 0) + 1; points.core = (points.core || 0) + 1 }
        else if (cn.includes('bike')) { points.quads = (points.quads || 0) + 2; points.glutes = (points.glutes || 0) + 1; points.hamstrings = (points.hamstrings || 0) + 1; points.calves = (points.calves || 0) + 1 }
        else if (cn.includes('swim')) { points.shoulders = (points.shoulders || 0) + 2; points.lats = (points.lats || 0) + 2; points.core = (points.core || 0) + 1; points.triceps = (points.triceps || 0) + 1 }
      }
      if (!entry.details?.hic?.skipped && entry.details?.hic?.name) { points.core = (points.core || 0) + 1; points.quads = (points.quads || 0) + 1; points.shoulders = (points.shoulders || 0) + 1 }
    } else if (entry.type === 'long' && entry.details?.cardio?.name) {
      const cn = entry.details.cardio.name.toLowerCase()
      if (cn.includes('run')) { points.quads = (points.quads || 0) + 2; points.hamstrings = (points.hamstrings || 0) + 2; points.calves = (points.calves || 0) + 2; points.glutes = (points.glutes || 0) + 1; points.core = (points.core || 0) + 1 }
      else if (cn.includes('bike')) { points.quads = (points.quads || 0) + 2; points.glutes = (points.glutes || 0) + 1; points.hamstrings = (points.hamstrings || 0) + 1; points.calves = (points.calves || 0) + 1 }
      else if (cn.includes('swim')) { points.shoulders = (points.shoulders || 0) + 2; points.lats = (points.lats || 0) + 2; points.core = (points.core || 0) + 1; points.triceps = (points.triceps || 0) + 1 }
    }
  })
  return points
}

export function getColorForPoints(pts) {
  if (pts === 0) return '#1e293b'
  if (pts <= 2) return '#164e63'
  if (pts <= 4) return '#0e7490'
  if (pts <= 6) return '#0891b2'
  if (pts <= 8) return '#f59e0b'
  return '#ef4444'
}

export function getRecommendedHics(workoutHistory) {
  const recentHics = workoutHistory
    .filter((e) => e.type === 'tri' && e.details?.hic)
    .slice(-3)
    .map((e) => e.details.hic.name)
  const categories = ['Aerobic-Anaerobic', 'General Conditioning', 'Power Development']
  const picks = []
  for (const cat of categories) {
    const available = HIC_PRESETS.filter((h) => h.category === cat && !recentHics.includes(h.name))
    if (available.length > 0) {
      picks.push(available[new Date().getDate() % available.length])
    }
  }
  while (picks.length < 3) {
    const remaining = HIC_PRESETS.filter((h) => !picks.find((p) => p.name === h.name))
    if (!remaining.length) break
    picks.push(remaining[0])
  }
  return picks
}

export function getLastCardioModality(workoutHistory, dayOfWeek) {
  for (let i = workoutHistory.length - 1; i >= 0; i--) {
    const entry = workoutHistory[i]
    if (entry.type === 'tri' && entry.details?.cardio) {
      const mod = entry.details.cardio.name
      if (dayOfWeek === 2) {
        if (mod.includes('Swim') || SWIM_PRESETS.some((p) => p.name === mod)) return 'swim'
        if (mod.includes('Bike') || BIKE_PRESETS.some((p) => p.name === mod)) return 'bike'
      }
    }
  }
  return null
}
