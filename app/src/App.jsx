import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Dumbbell, ClipboardList, Clock, Settings } from 'lucide-react'
import { useApp } from './context/AppContext'
import Dashboard from './pages/Dashboard'
import Workout from './pages/Workout'
import Overview from './pages/Overview'
import History from './pages/History'
import SettingsPage from './pages/Settings'
import Toast from './components/Toast'

const tabs = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'workout', label: 'Workout', icon: Dumbbell },
  { id: 'overview', label: 'Program', icon: ClipboardList },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { toasts, settings } = useApp()

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'workout': return <Workout />
      case 'overview': return <Overview />
      case 'history': return <History />
      case 'settings': return <SettingsPage />
      default: return <Dashboard />
    }
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-100">Training Plan</h1>
          <div className="text-xs text-slate-500">
            Block {settings.block} / Week {settings.week}
          </div>
        </div>
      </header>

      <main className="fixed top-[52px] bottom-[64px] left-0 right-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-gray-800">
        <div className="flex justify-around items-center py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                  active ? 'text-blue-500' : 'text-slate-500'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <Toast key={t.id} message={t.message} type={t.type} />
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
