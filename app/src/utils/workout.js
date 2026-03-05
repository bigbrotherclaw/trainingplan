import { WEEKLY_TEMPLATE, ACCESSORIES } from '../data/training';

export function getWorkoutForDate(date) {
  const dayOfWeek = date.getDay();
  return WEEKLY_TEMPLATE[dayOfWeek];
}

export function getSwappedWorkoutSummaryForDate(date, weekSwaps) {
  const workout = getSwappedWorkoutForDate(date, weekSwaps || {});
  return getWorkoutSummary(workout);
}

export function getWorkoutSummary(workout) {
  if (workout.type === 'rest') return { label: 'Rest', color: '#334155', accent: '#475569' };
  if (workout.type === 'strength') {
    const acc = workout.accessories;
    const cats = [...new Set(ACCESSORIES[acc]?.map(a => a.category) || [])];
    return { label: cats.join(' + '), color: '#92400e', accent: '#f59e0b' };
  }
  if (workout.type === 'tri') {
    if (workout.name.includes('Run')) return { label: 'Run + HIC', color: '#064e3b', accent: '#10b981' };
    return { label: 'Swim/Bike + HIC', color: '#1e3a5f', accent: '#3b82f6' };
  }
  if (workout.type === 'long') return { label: 'Long Tri', color: '#4c1d95', accent: '#8b5cf6' };
  return { label: workout.short, color: '#334155', accent: '#64748b' };
}

export function getWorkoutSummaryForDate(date) {
  const workout = WEEKLY_TEMPLATE[date.getDay()];
  return getWorkoutSummary(workout);
}

export function getMonthData(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const days = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevDate = new Date(year, month, i - firstDayOfWeek + 1);
    days.push({ date: prevDate, isCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({ date, isCurrentMonth: true });
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const nextDate = new Date(year, month + 1, i);
    days.push({ date: nextDate, isCurrentMonth: false });
  }

  return days;
}

export function get6Months(startDate) {
  const months = [];
  for (let i = -1; i < 5; i++) {
    const year = startDate.getFullYear();
    const month = startDate.getMonth() + i;
    months.push({ year: year + Math.floor(month / 12), month: ((month % 12) + 12) % 12 });
  }
  return months;
}

export function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

export function getSwappedWorkoutForDate(date, weekSwaps) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const weekKey = formatDateKey(weekStart);
  const swaps = weekSwaps[weekKey];

  if (swaps) {
    const dayOfWeek = date.getDay();
    const swappedDay = swaps[dayOfWeek];
    if (swappedDay !== undefined) {
      return WEEKLY_TEMPLATE[swappedDay];
    }
  }

  return WEEKLY_TEMPLATE[date.getDay()];
}
