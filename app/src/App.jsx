import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Dumbbell, Calendar, BarChart3, Settings } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Workout from './pages/Workout';
import CalendarPage from './pages/CalendarPage';
import Stats from './pages/Stats';
import SettingsPage from './pages/SettingsPage';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import MigrationModal from './components/MigrationModal';
import Toast from './components/Toast';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';

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

function UserAvatar({ user, profile, onClick }) {
  const name = profile?.display_name || user?.email || '';
  const initial = name[0]?.toUpperCase() || '?';
  return (
    <button
      onClick={onClick}
      aria-label="Profile"
      className="w-7 h-7 rounded-full bg-accent-blue flex items-center justify-center shrink-0 active:opacity-70 transition-opacity"
    >
      <span className="text-white text-[11px] font-semibold leading-none">{initial}</span>
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  const { settings, workoutHistory, needsMigration, migrateData } = useApp();
  const { user, profile, loading } = useAuth();

  // Show migration modal when needsMigration becomes true (only auto-open, never auto-close)
  useEffect(() => {
    if (needsMigration) setShowMigrationModal(true);
  }, [needsMigration]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleTabClick = (tabId) => {
    setShowProfile(false);
    setActiveTab(tabId);
  };

  const renderPage = () => {
    if (showProfile) return <ProfilePage />;
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

  // Blank screen while resolving session
  if (loading) {
    return <div className="h-dvh bg-black" />;
  }

  return (
    <AnimatePresence mode="wait">
      {!user ? (
        <motion.div
          key="auth"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <AuthPage />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col h-dvh bg-black"
        >
          <header className="shrink-0 sticky top-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/[0.03] px-5 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">Training Plan</h1>
              <p className="text-xs text-[#666666] mt-0.5">Block {settings.block} / Week {settings.week}</p>
            </div>
            <UserAvatar
              user={user}
              profile={profile}
              onClick={() => setShowProfile((v) => !v)}
            />
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={showProfile ? 'profile' : activeTab}
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

          <nav
            className="shrink-0 border-t border-white/[0.06] bg-black flex justify-around items-center px-1"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = !showProfile && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex flex-col items-center gap-1 py-3 px-3 min-h-[48px] transition-colors ${
                    isActive ? 'text-accent-blue' : 'text-[#666666] active:text-[#999999]'
                  }`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className="text-[11px] font-medium">{tab.label}</span>
                  {isActive && <div className="w-1 h-1 rounded-full bg-accent-blue" />}
                </button>
              );
            })}
          </nav>

          <AnimatePresence>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          </AnimatePresence>

          <AnimatePresence>
            {showMigrationModal && (
              <MigrationModal
                workoutCount={workoutHistory.length}
                onSync={migrateData}
                onStartFresh={() => setShowMigrationModal(false)}
                onDismiss={() => setShowMigrationModal(false)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
