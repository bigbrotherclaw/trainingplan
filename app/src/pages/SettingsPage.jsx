import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, Trash2, Plus, Minus, Users } from 'lucide-react';
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
    <div className="mb-4 last:mb-0">
      <label className="text-xs text-[#666666] block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => decrement(settingsKey, step)}
          className="min-w-[44px] min-h-[44px] rounded-lg bg-[#222222] flex items-center justify-center text-[#666666] active:bg-[#2A2A2A] active:scale-[0.98] transition-transform"
        >
          <Minus size={16} />
        </button>
        <input
          type="number"
          value={settings[settingsKey] || ''}
          onChange={(e) => handleChange(settingsKey, e.target.value)}
          className="flex-1 bg-[#1A1A1A] border border-white/[0.06] rounded-xl px-4 py-3.5 min-h-[48px] text-center text-lg font-bold text-white"
        />
        <button
          onClick={() => increment(settingsKey, step)}
          className="min-w-[44px] min-h-[44px] rounded-lg bg-[#222222] flex items-center justify-center text-[#666666] active:bg-[#2A2A2A] active:scale-[0.98] transition-transform"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="px-5 pt-4 pb-24 bg-black min-h-screen space-y-4">
      <h2 className="text-2xl font-semibold text-white">Settings</h2>

      {/* Card 1: Profile */}
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Profile</h3>
        <div>
          <label className="text-xs text-[#666666] block mb-1">Name</label>
          <input
            type="text"
            value={settings.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-[#1A1A1A] border border-white/[0.06] rounded-xl px-4 py-3.5 min-h-[48px] text-sm text-white"
          />
        </div>
      </div>

      {/* Card 2: 1RM Values */}
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">1RM Values (lbs)</h3>
        <NumericField label="Bench Press" settingsKey="benchPress1RM" />
        <NumericField label="Back Squat" settingsKey="squat1RM" />
        <NumericField label="Weighted Pull-up" settingsKey="weightedPullup1RM" />
      </div>

      {/* Card 3: Program */}
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Program</h3>
        <NumericField label="Current Block" settingsKey="block" step={1} />
        <NumericField label="Current Week (1–6)" settingsKey="week" step={1} />
      </div>

      {/* Card 4: Lactate Thresholds */}
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Lactate Thresholds</h3>
        <div className="mb-4">
          <label className="text-xs text-[#666666] block mb-1">Run LT Pace (MM:SS per mile)</label>
          <input
            type="text"
            placeholder="6:30"
            value={secondsToMinSec(settings.runLTPace)}
            onChange={(e) => handleChange('runLTPace', minSecToSeconds(e.target.value))}
            className="w-full bg-[#1A1A1A] border border-white/[0.06] rounded-xl px-4 py-3.5 min-h-[48px] text-sm text-white"
          />
        </div>
        <NumericField label="Run LT Heart Rate (bpm)" settingsKey="runLTHR" step={1} />
        <NumericField label="Bike FTP (watts)" settingsKey="bikeFTP" step={5} />
        <NumericField label="Bike LT Heart Rate (bpm)" settingsKey="bikeLTHR" step={1} />
      </div>

      {/* Card 5: Social */}
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Social</h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
            <Users size={18} className="text-[#3B82F6]" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Friends &amp; Leaderboard</p>
            <p className="text-[#555555] text-xs mt-0.5">Add friends and compare training stats in the Social tab</p>
          </div>
        </div>
      </div>

      {/* Card 6: Data */}
      <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">Data</h3>
        <div className="space-y-2">
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-3 px-4 min-h-[48px] rounded-xl bg-[#1A1A1A] border border-white/[0.06] text-white text-sm font-medium active:bg-[#222222] active:scale-[0.98] transition-transform"
          >
            <Download size={18} className="text-accent-blue" />
            Export All Data
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 min-h-[48px] rounded-xl bg-[#1A1A1A] border border-white/[0.06] text-white text-sm font-medium active:bg-[#222222] active:scale-[0.98] transition-transform"
          >
            <Upload size={18} className="text-accent-green" />
            Import Data
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full flex items-center gap-3 px-4 min-h-[48px] rounded-xl border border-red-900/40 text-red-400 text-sm font-semibold active:bg-red-950/20 active:scale-[0.98] transition-transform"
          >
            <Trash2 size={18} />
            Reset All Data
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-[#111111] rounded-2xl p-6 mx-4 max-w-sm w-full border border-white/[0.06]">
            <h3 className="text-lg font-semibold text-white mb-2">Reset All Data?</h3>
            <p className="text-sm text-[#B3B3B3] mb-6">
              This will permanently delete all workout history and overrides. Settings will be kept.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 min-h-[48px] rounded-xl bg-[#1A1A1A] border border-white/[0.06] text-[#B3B3B3] font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 min-h-[48px] rounded-xl bg-red-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Reset
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
