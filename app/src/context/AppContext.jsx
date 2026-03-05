import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DEFAULT_SETTINGS } from '../data/training';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings] = useLocalStorage('trainingAppSettings', DEFAULT_SETTINGS);
  const [workoutHistory, setWorkoutHistory] = useLocalStorage('trainingAppHistory', []);
  const [workoutOverrides, setWorkoutOverrides] = useLocalStorage('trainingAppOverrides', {});
  const [weekSwaps, setWeekSwaps] = useLocalStorage('trainingAppWeekSwaps', {});

  const value = useMemo(() => ({
    settings,
    setSettings,
    workoutHistory,
    setWorkoutHistory,
    workoutOverrides,
    setWorkoutOverrides,
    weekSwaps,
    setWeekSwaps,
  }), [settings, workoutHistory, workoutOverrides, weekSwaps]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
