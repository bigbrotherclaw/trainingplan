import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, ArrowLeftRight, Moon, Repeat2, X, Check, Dumbbell, Zap, ClipboardList, Layers, Play, ArrowLeft, Minus, Plus, Pencil } from 'lucide-react';
import { format, isSameDay, startOfWeek, addMonths, subMonths } from 'date-fns';
import { DndContext, DragOverlay, useSensor, useSensors, TouchSensor, MouseSensor, useDraggable, useDroppable, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { useApp } from '../context/AppContext';
import { getSwappedWorkoutSummaryForDate, getSwappedWorkoutForDate, getWorkoutSummary, getMonthData, formatDateKey } from '../utils/workout';
import { WEEKLY_TEMPLATE, OPERATOR_LIFTS, OPERATOR_LOADING, ACCESSORIES } from '../data/training';
import { useWhoop } from '../hooks/useWhoop';
import { getSportName, getSportIcon, getSportColor, formatDuration } from '../utils/whoopSports';
import { useGarmin } from '../hooks/useGarmin';
import { getGarminActivityName, getGarminActivityIcon, getGarminActivityColor, formatGarminDuration, garminMetersToMiles } from '../utils/garminSports';
import { mergeActivitiesForDate, formatPace, formatDistance, formatDurationCompact } from '../utils/mergeActivities';
import MergedActivityCard from '../components/MergedActivityCard';

function roundToFive(n) { return Math.round(n / 5) * 5; }

export default function CalendarPage({ onEditLog }) {
  const { workoutHistory, weekSwaps, setWeekSwaps, addWorkout, settings } = useApp();
  const { connected: whoopConnected, data: whoopData } = useWhoop();
  const { connected: garminConnected, activities: garminActivities } = useGarmin();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeId, setActiveId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [pendingDrop, setPendingDrop] = useState(null); // { fromInfo, toInfo }
  const [logMode, setLogMode] = useState(null); // null | 'detailed'
  const [liftData, setLiftData] = useState({});
  const [accessoryData, setAccessoryData] = useState({});
  const [cardioNotes, setCardioNotes] = useState('');
  const [logDuration, setLogDuration] = useState('');
  const todayRef = useRef(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const loggedDates = useMemo(() => new Set(workoutHistory.map((e) => new Date(e.date).toDateString())), [workoutHistory]);

  // Index Whoop workouts by BOTH the record date AND the local start date for robustness
  const whoopByDate = useMemo(() => {
    const map = {};
    if (!whoopData?.workout) return map;
    for (const w of whoopData.workout) {
      const keys = new Set();
      if (w.date) keys.add(w.date);
      if (w.start) {
        // Also index by local date derived from start timestamp
        const localDate = new Date(w.start);
        const localKey = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
        keys.add(localKey);
      }
      for (const key of keys) {
        if (!map[key]) map[key] = [];
        // Avoid duplicates if both keys resolve to same date
        if (!map[key].some(existing => existing.id === w.id && existing.start === w.start)) {
          map[key].push(w);
        }
      }
    }
    return map;
  }, [whoopData]);

  const getWhoopForDate = useCallback((date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return whoopByDate[key] || [];
  }, [whoopByDate]);

  // Index Garmin activities by date
  const garminByDate = useMemo(() => {
    const map = {};
    if (!garminActivities) return map;
    for (const a of garminActivities) {
      const keys = new Set();
      if (a.date) keys.add(a.date);
      if (a.startTimeLocal) {
        const localDate = a.startTimeLocal.split(' ')[0];
        if (localDate) keys.add(localDate);
      }
      for (const key of keys) {
        if (!map[key]) map[key] = [];
        if (!map[key].some(existing => existing.activityId === a.activityId)) {
          map[key].push(a);
        }
      }
    }
    return map;
  }, [garminActivities]);

  const getGarminForDate = useCallback((date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return garminByDate[key] || [];
  }, [garminByDate]);

  const monthData = useMemo(() => getMonthData(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const getDayInfoById = useCallback((id) => {
    const idx = parseInt(id?.replace('day-', ''), 10);
    return !isNaN(idx) ? monthData[idx] : null;
  }, [monthData]);

  const activeWeekStart = useMemo(() => {
    const info = getDayInfoById(activeId);
    if (!info?.isCurrentMonth) return null;
    return startOfWeek(info.date, { weekStartsOn: 0 }).getTime();
  }, [activeId, getDayInfoById]);

  const activeDayInfo = useMemo(() => getDayInfoById(activeId), [activeId, getDayInfoById]);
  const activeSummary = useMemo(() => {
    if (!activeDayInfo?.isCurrentMonth) return null;
    return getSwappedWorkoutSummaryForDate(activeDayInfo.date, weekSwaps);
  }, [activeDayInfo, weekSwaps]);

  const handleDragStart = useCallback((event) => {
    const dayInfo = getDayInfoById(event.active.id);
    if (!dayInfo?.isCurrentMonth) return;
    setActiveId(event.active.id);
  }, [getDayInfoById]);

  const handleDragEnd = useCallback((event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromInfo = getDayInfoById(active.id);
    const toInfo = getDayInfoById(over.id);
    if (!fromInfo?.isCurrentMonth || !toInfo?.isCurrentMonth) return;

    const ws1 = startOfWeek(fromInfo.date, { weekStartsOn: 0 });
    const ws2 = startOfWeek(toInfo.date, { weekStartsOn: 0 });
    if (ws1.getTime() !== ws2.getTime()) return;

    // Show choice modal instead of auto-swapping
    setPendingDrop({ fromInfo, toInfo });
  }, [getDayInfoById]);

  const handleDropSwap = useCallback(() => {
    if (!pendingDrop) return;
    const { fromInfo, toInfo } = pendingDrop;
    const ws = startOfWeek(fromInfo.date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const existing = weekSwaps[weekKey] || {};
    const day1 = fromInfo.date.getDay();
    const day2 = toInfo.date.getDay();
    const current1 = existing[day1] !== undefined ? existing[day1] : day1;
    const current2 = existing[day2] !== undefined ? existing[day2] : day2;

    setWeekSwaps((prev) => ({
      ...prev,
      [weekKey]: { ...existing, [day1]: current2, [day2]: current1 },
    }));
    setPendingDrop(null);
  }, [pendingDrop, weekSwaps, setWeekSwaps]);

  const handleDropCombine = useCallback(() => {
    if (!pendingDrop) return;
    const { fromInfo, toInfo } = pendingDrop;
    const ws = startOfWeek(fromInfo.date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const existing = weekSwaps[weekKey] || {};
    const sourceDay = fromInfo.date.getDay();
    const targetDay = toInfo.date.getDay();
    // Get current template indices for both days
    const sourceTemplate = existing[sourceDay] !== undefined ? existing[sourceDay] : sourceDay;
    const targetTemplate = existing[targetDay] !== undefined ? existing[targetDay] : targetDay;
    // Flatten if either is already combined (array)
    const sourceArr = Array.isArray(sourceTemplate) ? sourceTemplate : [sourceTemplate];
    const targetArr = Array.isArray(targetTemplate) ? targetTemplate : [targetTemplate];
    // Combine into target, source becomes rest
    setWeekSwaps((prev) => ({
      ...prev,
      [weekKey]: {
        ...existing,
        [targetDay]: [...targetArr, ...sourceArr],
        [sourceDay]: 0, // rest
      },
    }));
    setPendingDrop(null);
  }, [pendingDrop, weekSwaps, setWeekSwaps]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const resetSwaps = () => {
    const ws = startOfWeek(today, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    setWeekSwaps((prev) => {
      const next = { ...prev };
      delete next[weekKey];
      return next;
    });
  };

  const handleDayTap = useCallback((dayInfo) => {
    if (!dayInfo.isCurrentMonth || activeId) return;
    setSelectedDay(dayInfo);
    setShowSwapPicker(false);
    setLogMode(null);
    setShowMerged(false);
    setLiftData({});
    setAccessoryData({});
    setCardioNotes('');
    setLogDuration('');
  }, [activeId]);

  const handleInsertRestDay = useCallback(() => {
    if (!selectedDay) return;
    const date = selectedDay.date;
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const dayOfWeek = date.getDay();

    setWeekSwaps((prev) => {
      const existing = prev[weekKey] || {};
      const newSwaps = { ...existing };
      const currentWorkouts = {};
      for (let d = dayOfWeek; d <= 6; d++) {
        currentWorkouts[d] = existing[d] !== undefined ? existing[d] : d;
      }
      newSwaps[dayOfWeek] = 0;
      for (let d = dayOfWeek + 1; d <= 6; d++) {
        newSwaps[d] = currentWorkouts[d - 1];
      }
      return { ...prev, [weekKey]: newSwaps };
    });
    setSelectedDay(null);
  }, [selectedDay, setWeekSwaps]);

  const handleSwapWorkout = useCallback((templateDayIndex) => {
    if (!selectedDay) return;
    const date = selectedDay.date;
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const dayOfWeek = date.getDay();

    setWeekSwaps((prev) => {
      const existing = prev[weekKey] || {};
      return { ...prev, [weekKey]: { ...existing, [dayOfWeek]: templateDayIndex } };
    });
    setSelectedDay(null);
    setShowSwapPicker(false);
  }, [selectedDay, setWeekSwaps]);

  const handleResetDay = useCallback(() => {
    if (!selectedDay) return;
    const date = selectedDay.date;
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const dayOfWeek = date.getDay();

    setWeekSwaps((prev) => {
      const existing = prev[weekKey];
      if (!existing) return prev;
      const newSwaps = { ...existing };
      delete newSwaps[dayOfWeek];
      if (Object.keys(newSwaps).length === 0) {
        const next = { ...prev };
        delete next[weekKey];
        return next;
      }
      return { ...prev, [weekKey]: newSwaps };
    });
    setSelectedDay(null);
  }, [selectedDay, setWeekSwaps]);

  const isDaySwapped = useCallback((date) => {
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = formatDateKey(ws);
    const swaps = weekSwaps[weekKey];
    if (!swaps) return false;
    const dayOfWeek = date.getDay();
    return swaps[dayOfWeek] !== undefined && swaps[dayOfWeek] !== dayOfWeek;
  }, [weekSwaps]);

  useEffect(() => {
    if (todayRef.current) todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const collisionDetection = useCallback((args) => {
    const pw = pointerWithin(args);
    if (pw.length > 0) return pw;
    return rectIntersection(args);
  }, []);

  const selectedSummary = useMemo(() => {
    if (!selectedDay) return null;
    return getSwappedWorkoutSummaryForDate(selectedDay.date, weekSwaps);
  }, [selectedDay, weekSwaps]);

  const selectedWorkout = useMemo(() => {
    if (!selectedDay) return null;
    return getSwappedWorkoutForDate(selectedDay.date, weekSwaps);
  }, [selectedDay, weekSwaps]);

  const selectedDayLogged = useMemo(() => {
    if (!selectedDay) return null;
    return workoutHistory.find((e) => new Date(e.date).toDateString() === selectedDay.date.toDateString()) || null;
  }, [selectedDay, workoutHistory]);

  const loadingInfo = useMemo(() => {
    return OPERATOR_LOADING.find((l) => l.week === settings.week) || OPERATOR_LOADING[0];
  }, [settings.week]);

  // ── Build Garmin endurance log details ──
  const buildGarminEnduranceLog = useCallback((garminActivities, whoopActivities) => {
    const RUN_KEYS = new Set(['running', 'trail_running', 'treadmill_running', 'track_running']);
    const SWIM_KEYS = new Set(['lap_swimming', 'open_water_swimming', 'pool_swimming', 'swimming']);
    const CYCLE_KEYS = new Set(['cycling', 'indoor_cycling', 'mountain_biking']);

    const activities = garminActivities.map(a => {
      const typeKey = a.activityType?.typeKey || '';
      let sport = 'other';
      if (RUN_KEYS.has(typeKey)) sport = 'run';
      else if (SWIM_KEYS.has(typeKey)) sport = 'swim';
      else if (CYCLE_KEYS.has(typeKey)) sport = 'cycle';

      const activity = {
        sport,
        name: getGarminActivityName(a),
        typeKey,
        duration: a.duration || 0, // seconds
        distance: a.distance || 0, // meters
        avgHR: a.averageHR || 0,
        maxHR: a.maxHR || 0,
        calories: a.calories || 0,
        avgSpeed: a.averageSpeed || 0,
      };

      // Pace
      if (sport === 'run' && a.averageSpeed > 0) {
        activity.paceMinPerMi = 26.8224 / a.averageSpeed;
      } else if (sport === 'swim' && a.distance > 0 && a.duration > 0) {
        activity.pacePer100m = (a.duration / a.distance) * 100; // seconds per 100m
      }

      // Splits / intervals
      if (a.splits?.length > 0) {
        activity.allSplits = a.splits.map(sp => ({
          distance: sp.distance || 0,
          duration: sp.duration || sp.movingDuration || 0,
          avgHR: sp.averageHR || sp.averageHeartRate || 0,
          avgSpeed: sp.averageSpeed || 0,
          avgSwolf: sp.averageSwolf || 0,
          strokeCount: sp.totalStrokes || sp.strokes || 0,
        }));

        // Detect intervals: group splits by similar distance (within 15%)
        const workSplits = activity.allSplits.filter(sp => sp.distance > 50); // ignore tiny splits
        if (workSplits.length >= 2) {
          // Find clusters of similar-distance splits
          const clusters = [];
          for (const sp of workSplits) {
            let placed = false;
            for (const cluster of clusters) {
              const refDist = cluster[0].distance;
              if (Math.abs(sp.distance - refDist) / refDist < 0.15) {
                cluster.push(sp);
                placed = true;
                break;
              }
            }
            if (!placed) clusters.push([sp]);
          }

          // The largest cluster of 2+ similar-distance splits = the intervals
          const intervalCluster = clusters
            .filter(c => c.length >= 2)
            .sort((a, b) => b.length - a.length)[0];

          if (intervalCluster && intervalCluster.length >= 2) {
            const avgDist = intervalCluster.reduce((s, sp) => s + sp.distance, 0) / intervalCluster.length;
            // Round to common interval distances
            let labelDist;
            if (avgDist < 300) labelDist = Math.round(avgDist / 100) * 100;
            else if (avgDist < 600) labelDist = Math.round(avgDist / 200) * 200;
            else labelDist = Math.round(avgDist / 100) * 100;

            activity.intervals = {
              count: intervalCluster.length,
              distance: labelDist,
              label: `${intervalCluster.length}x${labelDist}m`,
              splits: intervalCluster.map(sp => ({
                distance: sp.distance,
                duration: sp.duration,
                avgHR: sp.avgHR,
                pace: sport === 'run' && sp.avgSpeed > 0 ? 26.8224 / sp.avgSpeed : null,
                pacePer100m: sport === 'swim' && sp.distance > 0 ? (sp.duration / sp.distance) * 100 : null,
              })),
              avgDuration: intervalCluster.reduce((s, sp) => s + sp.duration, 0) / intervalCluster.length,
              bestDuration: Math.min(...intervalCluster.map(sp => sp.duration)),
              avgHR: Math.round(intervalCluster.reduce((s, sp) => s + sp.avgHR, 0) / intervalCluster.length),
            };

            // Format interval pace
            if (sport === 'run') {
              const avgPace = intervalCluster.reduce((s, sp) => s + (sp.avgSpeed > 0 ? 26.8224 / sp.avgSpeed : 0), 0) / intervalCluster.length;
              activity.intervals.avgPace = avgPace; // min/mi
            } else if (sport === 'swim') {
              const avgP100 = intervalCluster.reduce((s, sp) => s + (sp.distance > 0 ? (sp.duration / sp.distance) * 100 : 0), 0) / intervalCluster.length;
              activity.intervals.avgPacePer100m = avgP100; // sec/100m
            }
          }
        }
      }

      // Garmin extended metrics
      if (a.averageRunningCadenceInStepsPerMinute) activity.cadence = a.averageRunningCadenceInStepsPerMinute;
      if (a.elevationGain) activity.elevationGain = a.elevationGain;
      if (a.vO2MaxValue) activity.vO2Max = a.vO2MaxValue;
      if (a.aerobicTrainingEffect) activity.trainingEffect = a.aerobicTrainingEffect;
      if (a.averageSwolf) activity.swolf = a.averageSwolf;
      if (a.totalNumberOfStrokes) activity.strokeCount = a.totalNumberOfStrokes;

      return activity;
    });

    // Whoop aggregate
    const whoopMeta = whoopActivities.length > 0 ? {
      strain: whoopActivities.reduce((s, w) => s + (w.score?.strain || 0), 0),
      avgHR: Math.round(whoopActivities.reduce((s, w) => s + (w.score?.average_heart_rate || 0), 0) / whoopActivities.length),
      calories: whoopActivities.reduce((s, w) => s + (w.score?.kilojoule ? Math.round(w.score.kilojoule * 0.239006) : 0), 0),
    } : {};

    // Build structured details
    const totalDuration = activities.reduce((s, a) => s + a.duration, 0);

    // Build a human-readable summary
    const summaryParts = activities.map(a => {
      const parts = [a.name];
      if (a.sport === 'run') {
        if (a.distance > 0) parts.push(`${(a.distance * 0.000621371).toFixed(1)}mi`);
        if (a.paceMinPerMi) {
          const m = Math.floor(a.paceMinPerMi);
          const s = Math.round((a.paceMinPerMi - m) * 60);
          parts.push(`${m}:${String(s).padStart(2, '0')}/mi`);
        }
      } else if (a.sport === 'swim') {
        if (a.distance > 0) parts.push(`${Math.round(a.distance)}m`);
        if (a.pacePer100m) {
          const m = Math.floor(a.pacePer100m / 60);
          const s = Math.round(a.pacePer100m % 60);
          parts.push(`${m}:${String(s).padStart(2, '0')}/100m`);
        }
      } else if (a.sport === 'cycle') {
        if (a.distance > 0) parts.push(`${(a.distance * 0.000621371).toFixed(1)}mi`);
      }
      if (a.avgHR > 0) parts.push(`${a.avgHR}bpm`);
      if (a.intervals) parts.push(a.intervals.label);
      return parts.join(' · ');
    });

    return {
      garminActivities: activities,
      whoopMeta,
      totalDuration: Math.round(totalDuration / 60), // minutes
      summary: summaryParts.join('\n'),
      source: 'garmin',
    };
  }, []);

  // ── Quick Log handler ──
  const handleQuickLog = useCallback(() => {
    if (!selectedDay) return;
    const date = selectedDay.date;
    const dayWhoop = getWhoopForDate(date);
    const dayGarminQL = getGarminForDate(date);
    const isRest = !selectedWorkout || selectedWorkout.type === 'rest';
    if (isRest && dayWhoop.length === 0 && dayGarminQL.length === 0) return;
    
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);

    const hasGarmin = dayGarminQL.length > 0;
    const isEndurance = selectedWorkout && (selectedWorkout.type === 'tri' || selectedWorkout.type === 'long');

    // For endurance days with Garmin data: build rich log from Garmin
    if (hasGarmin && (isEndurance || isRest)) {
      const garminLog = buildGarminEnduranceLog(dayGarminQL, dayWhoop);
      
      // Determine the actual workout name from Garmin activities
      const garminNames = garminLog.garminActivities.map(a => a.name);
      const actualName = isRest
        ? `Extra: ${garminNames.join(' + ')}`
        : (garminNames.length > 1 ? garminNames.join(' + ') : garminNames[0] || selectedWorkout.name);

      const entry = {
        id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: d.toISOString(),
        workoutName: actualName,
        type: isRest ? 'extra' : selectedWorkout.type,
        duration: garminLog.totalDuration,
        details: {
          cardio: {
            name: actualName,
            source: 'garmin',
            metrics: {
              ...garminLog.whoopMeta,
              notes: garminLog.summary,
            },
          },
          garminActivities: garminLog.garminActivities,
        },
      };

      addWorkout(entry);
      setSelectedDay(null);
      return;
    }

    // Fallback: strength or no Garmin data
    const totalWhoopDur = dayWhoop.reduce((sum, w) => {
      const dur = w.start && w.end ? (new Date(w.end) - new Date(w.start)) / 60000 : 0;
      return sum + dur;
    }, 0);

    const entry = {
      id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: d.toISOString(),
      workoutName: isRest ? `Extra: ${dayWhoop.map(w => getSportName(w.sport_id, w)).join(' + ')}` : selectedWorkout.name,
      type: isRest ? 'extra' : selectedWorkout.type,
      ...(totalWhoopDur > 0 ? { duration: Math.round(totalWhoopDur) } : {}),
    };

    if (!isRest && selectedWorkout.type === 'strength') {
      const lifts = OPERATOR_LIFTS.map((lift) => {
        const oneRM = settings[lift.settingsKey] || 0;
        const weight = roundToFive(oneRM * (loadingInfo.percentage / 100));
        return { name: lift.name, weight, reps: loadingInfo.reps, setsCompleted: loadingInfo.sets };
      });
      const accessories = (ACCESSORIES[selectedWorkout.accessories] || []).map((acc) => ({
        name: acc.name, weight: 0, reps: acc.reps, setsCompleted: acc.sets,
      }));
      entry.details = { lifts, accessories, loading: { sets: loadingInfo.sets, reps: loadingInfo.reps, percentage: loadingInfo.percentage } };
    } else {
      const whoopMeta = dayWhoop.length > 0 ? {
        strain: dayWhoop.reduce((s, w) => s + (w.score?.strain || 0), 0),
        avgHR: dayWhoop.length > 0 ? Math.round(dayWhoop.reduce((s, w) => s + (w.score?.average_heart_rate || 0), 0) / dayWhoop.length) : undefined,
        activities: dayWhoop.map(w => getSportName(w.sport_id, w)).join(', '),
      } : {};
      entry.details = {
        cardio: { name: 'Quick Log (Whoop)', metrics: { ...whoopMeta } },
        ...(!isRest && selectedWorkout?.type === 'tri' ? { hic: { name: 'Skipped', skipped: true } } : {}),
      };
    }

    addWorkout(entry);
    setSelectedDay(null);
  }, [selectedDay, selectedWorkout, getWhoopForDate, getGarminForDate, settings, loadingInfo, addWorkout, buildGarminEnduranceLog]);

  // ── Detailed Log handler ──
  const handleDetailedLog = useCallback(() => {
    if (!selectedDay) return;
    const dayWhoop2 = getWhoopForDate(selectedDay.date);
    const dayGarmin2 = getGarminForDate(selectedDay.date);
    if ((!selectedWorkout || selectedWorkout.type === 'rest') && dayWhoop2.length === 0 && dayGarmin2.length === 0) return;
    // Pre-populate lift data with suggested weights
    if (selectedWorkout && selectedWorkout.type === 'strength') {
      const initial = {};
      for (const lift of OPERATOR_LIFTS) {
        const oneRM = settings[lift.settingsKey] || 0;
        initial[`${lift.name}-weight`] = String(roundToFive(oneRM * (loadingInfo.percentage / 100)));
        initial[`${lift.name}-reps`] = String(loadingInfo.reps);
        initial[`${lift.name}-sets`] = String(loadingInfo.sets);
      }
      setLiftData(initial);
      const accInit = {};
      for (const acc of (ACCESSORIES[selectedWorkout.accessories] || [])) {
        accInit[`${acc.name}-weight`] = '';
        accInit[`${acc.name}-reps`] = String(acc.reps);
        accInit[`${acc.name}-sets`] = String(acc.sets);
      }
      setAccessoryData(accInit);
    }
    // Pre-populate duration: prefer Garmin, fallback to Whoop
    const dayGarmin = getGarminForDate(selectedDay.date);
    const dayWhoop = getWhoopForDate(selectedDay.date);

    let bestDuration = 0;
    if (dayGarmin.length > 0) {
      // Sum Garmin durations (in seconds → minutes)
      bestDuration = dayGarmin.reduce((sum, a) => sum + ((a.duration || 0) / 60), 0);
    }
    if (bestDuration <= 0) {
      bestDuration = dayWhoop.reduce((sum, w) => {
        const dur = w.start && w.end ? (new Date(w.end) - new Date(w.start)) / 60000 : 0;
        return sum + dur;
      }, 0);
    }
    if (bestDuration > 0) setLogDuration(String(Math.round(bestDuration)));

    // Auto-populate cardio notes from Garmin data
    if (dayGarmin.length > 0) {
      const RUN_KEYS = new Set(['running', 'trail_running', 'treadmill_running', 'track_running']);
      const SWIM_KEYS = new Set(['lap_swimming', 'open_water_swimming', 'pool_swimming', 'swimming']);
      const CYCLE_KEYS = new Set(['cycling', 'indoor_cycling', 'mountain_biking']);

      const notes = dayGarmin.map(a => {
        const typeKey = a.activityType?.typeKey || '';
        const name = getGarminActivityName(a);
        const parts = [name];

        // Distance
        if (a.distance > 0) {
          if (SWIM_KEYS.has(typeKey)) {
            parts.push(`${Math.round(a.distance)}m`);
          } else {
            parts.push(`${(a.distance * 0.000621371).toFixed(1)}mi`);
          }
        }

        // Pace
        if (a.averageSpeed > 0) {
          if (RUN_KEYS.has(typeKey)) {
            const minPerMi = 26.8224 / a.averageSpeed;
            const m = Math.floor(minPerMi);
            const s = Math.round((minPerMi - m) * 60);
            parts.push(`${m}:${String(s).padStart(2, '0')}/mi`);
          } else if (SWIM_KEYS.has(typeKey) && a.distance > 0) {
            const secPer100 = ((a.duration || 0) / a.distance) * 100;
            const m = Math.floor(secPer100 / 60);
            const s = Math.round(secPer100 % 60);
            parts.push(`${m}:${String(s).padStart(2, '0')}/100m`);
          }
        }

        // HR
        if (a.averageHR) parts.push(`${a.averageHR}bpm avg`);

        // Splits summary
        if (a.splits?.length > 0) {
          const splitSummary = a.splits.slice(0, 5).map((sp, i) => {
            const spd = sp.averageSpeed || 0;
            if (spd > 0 && RUN_KEYS.has(typeKey)) {
              const mpm = 26.8224 / spd;
              const mm = Math.floor(mpm);
              const ss = Math.round((mpm - mm) * 60);
              return `${i + 1}: ${mm}:${String(ss).padStart(2, '0')}`;
            }
            return null;
          }).filter(Boolean);
          if (splitSummary.length > 0) {
            parts.push(`Splits: ${splitSummary.join(', ')}`);
            if (a.splits.length > 5) parts.push(`(+${a.splits.length - 5} more)`);
          }
        }

        return parts.join(' | ');
      }).join('\n');

      setCardioNotes(notes);
    }

    setLogMode('detailed');
  }, [selectedDay, selectedWorkout, settings, loadingInfo, getWhoopForDate, getGarminForDate]);

  // ── Submit detailed log ──
  const handleSubmitDetailedLog = useCallback(() => {
    if (!selectedDay || !selectedWorkout) return;
    const d = new Date(selectedDay.date);
    d.setHours(12, 0, 0, 0);

    const entry = {
      id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: d.toISOString(),
      workoutName: selectedWorkout.name,
      type: selectedWorkout.type,
      ...(logDuration ? { duration: parseInt(logDuration) } : {}),
    };

    if (selectedWorkout.type === 'strength') {
      const lifts = OPERATOR_LIFTS.map((lift) => ({
        name: lift.name,
        weight: parseInt(liftData[`${lift.name}-weight`]) || 0,
        reps: parseInt(liftData[`${lift.name}-reps`]) || loadingInfo.reps,
        setsCompleted: parseInt(liftData[`${lift.name}-sets`]) || loadingInfo.sets,
      }));
      const accessories = (ACCESSORIES[selectedWorkout.accessories] || []).map((acc) => ({
        name: acc.name,
        weight: parseInt(accessoryData[`${acc.name}-weight`]) || 0,
        reps: parseInt(accessoryData[`${acc.name}-reps`]) || acc.reps,
        setsCompleted: parseInt(accessoryData[`${acc.name}-sets`]) || acc.sets,
      }));
      entry.details = { lifts, accessories, loading: { sets: loadingInfo.sets, reps: loadingInfo.reps, percentage: loadingInfo.percentage } };
    } else {
      const dayWhoop = getWhoopForDate(selectedDay.date);
      const whoopMeta = dayWhoop.length > 0 ? {
        strain: dayWhoop.reduce((s, w) => s + (w.score?.strain || 0), 0),
        avgHR: dayWhoop.length > 0 ? Math.round(dayWhoop.reduce((s, w) => s + (w.score?.average_heart_rate || 0), 0) / dayWhoop.length) : undefined,
        activities: dayWhoop.map(w => getSportName(w.sport_id, w)).join(', '),
      } : {};
      entry.details = {
        cardio: { name: cardioNotes || 'Calendar Log', metrics: { ...whoopMeta, notes: cardioNotes } },
        ...(selectedWorkout.type === 'tri' ? { hic: { name: 'Skipped', skipped: true } } : {}),
        ...(selectedWorkout.type === 'long' ? { notes: cardioNotes } : {}),
      };
    }

    addWorkout(entry);
    setLogMode(null);
    setSelectedDay(null);
  }, [selectedDay, selectedWorkout, liftData, accessoryData, logDuration, cardioNotes, loadingInfo, addWorkout, getWhoopForDate]);

  return (
    <div className="px-5 pt-4 pb-32 min-h-screen bg-black space-y-6">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[22px] font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="w-11 h-11 flex items-center justify-center rounded-full bg-[#141414]">
            <ChevronLeft size={18} className="text-white" />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="text-[15px] text-accent-blue font-medium min-h-[44px] px-2">
            Today
          </button>
          <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="w-11 h-11 flex items-center justify-center rounded-full bg-[#141414]">
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Drag hint */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={13} className="text-[#555555]" />
          <span className="text-[11px] text-[#555555]">
            {activeId ? 'Drop on a day in the same week to swap' : 'Long-press & drag to swap workouts'}
          </span>
        </div>
        <button onClick={resetSwaps} className="flex items-center gap-1 text-[10px] text-[#555555] hover:text-accent-blue transition-colors">
          <RotateCcw size={10} />
          Reset
        </button>
      </div>

      {/* Calendar Card */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div key={i} className="text-[11px] uppercase tracking-wider text-[#555555] text-center pb-2">{d}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-7 gap-1">
            {monthData.map((dayInfo, idx) => {
              const isToday = isSameDay(dayInfo.date, today);
              const isLogged = loggedDates.has(dayInfo.date.toDateString());
              const summary = dayInfo.isCurrentMonth ? getSwappedWorkoutSummaryForDate(dayInfo.date, weekSwaps) : null;
              const cellWorkout = dayInfo.isCurrentMonth ? getSwappedWorkoutForDate(dayInfo.date, weekSwaps) : null;
              const log = isLogged ? workoutHistory.find((e) => new Date(e.date).toDateString() === dayInfo.date.toDateString()) : null;
              const hasSkippedHic = log?.details?.hic?.skipped;
              const isDragging = activeId === `day-${idx}`;
              const swapped = dayInfo.isCurrentMonth && isDaySwapped(dayInfo.date);
              const whoopActivities = dayInfo.isCurrentMonth ? getWhoopForDate(dayInfo.date) : [];
              const maxStrain = whoopActivities.reduce((max, w) => Math.max(max, w.score?.strain || 0), 0);
              const garminActs = dayInfo.isCurrentMonth ? getGarminForDate(dayInfo.date) : [];
              const hasGarmin = garminActs.length > 0;

              const cellWeekStart = dayInfo.isCurrentMonth ? startOfWeek(dayInfo.date, { weekStartsOn: 0 }).getTime() : null;
              const isValidTarget = activeId && !isDragging && dayInfo.isCurrentMonth && cellWeekStart === activeWeekStart;

              let bgColor = 'transparent';
              if (!dayInfo.isCurrentMonth) bgColor = 'transparent';
              else if (isToday) bgColor = summary ? `${summary.color}33` : '#1a1a1a';
              else if (summary && summary.label !== 'Rest') bgColor = `${summary.color}1A`;
              else if (summary && summary.label === 'Rest') bgColor = '#33333330';

              if (isValidTarget) bgColor = summary ? `${summary.color}33` : '#1a1a1a';

              let borderStyle = 'none';
              if (isValidTarget && !isToday) borderStyle = '2px dashed #f59e0b';
              else if (isValidTarget) borderStyle = '2px solid #f59e0b';

              const whoopExtras = whoopActivities
                .map(w => ({ label: getSportName(w.sport_id, w), sportId: w.sport_id }))
                .filter((v, i, a) => a.findIndex(x => x.label === v.label) === i);

              return (
                <CalendarCell
                  key={idx}
                  id={`day-${idx}`}
                  dayInfo={dayInfo}
                  isToday={isToday}
                  isLogged={isLogged}
                  summary={summary}
                  hasSkippedHic={hasSkippedHic}
                  bgColor={bgColor}
                  borderStyle={borderStyle}
                  isDragging={isDragging}
                  isValidTarget={isValidTarget}
                  todayRef={isToday ? todayRef : null}
                  swapped={swapped}
                  whoopStrain={maxStrain}
                  whoopExtras={whoopExtras}
                  hasGarmin={hasGarmin}
                  workout={cellWorkout}
                  onTap={handleDayTap}
                />
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDayInfo && activeSummary && (
              <div
                className="flex flex-col items-center justify-center rounded-xl shadow-2xl shadow-black/80 pointer-events-none"
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: `${activeSummary.color}cc`,
                  border: `2px solid ${activeSummary.accent}`,
                }}
              >
                <span className="text-[13px] font-bold text-white">{activeDayInfo.date.getDate()}</span>
                {activeSummary.label !== 'Rest' && (
                  <span className="text-[9px] font-bold uppercase leading-tight" style={{ color: activeSummary.accent }}>
                    {abbrevLabel(activeSummary.label)}
                  </span>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Day Options Bottom Sheet */}
      <AnimatePresence>
        {selectedDay && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedDay(null); setShowSwapPicker(false); setLogMode(null); }}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] rounded-t-3xl border-t border-white/[0.10] pt-3 max-h-[85vh] flex flex-col"
              style={{ paddingBottom: 'max(0rem, env(safe-area-inset-bottom))' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              {/* Fixed Header (handle + day info + close button) */}
              <div className="flex-shrink-0 px-5">
                {/* Handle */}
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

                {/* Day Info Header */}
                <div className="relative mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <h3 className="text-[17px] font-bold text-white">
                        {format(selectedDay.date, 'EEEE, MMM d')}
                      </h3>
                      {selectedDayLogged && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15">
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-[10px] font-semibold text-emerald-400">Logged</span>
                          </div>
                          {onEditLog && (
                            <button
                              onClick={() => { setSelectedDay(null); onEditLog(selectedDay.date); }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 active:bg-white/10"
                            >
                              <Pencil size={11} className="text-white/50" />
                              <span className="text-[10px] font-medium text-white/50">Edit</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedSummary && (
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedSummary.accent }} />
                        <span className="text-[14px] font-medium" style={{ color: selectedSummary.accent }}>
                          {selectedSummary.label === 'Rest' ? 'Rest Day' : selectedSummary.label}
                        </span>
                        {isDaySwapped(selectedDay.date) && (
                          <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full font-medium">
                            Modified
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setSelectedDay(null); setShowSwapPicker(false); setLogMode(null); }}
                    className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-5" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 5rem))' }}>
              {logMode === 'detailed' ? (
                <DetailedLogForm
                  workout={selectedWorkout}
                  loadingInfo={loadingInfo}
                  settings={settings}
                  liftData={liftData}
                  setLiftData={setLiftData}
                  accessoryData={accessoryData}
                  setAccessoryData={setAccessoryData}
                  cardioNotes={cardioNotes}
                  setCardioNotes={setCardioNotes}
                  logDuration={logDuration}
                  setLogDuration={setLogDuration}
                  whoopActivities={getWhoopForDate(selectedDay.date)}
                  onSubmit={handleSubmitDetailedLog}
                  onBack={() => setLogMode(null)}
                />
              ) : (
                <>
                  {/* Merged Activities Section (Garmin + Whoop) */}
                  {(() => {
                    const dayWhoop = getWhoopForDate(selectedDay.date);
                    const dayGarmin = getGarminForDate(selectedDay.date);
                    if (dayWhoop.length === 0 && dayGarmin.length === 0) return null;

                    const mergedList = mergeActivitiesForDate(dayGarmin, dayWhoop, selectedDay.date);

                    // Group activities by shared session for Whoop banner rendering
                    const sharedSessions = {};
                    for (const a of mergedList) {
                      if (a.sharedSessionId && a.whoop) {
                        sharedSessions[a.sharedSessionId] = a.whoop;
                      }
                    }

                    return (
                      <div className="mb-4 space-y-3">
                        <h4 className="text-[11px] uppercase tracking-widest text-[#555555] font-semibold">
                          Activities ({mergedList.length})
                        </h4>
                        {mergedList.map((a, i) => {
                          // Check if this is the LAST card in a shared session group → show banner after it
                          const isLastInSession = a.sharedSessionId &&
                            mergedList.filter(x => x.sharedSessionId === a.sharedSessionId).pop() === a;
                          const sessionWhoop = isLastInSession ? sharedSessions[a.sharedSessionId] : null;
                          return (
                            <div key={`${a.source}-${a.startTime}-${i}`}>
                              <MergedActivityCard activity={a} />
                              {sessionWhoop && (
                                <div className="flex items-center gap-4 px-3 py-2 mt-1.5 rounded-lg bg-[#44b700]/8 border border-[#44b700]/15">
                                  <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#44b700]/20 text-[#44b700]">W</span>
                                  <span className="text-[11px] text-[#888]">Combined session</span>
                                  {sessionWhoop.strain > 0 && (
                                    <span className="text-[12px] font-semibold text-[#44b700]">{sessionWhoop.strain.toFixed(1)} strain</span>
                                  )}
                                  {sessionWhoop.calories > 0 && (
                                    <span className="text-[12px] text-[#777]">{sessionWhoop.calories} cal</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Log Workout Buttons */}
                  {!selectedDayLogged && (selectedWorkout || getWhoopForDate(selectedDay.date).length > 0 || getGarminForDate(selectedDay.date).length > 0) && (() => {
                    const hasGarminLog = getGarminForDate(selectedDay.date).length > 0;
                    const isEndurance = selectedWorkout && (selectedWorkout.type === 'tri' || selectedWorkout.type === 'long');
                    const showAutoLog = hasGarminLog && (isEndurance || !selectedWorkout || selectedWorkout.type === 'rest');
                    return (
                    <div className="mb-4 space-y-2">
                      <h4 className="text-[11px] uppercase tracking-widest text-[#555555] font-semibold mb-2">Log Workout</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={handleQuickLog}
                          className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl transition-colors ${
                            showAutoLog
                              ? 'bg-blue-500/15 border border-blue-500/20 active:bg-blue-500/25'
                              : 'bg-emerald-500/15 border border-emerald-500/20 active:bg-emerald-500/25'
                          }`}
                        >
                          <Zap size={16} className={showAutoLog ? 'text-blue-400' : 'text-emerald-400'} />
                          <span className={`text-[14px] font-medium ${showAutoLog ? 'text-blue-400' : 'text-emerald-400'}`}>
                            {showAutoLog ? 'Auto-Log from Garmin' : 'Quick Log'}
                          </span>
                        </button>
                        <button
                          onClick={handleDetailedLog}
                          className="flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl bg-white/[0.06] border border-white/[0.10] active:bg-white/[0.10] transition-colors"
                        >
                          <ClipboardList size={16} className="text-[#999]" />
                          <span className="text-[14px] font-medium text-[#999]">Detailed</span>
                        </button>
                      </div>
                      {showAutoLog && (
                        <p className="text-[11px] text-blue-400/60 text-center">Logs actual workout data from Garmin + Whoop</p>
                      )}
                    </div>
                    );
                  })()}

                  {!showSwapPicker ? (
                    <div className="flex flex-col gap-2.5">
                      <button
                        onClick={handleInsertRestDay}
                        className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] active:bg-white/[0.10] transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-600/30 flex items-center justify-center">
                          <Moon size={18} className="text-slate-400" />
                        </div>
                        <div className="text-left">
                          <span className="text-[15px] font-medium text-white block">Insert Rest Day</span>
                          <span className="text-[12px] text-[#777]">Shifts remaining workouts forward</span>
                        </div>
                      </button>

                      <button
                        onClick={() => setShowSwapPicker(true)}
                        className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] active:bg-white/[0.10] transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-amber-600/30 flex items-center justify-center">
                          <Repeat2 size={18} className="text-amber-400" />
                        </div>
                        <div className="text-left">
                          <span className="text-[15px] font-medium text-white block">Swap Workout</span>
                          <span className="text-[12px] text-[#777]">Pick a different workout for this day</span>
                        </div>
                      </button>

                      {isDaySwapped(selectedDay.date) && (
                        <button
                          onClick={handleResetDay}
                          className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] active:bg-white/[0.10] transition-colors"
                        >
                          <div className="w-9 h-9 rounded-lg bg-blue-600/30 flex items-center justify-center">
                            <RotateCcw size={18} className="text-blue-400" />
                          </div>
                          <div className="text-left">
                            <span className="text-[15px] font-medium text-white block">Reset to Default</span>
                            <span className="text-[12px] text-[#777]">Restore original workout for this day</span>
                          </div>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => setShowSwapPicker(false)}
                        className="text-[13px] text-accent-blue mb-3 flex items-center gap-1"
                      >
                        <ChevronLeft size={14} />
                        Back
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(WEEKLY_TEMPLATE).map(([dayIdx, workout]) => {
                          const summary = getWorkoutSummary(workout);
                          return (
                            <button
                              key={dayIdx}
                              onClick={() => handleSwapWorkout(Number(dayIdx))}
                              className="flex items-center gap-2.5 p-3 rounded-xl border border-white/[0.08] active:bg-white/[0.10] transition-colors"
                              style={{ backgroundColor: `${summary.color}1A` }}
                            >
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: summary.accent }} />
                              <span className="text-[13px] font-medium text-white">{workout.short}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
              </div>{/* end scrollable content */}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Drop Choice Modal (Swap vs Combine) */}
      <AnimatePresence>
        {pendingDrop && (() => {
          const fromSummary = getSwappedWorkoutSummaryForDate(pendingDrop.fromInfo.date, weekSwaps);
          const toSummary = getSwappedWorkoutSummaryForDate(pendingDrop.toInfo.date, weekSwaps);
          const fromWorkout = getSwappedWorkoutForDate(pendingDrop.fromInfo.date, weekSwaps);
          const toWorkout = getSwappedWorkoutForDate(pendingDrop.toInfo.date, weekSwaps);
          return (
            <>
              <motion.div
                className="fixed inset-0 bg-black/60 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPendingDrop(null)}
              />
              <motion.div
                className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] rounded-t-3xl border-t border-white/[0.10] px-5 pt-3"
                style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 5rem))' }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              >
                {/* Handle */}
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

                {/* Header */}
                <div className="relative mb-5">
                  <div className="text-center">
                    <h3 className="text-[17px] font-bold text-white mb-2">Move Workout</h3>
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fromSummary?.accent }} />
                        <span className="text-[13px] font-medium" style={{ color: fromSummary?.accent }}>
                          {fromWorkout?.short || 'Rest'}
                        </span>
                      </div>
                      <ArrowLeftRight size={14} className="text-[#555]" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: toSummary?.accent }} />
                        <span className="text-[13px] font-medium" style={{ color: toSummary?.accent }}>
                          {toWorkout?.short || 'Rest'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setPendingDrop(null)}
                    className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>

                {/* Options */}
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleDropSwap}
                    className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 active:bg-amber-500/20 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-600/30 flex items-center justify-center">
                      <ArrowLeftRight size={18} className="text-amber-400" />
                    </div>
                    <div className="text-left flex-1">
                      <span className="text-[15px] font-medium text-white block">Swap Workouts</span>
                      <span className="text-[12px] text-[#777]">
                        {format(pendingDrop.fromInfo.date, 'EEE')} gets {toWorkout?.short || 'Rest'}, {format(pendingDrop.toInfo.date, 'EEE')} gets {fromWorkout?.short || 'Rest'}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={handleDropCombine}
                    className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 active:bg-blue-500/20 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-600/30 flex items-center justify-center">
                      <Layers size={18} className="text-blue-400" />
                    </div>
                    <div className="text-left flex-1">
                      <span className="text-[15px] font-medium text-white block">Combine Workouts</span>
                      <span className="text-[12px] text-[#777]">
                        {format(pendingDrop.toInfo.date, 'EEE')} becomes {[toWorkout?.short, fromWorkout?.short].filter(Boolean).join(' + ')}, {format(pendingDrop.fromInfo.date, 'EEE')} becomes Rest
                      </span>
                    </div>
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ── Whoop Activity Card (individual) ──
function WhoopActivityCard({ w }) {
  const strain = w.score?.strain || 0;
  const avgHR = w.score?.average_heart_rate;
  const maxHR = w.score?.max_heart_rate;
  const distM = w.score?.distance_meter;
  const kj = w.score?.kilojoule;
  const zd = w.score?.zone_duration || {};
  const durationMs = w.start && w.end ? new Date(w.end) - new Date(w.start) : 0;
  const durationMin = Math.round(durationMs / 60000);
  const durationStr = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin} min`;
  const strainColor = strain > 14 ? '#EF4444' : strain >= 8 ? '#F59E0B' : '#10B981';
  const distMi = distM ? (distM * 0.000621371).toFixed(1) : null;
  const kcal = kj ? Math.round(kj * 0.239) : null;

  const zones = [
    { key: 'zone_one_milli', color: '#3B82F6' },
    { key: 'zone_two_milli', color: '#10B981' },
    { key: 'zone_three_milli', color: '#F59E0B' },
    { key: 'zone_four_milli', color: '#EF4444' },
    { key: 'zone_five_milli', color: '#DC2626' },
  ];
  const totalZone = zones.reduce((s, z) => s + (zd[z.key] || 0), 0);

  return (
    <div className="bg-white/[0.05] rounded-xl p-3.5 border border-white/[0.08]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {(() => { const Icon = getSportIcon(w.sport_id, w); const c = getSportColor(w.sport_id); return (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c + '15' }}>
              <Icon size={16} color={c} strokeWidth={2} />
            </div>
          ); })()}
          <div>
            <span className="text-[14px] font-medium text-white block">{getSportName(w.sport_id, w)}</span>
            {w.start && (
              <span className="text-[11px] text-[#555]">{new Date(w.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            )}
          </div>
        </div>
        <span className="text-[13px] text-[#777]">{durationStr}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase text-[#555] mb-0.5">Strain</div>
          <div className="text-[17px] font-bold" style={{ color: strainColor }}>{strain.toFixed(1)}</div>
        </div>
        {avgHR && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Avg HR</div>
            <div className="text-[15px] font-semibold text-white">{avgHR} <span className="text-[11px] text-[#666]">bpm</span></div>
          </div>
        )}
        {maxHR && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Max HR</div>
            <div className="text-[15px] font-semibold text-white">{maxHR} <span className="text-[11px] text-[#666]">bpm</span></div>
          </div>
        )}
        {distMi && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Distance</div>
            <div className="text-[15px] font-semibold text-white">{distMi} <span className="text-[11px] text-[#666]">mi</span></div>
          </div>
        )}
        {kcal && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Calories</div>
            <div className="text-[15px] font-semibold text-white">{kcal} <span className="text-[11px] text-[#666]">kcal</span></div>
          </div>
        )}
      </div>

      {totalZone > 0 && (
        <div>
          <div className="text-[10px] uppercase text-[#555] mb-1.5">HR Zones</div>
          <div className="flex h-3 rounded-full overflow-hidden">
            {zones.map((z, zi) => {
              const pct = ((zd[z.key] || 0) / totalZone) * 100;
              if (pct === 0) return null;
              return (
                <div key={zi} style={{ width: `${pct}%`, backgroundColor: z.color }} className="relative">
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
              <span key={label} className="text-[8px] font-medium" style={{ color: zones[zi].color }}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Garmin Activity Card ──
function GarminActivityCard({ activity }) {
  const name = getGarminActivityName(activity);
  const Icon = getGarminActivityIcon(activity);
  const color = getGarminActivityColor(activity);
  const durationStr = formatGarminDuration(activity.duration);
  const distMi = garminMetersToMiles(activity.distance);
  const avgHR = activity.averageHR;
  const maxHR = activity.maxHR;
  const calories = activity.calories;
  const startTime = activity.startTimeLocal
    ? (() => { const parts = activity.startTimeLocal.split(' '); if (parts[1]) { const [h, m] = parts[1].split(':'); const hr = parseInt(h); const ampm = hr >= 12 ? 'PM' : 'AM'; return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${ampm}`; } return null; })()
    : null;

  return (
    <div className="bg-white/[0.05] rounded-xl p-3.5 border border-[#007dff]/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
            <Icon size={16} color={color} strokeWidth={2} />
          </div>
          <div>
            <span className="text-[14px] font-medium text-white block">{name}</span>
            {startTime && <span className="text-[11px] text-[#555]">{startTime}</span>}
          </div>
        </div>
        <span className="text-[13px] text-[#777]">{durationStr}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {avgHR && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Avg HR</div>
            <div className="text-[15px] font-semibold text-white">{avgHR} <span className="text-[11px] text-[#666]">bpm</span></div>
          </div>
        )}
        {maxHR && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Max HR</div>
            <div className="text-[15px] font-semibold text-white">{maxHR} <span className="text-[11px] text-[#666]">bpm</span></div>
          </div>
        )}
        {distMi && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Distance</div>
            <div className="text-[15px] font-semibold text-white">{distMi} <span className="text-[11px] text-[#666]">mi</span></div>
          </div>
        )}
        {calories > 0 && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Calories</div>
            <div className="text-[15px] font-semibold text-white">{calories} <span className="text-[11px] text-[#666]">kcal</span></div>
          </div>
        )}
        {activity.elevationGain > 0 && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Elevation</div>
            <div className="text-[15px] font-semibold text-white">{Math.round(activity.elevationGain * 3.28084)} <span className="text-[11px] text-[#666]">ft</span></div>
          </div>
        )}
        {activity.averageRunningCadenceInStepsPerMinute > 0 && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Cadence</div>
            <div className="text-[15px] font-semibold text-white">{Math.round(activity.averageRunningCadenceInStepsPerMinute)} <span className="text-[11px] text-[#666]">spm</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detailed Log Form ──
function DetailedLogForm({ workout, loadingInfo, settings, liftData, setLiftData, accessoryData, setAccessoryData, cardioNotes, setCardioNotes, logDuration, setLogDuration, whoopActivities, onSubmit, onBack }) {
  if (!workout || workout.type === 'rest') return null;

  const whoopStrain = whoopActivities.reduce((s, w) => s + (w.score?.strain || 0), 0);
  const whoopAvgHR = whoopActivities.length > 0 ? Math.round(whoopActivities.reduce((s, w) => s + (w.score?.average_heart_rate || 0), 0) / whoopActivities.length) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-accent-blue">
          <ArrowLeft size={14} />
          Back
        </button>
        <span className="text-[13px] font-medium text-[#777]">{workout.short}</span>
      </div>

      {/* Whoop summary strip */}
      {whoopActivities.length > 0 && (
        <div className="flex items-center gap-4 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <div className="text-[10px] uppercase text-[#555]">Whoop</div>
          {whoopStrain > 0 && <div className="text-[12px] font-semibold text-amber-400">{whoopStrain.toFixed(1)} strain</div>}
          {whoopAvgHR > 0 && <div className="text-[12px] font-semibold text-white">{whoopAvgHR} bpm avg</div>}
        </div>
      )}

      {/* Duration */}
      <div>
        <label className="text-[11px] uppercase text-[#555] font-semibold block mb-1.5">Duration (min)</label>
        <input
          type="number"
          inputMode="numeric"
          value={logDuration}
          onChange={(e) => setLogDuration(e.target.value)}
          placeholder="e.g. 60"
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.10] text-white text-[15px] placeholder:text-[#444] focus:outline-none focus:border-accent-blue"
        />
      </div>

      {/* Strength-specific form */}
      {workout.type === 'strength' && (
        <>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell size={14} className="text-amber-400" />
              <span className="text-[11px] uppercase tracking-widest text-[#555] font-semibold">
                Main Lifts — {loadingInfo.sets}x{loadingInfo.reps} @ {loadingInfo.percentage}%
              </span>
            </div>
            <div className="space-y-2.5">
              {OPERATOR_LIFTS.map((lift) => (
                <div key={lift.name} className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                  <div className="text-[13px] font-medium text-white mb-2">{lift.name}</div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] uppercase text-[#555] block mb-1">Weight</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={liftData[`${lift.name}-weight`] || ''}
                        onChange={(e) => setLiftData(prev => ({ ...prev, [`${lift.name}-weight`]: e.target.value }))}
                        className="w-full px-2.5 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white text-[14px] focus:outline-none focus:border-amber-400/50"
                      />
                    </div>
                    <div style={{ width: 70 }}>
                      <label className="text-[9px] uppercase text-[#555] block mb-1">Reps</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={liftData[`${lift.name}-reps`] || ''}
                        onChange={(e) => setLiftData(prev => ({ ...prev, [`${lift.name}-reps`]: e.target.value }))}
                        className="w-full px-2.5 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white text-[14px] focus:outline-none focus:border-amber-400/50"
                      />
                    </div>
                    <div style={{ width: 70 }}>
                      <label className="text-[9px] uppercase text-[#555] block mb-1">Sets</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setLiftData(prev => {
                            const cur = parseInt(prev[`${lift.name}-sets`]) || 0;
                            return { ...prev, [`${lift.name}-sets`]: String(Math.max(0, cur - 1)) };
                          })}
                          className="w-7 h-8 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.10] active:bg-white/[0.12]"
                        >
                          <Minus size={12} className="text-white/60" />
                        </button>
                        <span className="text-[14px] font-medium text-white min-w-[20px] text-center">
                          {liftData[`${lift.name}-sets`] || '0'}
                        </span>
                        <button
                          onClick={() => setLiftData(prev => {
                            const cur = parseInt(prev[`${lift.name}-sets`]) || 0;
                            return { ...prev, [`${lift.name}-sets`]: String(cur + 1) };
                          })}
                          className="w-7 h-8 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.10] active:bg-white/[0.12]"
                        >
                          <Plus size={12} className="text-white/60" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accessories */}
          {workout.accessories && ACCESSORIES[workout.accessories] && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#555] font-semibold mb-3">
                Accessories ({workout.accessories})
              </div>
              <div className="space-y-2">
                {ACCESSORIES[workout.accessories].map((acc) => (
                  <div key={acc.name} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2.5 border border-white/[0.05]">
                    <div className="flex-1">
                      <span className="text-[12px] text-white">{acc.name}</span>
                      <span className="text-[10px] text-[#555] ml-1.5">{acc.sets}x{acc.reps}</span>
                    </div>
                    <div style={{ width: 70 }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="lbs"
                        value={accessoryData[`${acc.name}-weight`] || ''}
                        onChange={(e) => setAccessoryData(prev => ({ ...prev, [`${acc.name}-weight`]: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-[13px] placeholder:text-[#444] focus:outline-none focus:border-blue-400/40"
                      />
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setAccessoryData(prev => {
                          const cur = parseInt(prev[`${acc.name}-sets`]) || 0;
                          return { ...prev, [`${acc.name}-sets`]: String(Math.max(0, cur - 1)) };
                        })}
                        className="w-6 h-7 flex items-center justify-center rounded bg-white/[0.05] active:bg-white/[0.10]"
                      >
                        <Minus size={10} className="text-white/50" />
                      </button>
                      <span className="text-[12px] text-white min-w-[16px] text-center">
                        {accessoryData[`${acc.name}-sets`] || acc.sets}
                      </span>
                      <button
                        onClick={() => setAccessoryData(prev => {
                          const cur = parseInt(prev[`${acc.name}-sets`]) || acc.sets;
                          return { ...prev, [`${acc.name}-sets`]: String(cur + 1) };
                        })}
                        className="w-6 h-7 flex items-center justify-center rounded bg-white/[0.05] active:bg-white/[0.10]"
                      >
                        <Plus size={10} className="text-white/50" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Cardio/Tri/Long form */}
      {(workout.type === 'tri' || workout.type === 'long') && (
        <div>
          <label className="text-[11px] uppercase text-[#555] font-semibold block mb-1.5">Notes</label>
          <textarea
            value={cardioNotes}
            onChange={(e) => setCardioNotes(e.target.value)}
            placeholder="How did it go? Any notes..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.10] text-white text-[14px] placeholder:text-[#444] focus:outline-none focus:border-accent-blue resize-none"
          />
        </div>
      )}

      {/* Submit */}
      <button
        onClick={onSubmit}
        className="w-full py-3.5 rounded-2xl bg-accent-blue text-white font-semibold text-[16px] active:bg-accent-blue/80 transition-colors flex items-center justify-center gap-2"
      >
        <Check size={18} />
        Log Workout
      </button>
    </div>
  );
}

function abbrevLabel(label, workout) {
  if (!label) return '';
  // Handle combined workouts by abbreviating each component
  if (workout && workout.type === 'combined' && workout.components) {
    return workout.components
      .filter(c => c.type !== 'rest')
      .map(c => {
        const s = getWorkoutSummary(c);
        return abbrevLabel(s.label);
      })
      .join('+');
  }
  const l = label.toLowerCase();
  if (l === 'rest') return 'REST';
  if (l.includes('strength a') || l.includes('str a')) return 'STR A';
  if (l.includes('strength b') || l.includes('str b')) return 'STR B';
  if (l.includes('strength c') || l.includes('str c')) return 'STR C';
  if (l.includes('swim') && l.includes('hic')) return 'SWIM+HIC';
  if (l.includes('run') && l.includes('hic')) return 'RUN+HIC';
  if (l.includes('long')) return 'LONG TRI';
  if (l.includes('swim')) return 'SWIM';
  if (l.includes('run')) return 'RUN';
  if (l.includes('strength')) return 'STR';
  return label.toUpperCase().slice(0, 8);
}

function CalendarCell({ id, dayInfo, isToday, isLogged, summary, hasSkippedHic, bgColor, borderStyle, isDragging, isValidTarget, todayRef, swapped, whoopStrain, whoopExtras, hasGarmin, workout, onTap }) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id,
    disabled: !dayInfo.isCurrentMonth,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    disabled: !dayInfo.isCurrentMonth,
  });

  const ref = useCallback((node) => {
    setDragRef(node);
    setDropRef(node);
    if (todayRef) todayRef.current = node;
  }, [setDragRef, setDropRef, todayRef]);

  const activeBg = isOver && isValidTarget ? '#fbbf2422' : bgColor;
  const activeBorder = isOver && isValidTarget ? '2px solid #fbbf24' : borderStyle;

  const style = {
    backgroundColor: activeBg,
    border: activeBorder,
    opacity: isDragging ? 0.15 : dayInfo.isCurrentMonth ? 1 : 0.25,
    touchAction: 'none',
    transition: 'border-color 0.15s, background-color 0.15s, opacity 0.15s',
  };

  const handleClick = useCallback((e) => {
    if (!isDragging) {
      onTap(dayInfo);
    }
  }, [isDragging, onTap, dayInfo]);

  return (
    <div
      ref={ref}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`min-h-[56px] rounded-xl p-1.5 flex flex-col items-center relative overflow-hidden cursor-grab active:cursor-grabbing select-none${isToday ? ' ring-2 ring-accent-blue' : ''}`}
    >
      <span className={`text-[13px] font-medium mb-0.5 ${isToday ? 'text-white font-bold' : dayInfo.isCurrentMonth ? 'text-white' : 'text-[#555555]'}`}>
        {dayInfo.date.getDate()}
      </span>
      {dayInfo.isCurrentMonth && summary && summary.label !== 'Rest' && (
        <span className="text-[9px] leading-tight text-center font-semibold px-0.5" style={{ color: summary.accent }}>
          {abbrevLabel(summary.label, workout)}
        </span>
      )}
      {dayInfo.isCurrentMonth && whoopExtras && whoopExtras.length > 0 && (
        <span className="text-[7px] leading-tight text-center font-medium px-0.5 truncate max-w-full" style={{ color: getSportColor(whoopExtras[0].sportId) }}>
          {whoopExtras.length === 1
            ? (whoopExtras[0].label.length > 7 ? whoopExtras[0].label.slice(0, 6) + '\u2026' : whoopExtras[0].label)
            : `${whoopExtras.length} acts`}
        </span>
      )}
      {isLogged && (
        <span className={`text-[8px] font-bold mt-0.5 ${hasSkippedHic ? 'text-amber-400' : 'text-emerald-400'}`}>
          {hasSkippedHic ? '~' : '\u2713'}
        </span>
      )}
      {swapped && !isDragging && (
        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
      )}
      {whoopStrain > 0 && !isDragging && (
        <div
          className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: whoopStrain > 14 ? '#EF4444' : whoopStrain >= 8 ? '#F59E0B' : '#10B981' }}
        />
      )}
      {hasGarmin && !isDragging && (
        <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-[#007dff]" />
      )}
    </div>
  );
}
