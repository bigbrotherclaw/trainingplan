import { useState, useRef } from 'react';
import { Download, Upload, ChevronRight, Activity, Moon, Zap, Heart, Clock, Loader2, Watch } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWhoop } from '../hooks/useWhoop';
import { useGarmin } from '../hooks/useGarmin';
import { getGarminActivityName, formatGarminDuration, garminMetersToMiles } from '../utils/garminSports';

export default function SettingsPage({ showToast, onNavigateToSocial }) {
  const { settings, setSettings, workoutHistory, setWorkoutHistory, setWorkoutOverrides, setWeekSwaps } = useApp();
  const { connected: whoopConnected, loading: whoopLoading, syncing, connect: whoopConnect, disconnect: whoopDisconnect, syncData: whoopSync, latestRecovery, latestSleep } = useWhoop();
  const { connected: garminConnected, loading: garminLoading, syncing: garminSyncing, activities: garminActivities, connect: garminConnect, verifyMfa: garminVerifyMfa, disconnect: garminDisconnect, syncData: garminSync } = useGarmin();
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminError, setGarminError] = useState('');
  const [garminConnecting, setGarminConnecting] = useState(false);
  const [garminMfaPending, setGarminMfaPending] = useState(false);
  const [garminMfaCode, setGarminMfaCode] = useState('');
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

  const formatSleepDuration = (sleepScore) => {
    if (!sleepScore?.stage_summary) return '--';
    const totalInBed = sleepScore.stage_summary.total_in_bed_time_milli ?? 0;
    const totalAwake = sleepScore.stage_summary.total_awake_time_milli ?? 0;
    const sleepMs = totalInBed - totalAwake;
    if (sleepMs <= 0) return '--';
    const hours = Math.floor(sleepMs / 3600000);
    const mins = Math.floor((sleepMs % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  const formatSyncedAgo = (record) => {
    const ts = record?.updated_at || record?.created_at || record?.date;
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 0) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const MetricTile = ({ icon: Icon, iconColor, label, value, unit }) => (
    <div className="bg-[#1A1A1A] rounded-xl px-3 py-2.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={iconColor} />
        <span className="text-[11px] text-[#888888] uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[20px] font-bold text-white leading-tight">{value}</span>
        {unit && <span className="text-[11px] text-[#555555]">{unit}</span>}
      </div>
    </div>
  );

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

  const handleGarminConnect = async () => {
    if (!garminEmail || !garminPassword) {
      setGarminError('Email and password are required');
      return;
    }
    setGarminError('');
    setGarminConnecting(true);
    try {
      const result = await garminConnect(garminEmail, garminPassword);
      if (result.error) {
        setGarminError(result.error);
      } else if (result.needsMfa) {
        setGarminMfaPending(true);
        setGarminError('');
      } else {
        setGarminEmail('');
        setGarminPassword('');
      }
    } catch (err) {
      setGarminError(err.message || 'Connection failed');
    } finally {
      setGarminConnecting(false);
    }
  };

  const handleGarminMfa = async () => {
    if (!garminMfaCode) {
      setGarminError('Enter the verification code from your email');
      return;
    }
    setGarminError('');
    setGarminConnecting(true);
    try {
      const result = await garminVerifyMfa(garminMfaCode);
      if (result.error) {
        setGarminError(result.error);
      } else {
        setGarminMfaPending(false);
        setGarminMfaCode('');
        setGarminEmail('');
        setGarminPassword('');
      }
    } catch (err) {
      setGarminError(err.message || 'Verification failed');
    } finally {
      setGarminConnecting(false);
    }
  };

  const latestGarmin = garminActivities.length > 0 ? garminActivities[garminActivities.length - 1] : null;

  const recoveryScore = latestRecovery?.score?.recovery_score ?? '--';
  const hrv = latestRecovery?.score?.hrv_rmssd_milli != null
    ? Math.round(latestRecovery.score.hrv_rmssd_milli * 10) / 10
    : '--';
  const rhr = latestRecovery?.score?.resting_heart_rate ?? '--';
  const sleepPct = latestSleep?.score?.sleep_performance_percentage ?? '--';
  const sleepDuration = formatSleepDuration(latestSleep?.score);
  const syncedAgo = formatSyncedAgo(latestRecovery);

  return (
    <div className="px-5 pt-4 pb-36 bg-black space-y-8">
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#44b700]" />
                  <span className="text-[13px] text-[#888888]">Whoop connected</span>
                </div>
                {syncedAgo && (
                  <span className="text-[11px] text-[#555555]">Last synced: {syncedAgo}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <MetricTile
                  icon={Zap}
                  iconColor="text-[#44b700]"
                  label="Recovery"
                  value={recoveryScore !== '--' ? `${recoveryScore}` : '--'}
                  unit="%"
                />
                <MetricTile
                  icon={Activity}
                  iconColor="text-[#44b700]"
                  label="HRV"
                  value={hrv}
                  unit="ms"
                />
                <MetricTile
                  icon={Heart}
                  iconColor="text-red-400"
                  label="RHR"
                  value={rhr}
                  unit="bpm"
                />
                <MetricTile
                  icon={Moon}
                  iconColor="text-[#8B8BF5]"
                  label="Sleep"
                  value={sleepPct !== '--' ? `${sleepPct}` : '--'}
                  unit="%"
                />
                <div className="col-span-2">
                  <MetricTile
                    icon={Clock}
                    iconColor="text-[#8B8BF5]"
                    label="Sleep Duration"
                    value={sleepDuration}
                  />
                </div>
              </div>

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

          {/* Divider between Whoop and Garmin */}
          <div className="border-t border-white/[0.08] my-4" />

          {/* Garmin Section */}
          {garminLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={20} className="text-[#555555] animate-spin" />
            </div>
          ) : !garminConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Watch size={16} className="text-[#007dff]" />
                <span className="text-[13px] text-[#888888]">Garmin Connect</span>
              </div>
              {!garminMfaPending ? (
                <>
                  <input
                    type="email"
                    value={garminEmail}
                    onChange={(e) => setGarminEmail(e.target.value)}
                    placeholder="Garmin email"
                    className="w-full bg-[#1A1A1A] rounded-xl px-4 py-3.5 min-h-[48px] text-[15px] text-white placeholder-[#555]"
                  />
                  <input
                    type="password"
                    value={garminPassword}
                    onChange={(e) => setGarminPassword(e.target.value)}
                    placeholder="Garmin password"
                    className="w-full bg-[#1A1A1A] rounded-xl px-4 py-3.5 min-h-[48px] text-[15px] text-white placeholder-[#555]"
                  />
                </>
              ) : (
                <>
                  <p className="text-[13px] text-[#007dff]">
                    Check your email for a verification code from Garmin.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={garminMfaCode}
                    onChange={(e) => setGarminMfaCode(e.target.value)}
                    placeholder="Enter verification code"
                    className="w-full bg-[#1A1A1A] rounded-xl px-4 py-3.5 min-h-[48px] text-[15px] text-white placeholder-[#555] text-center tracking-widest"
                    maxLength={6}
                    autoFocus
                  />
                </>
              )}
              {garminError && (
                <p className="text-[13px] text-red-400">{garminError}</p>
              )}
              <button
                onClick={garminMfaPending ? handleGarminMfa : handleGarminConnect}
                disabled={garminConnecting}
                className="w-full min-h-[48px] bg-[#1A1A1A] rounded-xl text-[15px] font-medium text-white flex items-center justify-center gap-2 border border-[#007dff]/30 active:bg-[#222222] disabled:opacity-50"
              >
                {garminConnecting ? (
                  <Loader2 size={16} className="animate-spin text-[#007dff]" />
                ) : (
                  <Watch size={16} className="text-[#007dff]" />
                )}
                {garminConnecting ? 'Verifying...' : garminMfaPending ? 'Verify Code' : 'Connect Garmin'}
              </button>
              {garminMfaPending && (
                <button
                  onClick={() => { setGarminMfaPending(false); setGarminMfaCode(''); setGarminError(''); }}
                  className="w-full min-h-[36px] text-[#555] text-[13px]"
                >
                  Back to login
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#007dff]" />
                  <span className="text-[13px] text-[#888888]">Garmin connected</span>
                </div>
                <span className="text-[11px] text-[#555555]">{garminActivities.length} activities</span>
              </div>

              {latestGarmin && (
                <div className="bg-[#1A1A1A] rounded-xl px-3 py-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Watch size={12} className="text-[#007dff]" />
                    <span className="text-[11px] text-[#888888] uppercase tracking-wide">Latest Activity</span>
                  </div>
                  <div className="text-[15px] font-semibold text-white">{getGarminActivityName(latestGarmin)}</div>
                  <div className="flex items-center gap-3 text-[12px] text-[#777]">
                    <span>{formatGarminDuration(latestGarmin.duration)}</span>
                    {latestGarmin.distance > 0 && <span>{garminMetersToMiles(latestGarmin.distance)} mi</span>}
                    {latestGarmin.averageHR && <span>{latestGarmin.averageHR} bpm</span>}
                  </div>
                </div>
              )}

              <button
                onClick={() => garminSync(7)}
                disabled={garminSyncing}
                className="w-full min-h-[48px] bg-[#1A1A1A] rounded-xl text-[15px] font-medium text-white flex items-center justify-center gap-2 active:bg-[#222222] disabled:opacity-50"
              >
                {garminSyncing ? <Loader2 size={16} className="animate-spin" /> : <Watch size={16} className="text-[#007dff]" />}
                {garminSyncing ? 'Syncing...' : 'Sync Now'}
              </button>

              <button
                onClick={garminDisconnect}
                className="w-full min-h-[44px] text-red-400/60 text-[13px] font-medium"
              >
                Disconnect Garmin
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
