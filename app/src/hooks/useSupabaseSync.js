import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const LS_HISTORY = 'workoutHistory'
const LS_SWAPS = 'weekSwaps'
const LS_PENDING = 'pendingSync'

// UUID v4 pattern check
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Map app entry → Supabase row (DB has snake_case columns, app uses camelCase)
function toDbRow(entry, userId) {
  return {
    // Only include id if it's a valid UUID; otherwise let DB generate one
    ...(entry.id && UUID_RE.test(entry.id) ? { id: entry.id } : {}),
    user_id: userId,
    date: entry.date,
    type: entry.type,
    day: entry.workoutName || entry.day || null,
    energy_level: entry.energyLevel || null,
    duration_min: entry.duration || null,
    details: {
      ...(entry.details || {}),
      // Stash extra fields in details so nothing is lost
      ...(entry.source ? { source: entry.source } : {}),
      ...(entry.whoopActivity ? { whoopActivity: entry.whoopActivity } : {}),
      workoutName: entry.workoutName || null,
    },
  }
}

// Map Supabase row → app entry
function fromDbRow(row) {
  const details = row.details || {}
  const { source, whoopActivity, workoutName, ...restDetails } = details
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    workoutName: workoutName || row.day || null,
    energyLevel: row.energy_level || null,
    duration: row.duration_min || null,
    details: restDetails,
    ...(source ? { source } : {}),
    ...(whoopActivity ? { whoopActivity } : {}),
  }
}

function getLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function setLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function useSupabaseSync() {
  const { user } = useAuth()
  const [workoutHistory, setWorkoutHistory] = useState(() => getLS(LS_HISTORY, []))
  const [weekSwaps, setWeekSwaps] = useState(() => getLS(LS_SWAPS, {}))
  const [needsMigration, setNeedsMigration] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const pendingFlushRef = useRef(false)

  // ─── helpers ────────────────────────────────────────────────────────────────

  function enqueuePending(op) {
    const queue = getLS(LS_PENDING, [])
    queue.push(op)
    setLS(LS_PENDING, queue)
  }

  async function flushPending() {
    if (pendingFlushRef.current) return
    const queue = getLS(LS_PENDING, [])
    if (!queue.length) return
    pendingFlushRef.current = true
    const remaining = []
    for (const op of queue) {
      try {
        if (op.type === 'saveWorkout') {
          const { error } = await supabase.from('workout_history').upsert(op.payload)
          if (error) remaining.push(op)
        } else if (op.type === 'deleteWorkout') {
          const { error } = await supabase.from('workout_history').delete().eq('id', op.id)
          if (error) remaining.push(op)
        } else if (op.type === 'saveWeekSwaps') {
          const { error } = await supabase
            .from('week_swaps')
            .upsert(op.payload, { onConflict: 'user_id,week_key' })
          if (error) remaining.push(op)
        }
      } catch {
        remaining.push(op)
      }
    }
    setLS(LS_PENDING, remaining)
    pendingFlushRef.current = false
  }

  // ─── load on login ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return

    async function loadFromSupabase() {
      setIsSyncing(true)
      try {
        const [{ data: remoteHistory }, { data: remoteSwaps }] = await Promise.all([
          supabase.from('workout_history').select('*').order('date', { ascending: false }),
          supabase.from('week_swaps').select('*'),
        ])

        const localHistory = getLS(LS_HISTORY, [])

        if (!remoteHistory?.length && localHistory.length) {
          setNeedsMigration(true)
        } else if (remoteHistory?.length) {
          // Map DB rows to app format
          const remoteEntries = remoteHistory.map(fromDbRow)
          // Merge: Supabase wins on date conflicts
          const remoteByDate = Object.fromEntries(remoteEntries.map((e) => [e.date, e]))
          const localOnly = localHistory.filter((e) => !remoteByDate[e.date])
          const merged = [...remoteEntries, ...localOnly].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          )
          setWorkoutHistory(merged)
          setLS(LS_HISTORY, merged)
        }

        if (remoteSwaps?.length) {
          const swapsObj = getLS(LS_SWAPS, {})
          for (const row of remoteSwaps) {
            swapsObj[row.week_key] = row.swaps
          }
          setWeekSwaps(swapsObj)
          setLS(LS_SWAPS, swapsObj)
        }

        await flushPending()
      } catch {
        // offline — leave local state as-is
      } finally {
        setIsSyncing(false)
      }
    }

    loadFromSupabase()
  }, [user?.id])

  // ─── migrate ─────────────────────────────────────────────────────────────────

  const migrateData = useCallback(async () => {
    if (!user) return { error: new Error('Not authenticated') }
    const localHistory = getLS(LS_HISTORY, [])
    const localSwaps = getLS(LS_SWAPS, {})
    setIsSyncing(true)
    try {
      if (localHistory.length) {
        const rows = localHistory.map((e) => toDbRow(e, user.id))
        const { error } = await supabase.from('workout_history').upsert(rows)
        if (error) return { error }
      }
      for (const [week_key, swaps] of Object.entries(localSwaps)) {
        const { error } = await supabase
          .from('week_swaps')
          .upsert({ user_id: user.id, week_key, swaps }, { onConflict: 'user_id,week_key' })
        if (error) return { error }
      }
      setNeedsMigration(false)
      return {}
    } catch (error) {
      return { error }
    } finally {
      setIsSyncing(false)
    }
  }, [user])

  // ─── writes ───────────────────────────────────────────────────────────────────

  const saveWorkout = useCallback(
    async (entry) => {
      const updated = (() => {
        const existing = getLS(LS_HISTORY, [])
        const idx = existing.findIndex((e) => e.id === entry.id)
        if (idx >= 0) {
          const copy = [...existing]
          copy[idx] = entry
          return copy
        }
        return [entry, ...existing]
      })()
      setWorkoutHistory(updated)
      setLS(LS_HISTORY, updated)

      if (!user) return
      const payload = toDbRow(entry, user.id)
      try {
        const { error } = await supabase.from('workout_history').upsert(payload)
        if (error) enqueuePending({ type: 'saveWorkout', payload })
      } catch {
        enqueuePending({ type: 'saveWorkout', payload })
      }
    },
    [user]
  )

  const deleteWorkout = useCallback(
    async (id) => {
      const updated = getLS(LS_HISTORY, []).filter((e) => e.id !== id)
      setWorkoutHistory(updated)
      setLS(LS_HISTORY, updated)

      if (!user) return
      try {
        const { error } = await supabase.from('workout_history').delete().eq('id', id)
        if (error) enqueuePending({ type: 'deleteWorkout', id })
      } catch {
        enqueuePending({ type: 'deleteWorkout', id })
      }
    },
    [user]
  )

  const saveWeekSwaps = useCallback(
    async (weekKey, swaps) => {
      const updated = { ...getLS(LS_SWAPS, {}), [weekKey]: swaps }
      setWeekSwaps(updated)
      setLS(LS_SWAPS, updated)

      if (!user) return
      const payload = { user_id: user.id, week_key: weekKey, swaps }
      try {
        const { error } = await supabase
          .from('week_swaps')
          .upsert(payload, { onConflict: 'user_id,week_key' })
        if (error) enqueuePending({ type: 'saveWeekSwaps', payload })
      } catch {
        enqueuePending({ type: 'saveWeekSwaps', payload })
      }
    },
    [user]
  )

  return {
    workoutHistory,
    weekSwaps,
    saveWorkout,
    deleteWorkout,
    saveWeekSwaps,
    needsMigration,
    migrateData,
    isSyncing,
  }
}
