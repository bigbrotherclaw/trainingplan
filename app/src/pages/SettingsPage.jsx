import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, Trash2, Plus, Minus } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function SettingsPage({ showToast }) {
  const { settings, setSettings, workoutHistory, setWorkoutHistory, setWorkoutOverrides, setWeekSwaps } = useApp();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: isNaN(value) || value === '' ? value : Number(value) }));
  };

  const increment = (key, amount = 5) => {
    setSettings((prev) => ({ ...prev, [key]: (prev[key] || 0) + amount }));
  };

  const decrement = (key, amount = 5) => {
    setSettings((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) - amount) }));
  };

  const secondsToMinSec = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const minSecToSeconds = (str) => {
    if (!str) return 0;
    const parts = str.split(':');
    if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    return 0;
  };

  const handleExport = () => {
    const data = { settings, workoutHistory };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.settings) setSettings(data.settings);
        if (data.workoutHistory) setWorkoutHistory(data.workoutHistory);
        showToast('Data imported successfully');
      } catch {
        showToast('Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    setWorkoutHistory([]);
    setWorkoutOverrides({});
    setWeekSwaps({});
    localStorage.removeItem('trainingAppHistory');
    localStorage.removeItem('trainingAppOverrides');
    localStorage.removeItem('trainingAppWeekSwaps');
    setShowResetConfirm(false);
    showToast('All data reset');
  };

  const NumericField = ({ label, settingsKey, step = 5 }) => (
    <div className="mb-4">
      <label className="text-[10px] uppercase text-[#666666] block mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <button onClick={() => decrement(settingsKey, step)} className="w-10 h-10 rounded-lg bg-dark-500 border border-white/[0.03] flex items-center justify-center text-[#666666] active:bg-dark-400 active:scale-[0.98] transition-transform">
          <Minus size={16} />
        </button>
        <input type="number" value={settings[settingsKey] || ''} onChange={(e) => handleChange(settingsKey, e.target.value)}
          className="flex-1 bg-dark-500 border border-white/[0.03] rounded-lg px-3 py-2.5 text-center text-sm text-white font-semibold" />
        <button onClick={() => increment(settingsKey, step)} className="w-10 h-10 rounded-lg bg-dark-500 border border-white/[0.03] flex items-center justify-center text-[#666666] active:bg-dark-400 active:scale-[0.98] transition-transform">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      <h2 className="text-2xl font-semibold text-white">Settings</h2>

      {/* Profile */}
      <div className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03]">
        <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-widest mb-3">Profile</h3>
        <div>
          <label className="text-[10px] uppercase text-[#666666] block mb-1.5">Name</label>
          <input type="text" value={settings.name || ''} onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-dark-500 border border-white/[0.03] rounded-lg px-3 py-2.5 text-sm text-white" />
        </div>
      </div>

      {/* 1RM Values */}
      <div className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03]">
        <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-widest mb-3">1RM Values (lbs)</h3>
        <NumericField label="Bench Press" settingsKey="benchPress1RM" />
        <NumericField label="Back Squat" settingsKey="squat1RM" />
        <NumericField label="Weighted Pull-up" settingsKey="weightedPullup1RM" />
      </div>

      {/* Program Progress */}
      <div className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03]">
        <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-widest mb-3">Program Progress</h3>
        <NumericField label="Current Block" settingsKey="block" step={1} />
        <NumericField label="Current Week (1-6)" settingsKey="week" step={1} />
      </div>

      {/* Lactate Thresholds */}
      <div className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03]">
        <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-widest mb-3">Lactate Thresholds</h3>
        <div className="mb-4">
          <label className="text-[10px] uppercase text-[#666666] block mb-1.5">Run LT Pace (MM:SS per mile)</label>
          <input type="text" placeholder="6:30" value={secondsToMinSec(settings.runLTPace)}
            onChange={(e) => handleChange('runLTPace', minSecToSeconds(e.target.value))}
            className="w-full bg-dark-500 border border-white/[0.03] rounded-lg px-3 py-2.5 text-sm text-white" />
        </div>
        <NumericField label="Run LT Heart Rate (bpm)" settingsKey="runLTHR" step={1} />
        <NumericField label="Bike FTP (watts)" settingsKey="bikeFTP" step={5} />
        <NumericField label="Bike LT Heart Rate (bpm)" settingsKey="bikeLTHR" step={1} />
      </div>

      {/* Data Management */}
      <div className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03]">
        <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-widest mb-3">Data</h3>
        <div className="space-y-2">
          <button onClick={handleExport} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-500 border border-white/[0.03] text-white text-sm font-medium active:bg-dark-400 active:scale-[0.98] transition-transform">
            <Download size={18} className="text-accent-blue" />
            Export All Data
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-500 border border-white/[0.03] text-white text-sm font-medium active:bg-dark-400 active:scale-[0.98] transition-transform">
            <Upload size={18} className="text-accent-green" />
            Import Data
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={() => setShowResetConfirm(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-950/20 border border-red-900/20 text-red-400 text-sm font-medium active:bg-red-950/30 active:scale-[0.98] transition-transform">
            <Trash2 size={18} />
            Reset All Data
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl p-6 mx-4 max-w-sm w-full border border-white/[0.03]">
            <h3 className="text-lg font-semibold text-white mb-2">Reset All Data?</h3>
            <p className="text-sm text-[#B3B3B3] mb-6">This will permanently delete all workout history and overrides. Settings will be kept.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 rounded-xl bg-dark-500 text-[#B3B3B3] font-medium text-sm active:scale-[0.98] transition-transform">Cancel</button>
              <button onClick={handleReset} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium text-sm active:scale-[0.98] transition-transform">Reset</button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
