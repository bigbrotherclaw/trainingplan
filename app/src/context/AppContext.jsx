import { createContext, useContext, useState, useCallback } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DEFAULT_SETTINGS } from '../data/training'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [settings, setSettings] = useLocalStorage('tp-settings', DEFAULT_SETTINGS)
  const [workoutHistory, setWorkoutHistory] = useLocalStorage('tp-history', [])
  const [workoutOverrides, setWorkoutOverrides] = useLocalStorage('tp-overrides', {})
  const [weekSwaps, setWeekSwaps] = useLocalStorage('tp-weekSwaps', {})
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const exportData = useCallback(() => {
    const data = { settings, workoutHistory, workoutOverrides, weekSwaps }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-plan-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast('Data exported successfully')
  }, [settings, workoutHistory, workoutOverrides, weekSwaps, addToast])

  const importData = useCallback((jsonString) => {
    try {
      const data = JSON.parse(jsonString)
      if (data.settings) setSettings(data.settings)
      if (data.workoutHistory) setWorkoutHistory(data.workoutHistory)
      if (data.workoutOverrides) setWorkoutOverrides(data.workoutOverrides)
      if (data.weekSwaps) setWeekSwaps(data.weekSwaps)
      addToast('Data imported successfully')
    } catch {
      addToast('Invalid JSON file', 'error')
    }
  }, [setSettings, setWorkoutHistory, setWorkoutOverrides, setWeekSwaps, addToast])

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    setWorkoutHistory([])
    setWorkoutOverrides({})
    setWeekSwaps({})
    addToast('All data reset')
  }, [setSettings, setWorkoutHistory, setWorkoutOverrides, setWeekSwaps, addToast])

  return (
    <AppContext.Provider
      value={{
        settings, setSettings,
        workoutHistory, setWorkoutHistory,
        workoutOverrides, setWorkoutOverrides,
        weekSwaps, setWeekSwaps,
        toasts, addToast,
        exportData, importData, resetAll,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
