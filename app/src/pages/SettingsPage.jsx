import { useState, useRef } from 'react';
import { Download, Upload, ChevronRight, Activity, Moon, Zap, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';

export default function SettingsPage({ showToast, onNavigateToSocial }) {
  const { settings, setSettings, workoutHistory, setWorkoutHistory, setWorkoutOverrides, setWeekSwaps } = useApp();
  const { connected: whoopConnected, loading: whoopLoading, syncing, connect: whoopConnect, disconnect: whoopDisconnect, syncData: whoopSync, latestRecovery, latestSleep } = useWhoop();
  const [resetConfirmPending, setResetConfirmPending] = useState(false);
  const resetTimerRef = useRef(null);
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
    showToast('All data reset');
  };

  const handleResetClick = () => {
    if (resetConfirmPending) {
      handleReset();
      setResetConfirmPending(false);
      clearTimeout(resetTimerRef.current);
    } else {
      setResetConfirmPending(true);
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setResetConfirmPending(false), 3000);
    }
  };

  const StepperRow = ({ label, settingsKey, step = 5, unit, showUnit = true }) => (
    <div className="flex items-center justify-between px-5 py-4 min-h-[52px]">
      <span className="text-[17px] text-white">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => decrement(settingsKey, step)}
          className="w-11 h-11 rounded-xl bg-[#1A1A1A] text-[#A0A0A0] text-[20px] font-medium flex items-center justify-center active:bg-[#222222]"
        >
          −
        </button>
        <span className="text-[20px] font-bold text-white w-16 text-center">
          {settings[settingsKey] || 0}
        </span>
        <button
          onClick={() => increment(settingsKey, step)}
          className="w-11 h-11 rounded-xl bg-[#1A1A1A] text-[#A0A0A0] text-[20px] font-medium flex items-center justify-center active:bg-[#222222]"
        >
          +
        </button>
        {showUnit && <span className="text-[13px] text-[#555555] ml-1">{unit || 'lbs'}</span>}
      </div>
    </div>
  );

  return (
    <div className="px-5 pt-4 pb-28 min-h-screen bg-black space-y-5">
      <h2 className="text-[28px] font-bold text-white mb-2">Settings</h2>

      {/* Card 1: PROFILE */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden">
        <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold px-5 pt-5 pb-3">Profile</p>
        <div className="px-5 pb-5">
          <input
            type="text"
            value={settings.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Your name"
            className="w-full bg-[#1A1A1A] rounded-xl px-4 py-3.5 min-h-[48px] text-[17px] text-white"
          />
        </div>
      </div>

      {/* Card 2: 1RM VALUES */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden">
        <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold px-5 pt-5 pb-3">1RM Values</p>
        <StepperRow label="Bench Press" settingsKey="benchPress1RM" />
        <div className="border-b border-white/[0.04] mx-5" />
        <StepperRow label="Back Squat" settingsKey="squat1RM" />
        <div className="border-b border-white/[0.04] mx-5" />
        <StepperRow label="Weighted Pull-up" settingsKey="weightedPullup1RM" />
      </div>

      {/* Card 3: PROGRAM */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden">
        <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold px-5 pt-5 pb-3">Program</p>
        <StepperRow label="Current Block" settingsKey="block" step={1} showUnit={false} />
        <div className="border-b border-white/[0.04] mx-5" />
        <StepperRow label="Current Week (1–6)" settingsKey="week" step={1} showUnit={false} />
      </div>

      {/* Card 4: LACTATE THRESHOLDS */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden">
        <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold px-5 pt-5 pb-3">Lactate Thresholds</p>

        <div className="flex items-center justify-between px-5 py-4 min-h-[52px]">
          <span className="text-[17px] text-white">Run LT Pace</span>
          <div className="flex items-center">
            <input
              type="text"
              placeholder="6:30"
              value={secondsToMinSec(settings.runLTPace)}
              onChange={(e) => handleChange('runLTPace', minSecToSeconds(e.target.value))}
              className="bg-[#1A1A1A] rounded-xl px-4 py-3 min-h-[44px] text-[17px] text-white text-right w-28"
            />
            <span className="text-[13px] text-[#555555] ml-2">min/mi</span>
          </div>
        </div>
        <div className="border-b border-white/[0.04] mx-5" />

        <div className="flex items-center justify-between px-5 py-4 min-h-[52px]">
          <span className="text-[17px] text-white">Run LT HR</span>
          <div className="flex items-center">
            <input
              type="number"
              value={settings.runLTHR || ''}
              onChange={(e) => handleChange('runLTHR', e.target.value)}
              className="bg-[#1A1A1A] rounded-xl px-4 py-3 min-h-[44px] text-[17px] text-white text-right w-28"
            />
            <span className="text-[13px] text-[#555555] ml-2">bpm</span>
          </div>
        </div>
        <div className="border-b border-white/[0.04] mx-5" />

        <div className="flex items-center justify-between px-5 py-4 min-h-[52px]">
          <span className="text-[17px] text-white">Bike FTP</span>
          <div className="flex items-center">
            <input
              type="number"
              value={settings.bikeFTP || ''}
              onChange={(e) => handleChange('bikeFTP', e.target.value)}
              className="bg-[#1A1A1A] rounded-xl px-4 py-3 min-h-[44px] text-[17px] text-white text-right w-28"
            />
            <span className="text-[13px] text-[#555555] ml-2">watts</span>
          </div>
        </div>
        <div className="border-b border-white/[0.04] mx-5" />

        <div className="flex items-center justify-between px-5 py-4 min-h-[52px]">
          <span className="text-[17px] text-white">Bike LT HR</span>
          <div className="flex items-center">
            <input
              type="number"
              value={settings.bikeLTHR || ''}
              onChange={(e) => handleChange('bikeLTHR', e.target.value)}
              className="bg-[#1A1A1A] rounded-xl px-4 py-3 min-h-[44px] text-[17px] text-white text-right w-28"
            />
            <span className="text-[13px] text-[#555555] ml-2">bpm</span>
          </div>
        </div>
      </div>

      {/* Card 5: SOCIAL */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden">
        <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold px-5 pt-5 pb-3">Social</p>
        <button
          onClick={onNavigateToSocial}
          className="flex items-center justify-between px-5 py-4 min-h-[52px] w-full"
        >
          <span className="text-[17px] text-white">Friends &amp; Leaderboard</span>
          <ChevronRight size={20} className="text-[#555555]" />
        </button>
      </div>

      {/* Card 6: INTEGRATIONS */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden">
        <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold px-5 pt-5 pb-3">Integrations</p>
        <div className="px-5 pb-5">
          {whoopLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={20} className="text-[#555555] animate-spin" />
            </div>
          ) : !whoopConnected ? (
            <button
              onClick={whoopConnect}
              className="w-full min-h-[48px] bg-[#1A1A1A] rounded-xl text-[15px] font-medium text-white flex items-center justify-center gap-2 border border-[#44b700]/30 active:bg-[#222222]"
            >
              <Activity size={16} className="text-[#44b700]" />
              Connect Whoop
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#44b700]" />
                <span className="text-[13px] text-[#888888]">Whoop connected</span>
              </div>

              {latestRecovery && (
                <div className="flex items-center justify-between bg-[#1A1A1A] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-[#44b700]" />
                    <span className="text-[15px] text-white">Recovery</span>
                  </div>
                  <span className="text-[17px] font-bold text-white">{latestRecovery.score ?? latestRecovery.recovery_score}%</span>
                </div>
              )}

              {latestSleep && (
                <div className="flex items-center justify-between bg-[#1A1A1A] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Moon size={14} className="text-[#8B8BF5]" />
                    <span className="text-[15px] text-white">Sleep</span>
                  </div>
                  <span className="text-[17px] font-bold text-white">{latestSleep.score ?? latestSleep.sleep_performance_percentage}%</span>
                </div>
              )}

              <button
                onClick={() => whoopSync(7)}
                disabled={syncing}
                className="w-full min-h-[48px] bg-[#1A1A1A] rounded-xl text-[15px] font-medium text-white flex items-center justify-center gap-2 active:bg-[#222222] disabled:opacity-50"
              >
                {syncing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>

              <button
                onClick={whoopDisconnect}
                className="w-full min-h-[44px] text-red-400/60 text-[13px] font-medium"
              >
                Disconnect Whoop
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card 7: DATA */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.10] overflow-hidden">
        <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold px-5 pt-5 pb-3">Data</p>

        <div className="px-5 pb-5 flex flex-col gap-3">
          <button
            onClick={handleExport}
            className="w-full min-h-[48px] bg-[#1A1A1A] rounded-xl text-[15px] font-medium text-white flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Export Data
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[48px] bg-[#1A1A1A] rounded-xl text-[15px] font-medium text-white flex items-center justify-center gap-2"
          >
            <Upload size={16} />
            Import Data
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {/* Card 8: DANGER ZONE */}
      <div className="bg-[#141414] rounded-2xl border border-red-500/10 overflow-hidden">
        <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold px-5 pt-5 pb-3">Danger Zone</p>
        <button
          onClick={handleResetClick}
          className="w-full min-h-[48px] text-red-400 text-[15px] font-medium px-5 py-4 text-left"
        >
          {resetConfirmPending ? 'Tap again to confirm' : 'Reset All Data'}
        </button>
      </div>
    </div>
  );
}
