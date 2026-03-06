import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Dumbbell, Calendar, BarChart3, Settings } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Workout from './pages/Workout';
import CalendarPage from './pages/CalendarPage';
import Stats from './pages/Stats';
import SettingsPage from './pages/SettingsPage';
import Toast from './components/Toast';
import { useApp } from './context/AppContext';

const tabs = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'workout', label: 'Workout', icon: Dumbbell },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const { settings } = useApp();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} showToast={showToast} />;
      case 'workout':
        return <Workout showToast={showToast} />;
      case 'calendar':
        return <CalendarPage onNavigate={setActiveTab} />;
      case 'stats':
        return <Stats />;
      case 'settings':
        return <SettingsPage showToast={showToast} />;
      default:
        return <Dashboard onNavigate={setActiveTab} showToast={showToast} />;
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-black">
      <header className="shrink-0 sticky top-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/[0.03] px-5 py-3 safe-top">
        <h1 className="text-lg font-semibold text-white tracking-tight">Training Plan</h1>
        <p className="text-xs text-[#666666] mt-0.5">Block {settings.block} / Week {settings.week}</p>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="shrink-0 border-t border-white/[0.03] bg-black/90 backdrop-blur-xl flex justify-around items-center px-1 pb-safe">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-2.5 px-3 transition-colors ${
                isActive ? 'text-accent-blue' : 'text-[#666666] active:text-[#999999]'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-accent-blue" />
              )}
            </button>
          );
        })}
      </nav>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
