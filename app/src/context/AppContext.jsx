import { createContext, useContext, useMemo, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DEFAULT_SETTINGS } from '../data/training';
import { SEED_HISTORY } from '../data/seedHistory';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useLocalStorage('trainingAppSettings', DEFAULT_SETTINGS);
  const [localWorkoutHistory, setLocalWorkoutHistory] = useLocalStorage('trainingAppHistory', SEED_HISTORY);
  const [workoutOverrides, setWorkoutOverrides] = useLocalStorage('trainingAppOverrides', {});
  const [localWeekSwaps, setLocalWeekSwaps] = useLocalStorage('trainingAppWeekSwaps', {});

  const {
    workoutHistory: syncHistory,
    weekSwaps: syncSwaps,
    saveWorkout,
    deleteWorkout,
    saveWeekSwaps,
    needsMigration,
    migrateData,
    isSyncing,
  } = useSupabaseSync();

  const workoutHistory = user ? syncHistory : localWorkoutHistory;
  const weekSwaps = user ? syncSwaps : localWeekSwaps;

  // Provides setWorkoutHistory-compatible API that syncs to Supabase when logged in.
  // Handles functional updaters and direct values, plus add/update/delete diffing.
  const setWorkoutHistory = useCallback((updaterOrValue) => {
    if (!user) {
      setLocalWorkoutHistory(updaterOrValue);
      return;
    }
    const current = syncHistory;
    const next = typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue;
    const currentMap = Object.fromEntries(current.map((e) => [e.id, e]));
    const nextIds = new Set(next.map((e) => e.id));
    // Delete removed entries
    for (const entry of current) {
      if (!nextIds.has(entry.id)) deleteWorkout(entry.id);
    }
    // Save new or changed entries
    for (const entry of next) {
      if (!currentMap[entry.id] || JSON.stringify(currentMap[entry.id]) !== JSON.stringify(entry)) {
        saveWorkout(entry);
      }
    }
  }, [user, syncHistory, saveWorkout, deleteWorkout, setLocalWorkoutHistory]);

  // Provides setWeekSwaps-compatible API that syncs to Supabase when logged in.
  const setWeekSwaps = useCallback((updaterOrValue) => {
    if (!user) {
      setLocalWeekSwaps(updaterOrValue);
      return;
    }
    const current = syncSwaps;
    const next = typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue;
    // Clear keys that were removed
    for (const weekKey of Object.keys(current)) {
      if (!(weekKey in next)) saveWeekSwaps(weekKey, []);
    }
    // Save new or changed keys
    for (const [weekKey, swaps] of Object.entries(next)) {
      if (JSON.stringify(current[weekKey]) !== JSON.stringify(swaps)) {
        saveWeekSwaps(weekKey, swaps);
      }
    }
  }, [user, syncSwaps, saveWeekSwaps, setLocalWeekSwaps]);

  const value = useMemo(() => ({
    settings,
    setSettings,
    workoutHistory,
    setWorkoutHistory,
    workoutOverrides,
    setWorkoutOverrides,
    weekSwaps,
    setWeekSwaps,
    needsMigration,
    migrateData,
    isSyncing,
  }), [settings, workoutHistory, workoutOverrides, weekSwaps, setWorkoutHistory, setWeekSwaps, needsMigration, migrateData, isSyncing]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
