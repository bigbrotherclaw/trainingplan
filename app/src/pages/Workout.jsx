import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Sparkles, Moon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { OPERATOR_LOADING, OPERATOR_LIFTS, ACCESSORIES, WEEKLY_TEMPLATE } from '../data/training';
import { BIKE_PRESETS, BIKE_ENDURANCE_PRESETS, RUN_PRESETS, RUN_ENDURANCE_PRESETS, SWIM_PRESETS, getCardioForWeek } from '../data/cardio';
import { HIC_PRESETS, HIC_INPUT_FIELDS, DEFAULT_HIC_FIELDS, getRecommendedHics } from '../data/hic';
import { getSwappedWorkoutForDate } from '../utils/workout';
import RestTimer from '../components/RestTimer';

export default function Workout({ showToast }) {
  const { settings, workoutHistory, setWorkoutHistory, weekSwaps } = useApp();
  const [selectedCardio, setSelectedCardio] = useState(null);
  const [cardioMetrics, setCardioMetrics] = useState({});
  const [selectedHic, setSelectedHic] = useState(null);
  const [skippedHic, setSkippedHic] = useState(false);
  const [liftData, setLiftData] = useState({});
  const [completedSets, setCompletedSets] = useState({});
  const [completedAccessorySets, setCompletedAccessorySets] = useState({});
  const [accessoryData, setAccessoryData] = useState({});
  const [hicMetrics, setHicMetrics] = useState({});
  const [longNotes, setLongNotes] = useState('');
  const [showAllHics, setShowAllHics] = useState(false);
  const [showAllCardio, setShowAllCardio] = useState(false);
  const [cardioModality, setCardioModality] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [expandedLifts, setExpandedLifts] = useState({});

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayWorkout = useMemo(() => getSwappedWorkoutForDate(today, weekSwaps), [today, weekSwaps]);
  const loadingInfo = OPERATOR_LOADING.find((l) => l.week === settings.week) || OPERATOR_LOADING[0];

  const todayLogged = useMemo(
    () => workoutHistory.some((e) => new Date(e.date).toDateString() === today.toDateString()),
    [workoutHistory, today]
  );

  useEffect(() => {
    if (todayWorkout.type === 'tri') {
      if (todayWorkout.name.includes('Run')) {
        setCardioModality('run');
      } else {
        const lastMod = getLastCardioModality();
        setCardioModality(lastMod === 'swim' ? 'bike' : 'swim');
      }
    } else if (todayWorkout.type === 'long') {
      setCardioModality('endurance-bike');
    }
  }, [todayWorkout.type, todayWorkout.name]);

  useEffect(() => {
    if (todayWorkout.type === 'strength' && todayWorkout.accessories) {
      const accs = ACCESSORIES[todayWorkout.accessories] || [];
      const prefill = {};
      let hasData = false;
      accs.forEach((acc) => {
        for (let i = workoutHistory.length - 1; i >= 0; i--) {
          const entry = workoutHistory[i];
          if (entry.details?.accessories) {
            const found = entry.details.accessories.find((a) => a.name === acc.name);
            if (found && found.weight) {
              prefill[`${acc.name}-weight`] = found.weight.toString();
              hasData = true;
              break;
            }
          }
        }
      });
      if (hasData) setAccessoryData((prev) => {
        const merged = { ...prefill };
        Object.keys(prev).forEach((k) => { if (prev[k]) merged[k] = prev[k]; });
        return merged;
      });
    }
  }, [todayWorkout.accessories]);

  function getLastCardioModality() {
    for (let i = workoutHistory.length - 1; i >= 0; i--) {
      const entry = workoutHistory[i];
      if (entry.type === 'tri' && entry.details?.cardio) {
        const name = entry.details.cardio.name;
        if (name.includes('Swim') || SWIM_PRESETS.some((p) => p.name === name)) return 'swim';
        if (name.includes('Bike') || BIKE_PRESETS.some((p) => p.name === name)) return 'bike';
      }
    }
    return null;
  }

  const getTodayLiftWeight = (liftName) => {
    const lift = OPERATOR_LIFTS.find((l) => l.name === liftName);
    if (!lift) return 0;
    return Math.round(settings[lift.settingsKey] * (loadingInfo.percentage / 100));
  };

  const getLastAccessoryData = (exerciseName) => {
    for (let i = workoutHistory.length - 1; i >= 0; i--) {
      const entry = workoutHistory[i];
      if (entry.details?.accessories) {
        const found = entry.details.accessories.find((a) => a.name === exerciseName);
        if (found) return found;
      }
    }
    return null;
  };

  const getCardioPresetsForModality = (showAll) => {
    let presets = [];
    if (cardioModality === 'swim') presets = SWIM_PRESETS;
    else if (cardioModality === 'bike') presets = BIKE_PRESETS;
    else if (cardioModality === 'run') presets = RUN_PRESETS;
    else if (cardioModality === 'endurance-bike') presets = BIKE_ENDURANCE_PRESETS;
    else if (cardioModality === 'endurance-run') presets = RUN_ENDURANCE_PRESETS;
    else return [];
    if (showAll) return presets;
    const weekPreset = getCardioForWeek(presets, settings.week);
    return weekPreset ? [weekPreset] : [presets[0]];
  };

  const getAvailableModalities = () => {
    if (todayWorkout.type === 'tri' && todayWorkout.name.includes('Run')) return [{ label: 'Run', value: 'run' }];
    if (todayWorkout.type === 'tri') return [{ label: 'Swim', value: 'swim' }, { label: 'Bike', value: 'bike' }];
    return [{ label: 'Endurance Bike', value: 'endurance-bike' }, { label: 'Z2 Run', value: 'endurance-run' }];
  };

  const recommendedHics = useMemo(() => getRecommendedHics(workoutHistory), [workoutHistory]);
  const hicFields = HIC_INPUT_FIELDS[selectedHic] || DEFAULT_HIC_FIELDS;

  const handleComplete = () => {
    if (todayWorkout.type === 'strength') {
      const lifts = OPERATOR_LIFTS.map((lift) => {
        const weight = parseInt(liftData[`${lift.name}-weight`]) || getTodayLiftWeight(lift.name);
        const reps = parseInt(liftData[`${lift.name}-reps`]) || loadingInfo.reps;
        let setsCompleted = 0;
        for (let i = 1; i <= loadingInfo.sets; i++) {
          if (completedSets[`${lift.name}-${i}`]) setsCompleted++;
        }
        return { name: lift.name, weight, reps, setsCompleted };
      });
      const accessories = (ACCESSORIES[todayWorkout.accessories] || []).map((acc) => {
        const weight = parseInt(accessoryData[`${acc.name}-weight`]) || 0;
        const reps = parseInt(accessoryData[`${acc.name}-reps`]) || acc.reps;
        let setsCompleted = 0;
        for (let i = 1; i <= acc.sets; i++) {
          if (completedAccessorySets[`${acc.name}-${i}`]) setsCompleted++;
        }
        return { name: acc.name, weight, reps, setsCompleted };
      });
      setWorkoutHistory((prev) => [...prev, {
        date: new Date().toISOString(),
        workoutName: todayWorkout.name,
        type: 'strength',
        details: { lifts, accessories, loading: { sets: loadingInfo.sets, reps: loadingInfo.reps, percentage: loadingInfo.percentage } },
      }]);
    } else if (todayWorkout.type === 'tri') {
      if (!selectedCardio) { showToast('Please select a cardio workout', 'error'); return; }
      if (!selectedHic && !skippedHic) { showToast('Please select an HIC or skip it', 'error'); return; }
      setWorkoutHistory((prev) => [...prev, {
        date: new Date().toISOString(),
        workoutName: todayWorkout.name,
        type: 'tri',
        details: {
          cardio: { name: selectedCardio, metrics: { ...cardioMetrics } },
          hic: skippedHic ? { name: 'Skipped', skipped: true } : { name: selectedHic, metrics: { ...hicMetrics } },
        },
      }]);
    } else if (todayWorkout.type === 'long') {
      if (!selectedCardio) { showToast('Please select a cardio workout', 'error'); return; }
      setWorkoutHistory((prev) => [...prev, {
        date: new Date().toISOString(),
        workoutName: todayWorkout.name,
        type: 'long',
        details: { cardio: { name: selectedCardio, metrics: { ...cardioMetrics } }, notes: longNotes },
      }]);
    }
    setShowCelebration(true);
    showToast('Workout logged!');
    setTimeout(() => setShowCelebration(false), 2500);
  };

  if (todayWorkout.type === 'rest') {
    return (
      <div className="px-4 py-8 text-center">
        <Moon size={48} className="text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-200 mb-2">Rest Day</h2>
        <p className="text-sm text-slate-500">Take time to recover and prepare for tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-8 space-y-4">
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="text-center">
              <Sparkles size={64} className="text-amber-400 mx-auto mb-4 animate-pulse" />
              <h2 className="text-3xl font-bold text-white mb-2">Workout Complete!</h2>
              <p className="text-slate-400">Great work today.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          <h2 className="text-lg font-bold text-white">{todayWorkout.name}</h2>
        </div>
        {todayWorkout.type === 'strength' && <RestTimer defaultSeconds={loadingInfo.restMin === '2 min' ? 120 : 180} />}
      </div>

      {todayLogged && (
        <div className="bg-emerald-950/50 border border-emerald-800/30 rounded-xl px-4 py-3 text-emerald-300 text-sm font-medium flex items-center gap-2">
          <Check size={16} /> Already logged today. Logging again will add another entry.
        </div>
      )}

      {/* STRENGTH */}
      {todayWorkout.type === 'strength' && (
        <div className="space-y-3">
          <div className="bg-dark-700 rounded-xl p-3 border border-white/5 text-center">
            <span className="text-sm text-slate-400">Week {settings.week}: </span>
            <span className="text-sm font-bold text-white">{loadingInfo.sets}x{loadingInfo.reps} @ {loadingInfo.percentage}%</span>
            <span className="text-xs text-slate-500 ml-2">Rest {loadingInfo.restMin}-{loadingInfo.restMax}</span>
          </div>

          {OPERATOR_LIFTS.map((lift) => {
            const weight = getTodayLiftWeight(lift.name);
            return (
              <div key={lift.name} className="bg-dark-700 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">{lift.name}</h3>
                  <span className="text-xs text-slate-500 bg-dark-500 px-2 py-0.5 rounded">{weight} lbs</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Weight</label>
                    <input type="number" placeholder={weight.toString()} value={liftData[`${lift.name}-weight`] || ''}
                      onChange={(e) => setLiftData((p) => ({ ...p, [`${lift.name}-weight`]: e.target.value }))}
                      className="w-full bg-dark-500 border border-white/5 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Reps</label>
                    <input type="number" placeholder={loadingInfo.reps.toString()} value={liftData[`${lift.name}-reps`] || ''}
                      onChange={(e) => setLiftData((p) => ({ ...p, [`${lift.name}-reps`]: e.target.value }))}
                      className="w-full bg-dark-500 border border-white/5 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {Array.from({ length: loadingInfo.sets }).map((_, i) => {
                    const key = `${lift.name}-${i + 1}`;
                    const done = completedSets[key];
                    return (
                      <button key={i} onClick={() => setCompletedSets((p) => ({ ...p, [key]: !p[key] }))}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          done ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/30' : 'bg-dark-600 text-slate-400 border border-white/5'
                        }`}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                          {done && <Check size={12} className="text-white" />}
                        </div>
                        Set {i + 1} of {loadingInfo.sets}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Accessories {todayWorkout.accessories}</h3>
            {(ACCESSORIES[todayWorkout.accessories] || []).map((acc, idx) => {
              const lastData = getLastAccessoryData(acc.name);
              const isExpanded = expandedLifts[acc.name] !== false;
              return (
                <div key={idx} className="bg-dark-700 rounded-xl p-4 border border-white/5 mb-2">
                  <button className="w-full flex items-center justify-between" onClick={() => setExpandedLifts((p) => ({ ...p, [acc.name]: !isExpanded }))}>
                    <div className="text-left">
                      <div className="font-medium text-white text-sm">{acc.name}</div>
                      <div className="text-xs text-slate-500">{acc.sets}x{acc.reps} - {acc.category}</div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </button>
                  {isExpanded && (
                    <div className="mt-3">
                      {lastData && <p className="text-[11px] text-slate-600 italic mb-2">Last: {lastData.weight || 0} lbs x {lastData.reps}</p>}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 block mb-1">Weight</label>
                          <input type="number" placeholder={lastData ? lastData.weight?.toString() : ''} value={accessoryData[`${acc.name}-weight`] || ''}
                            onChange={(e) => setAccessoryData((p) => ({ ...p, [`${acc.name}-weight`]: e.target.value }))}
                            className="w-full bg-dark-500 border border-white/5 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 block mb-1">Reps</label>
                          <input type="number" placeholder={acc.reps.toString()} value={accessoryData[`${acc.name}-reps`] || ''}
                            onChange={(e) => setAccessoryData((p) => ({ ...p, [`${acc.name}-reps`]: e.target.value }))}
                            className="w-full bg-dark-500 border border-white/5 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        {Array.from({ length: acc.sets }).map((_, i) => {
                          const key = `${acc.name}-${i + 1}`;
                          const done = completedAccessorySets[key];
                          return (
                            <button key={i} onClick={() => setCompletedAccessorySets((p) => ({ ...p, [key]: !p[key] }))}
                              className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                done ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/30' : 'bg-dark-600 text-slate-400 border border-white/5'
                              }`}>
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                {done && <Check size={10} className="text-white" />}
                              </div>
                              Set {i + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TRI / LONG - Cardio Section */}
      {(todayWorkout.type === 'tri' || todayWorkout.type === 'long') && (
        <div className="space-y-3">
          <div className="bg-dark-700 rounded-xl p-4 border border-white/5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Cardio Session</h3>
            {getAvailableModalities().length > 1 && (
              <div className="flex gap-1 mb-3 bg-dark-800 rounded-lg p-0.5">
                {getAvailableModalities().map((mod) => (
                  <button key={mod.value}
                    onClick={() => { setCardioModality(mod.value); setSelectedCardio(null); setCardioMetrics({}); }}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${
                      cardioModality === mod.value ? 'bg-accent-blue text-white' : 'text-slate-500'
                    }`}>
                    {mod.label}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {getCardioPresetsForModality(showAllCardio).map((preset, idx) => (
                <button key={idx}
                  onClick={() => { setSelectedCardio(preset.name); setCardioMetrics({}); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCardio === preset.name ? 'bg-accent-blue/10 border-accent-blue/40 text-white' : 'bg-dark-600 border-white/5 text-slate-300'
                  }`}>
                  <div className="font-medium text-sm">{preset.name}{preset.week ? ` (Wk ${preset.week})` : ''}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{preset.time}{preset.distance ? ` / ${preset.distance}` : ''}</div>
                  <div className="text-xs text-slate-400 mt-2 whitespace-pre-line leading-relaxed">{preset.description}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowAllCardio(!showAllCardio)}
              className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-accent-blue transition-colors">
              {showAllCardio ? 'Show This Week Only' : 'Show All Weeks'}
            </button>
          </div>

          {selectedCardio && (
            <div className="bg-dark-700 rounded-xl p-4 border border-white/5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">{selectedCardio} - Log</h3>
              {(() => {
                const preset = getCardioPresetsForModality(true).find((p) => p.name === selectedCardio);
                return preset?.inputFields?.map((field, idx) => (
                  <div key={idx} className="mb-3">
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">{field.label}</label>
                    <input type={field.type} placeholder={field.label} value={cardioMetrics[field.key] || ''}
                      onChange={(e) => setCardioMetrics((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full bg-dark-500 border border-white/5 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                ));
              })()}
            </div>
          )}

          {/* HIC Section - only for tri */}
          {todayWorkout.type === 'tri' && (
            <div className="bg-dark-700 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-200">HIC</h3>
                <button
                  onClick={() => { setSkippedHic(!skippedHic); if (!skippedHic) { setSelectedHic(null); setHicMetrics({}); } }}
                  className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                    skippedHic ? 'bg-amber-600 border-amber-500 text-white' : 'border-slate-700 text-slate-500 hover:border-amber-600'
                  }`}>
                  {skippedHic ? 'HIC Skipped' : 'Skip HIC'}
                </button>
              </div>
              {!skippedHic && (
                <div className="space-y-2">
                  {recommendedHics.map((hic, idx) => (
                    <button key={idx}
                      onClick={() => { setSelectedHic(hic.name); setSkippedHic(false); setHicMetrics({}); }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedHic === hic.name ? 'bg-accent-blue/10 border-accent-blue/40' : 'bg-dark-600 border-white/5'
                      }`}>
                      <div className="text-[10px] text-slate-500 uppercase">{hic.category}</div>
                      <div className="font-medium text-sm text-white">{hic.name}</div>
                      <div className="text-[11px] text-slate-500">{hic.time}</div>
                      <div className="text-xs text-slate-400 mt-1">{hic.description}</div>
                    </button>
                  ))}
                </div>
              )}
              {skippedHic && <p className="text-center text-sm text-slate-600 italic py-4">HIC skipped for today</p>}
              {!skippedHic && (
                <button onClick={() => setShowAllHics(!showAllHics)}
                  className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-accent-blue transition-colors">
                  {showAllHics ? 'Hide All HICs' : 'Show All HICs'}
                </button>
              )}
              {!skippedHic && showAllHics && (
                <div className="mt-2 space-y-1">
                  {HIC_PRESETS.map((hic, idx) => (
                    <button key={idx}
                      onClick={() => { setSelectedHic(hic.name); setSkippedHic(false); setHicMetrics({}); setShowAllHics(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        selectedHic === hic.name ? 'bg-accent-blue/10 border border-accent-blue/40 text-white' : 'bg-dark-600 text-slate-400 border border-white/5'
                      }`}>
                      <span className="font-medium">{hic.name}</span>
                      <span className="text-slate-600 ml-2">{hic.time}</span>
                    </button>
                  ))}
                </div>
              )}
              {!skippedHic && selectedHic && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <h4 className="text-xs font-semibold text-slate-400 mb-2">{selectedHic} - Log</h4>
                  {hicFields.map((field, idx) => (
                    <div key={idx} className="mb-2">
                      <label className="text-[10px] uppercase text-slate-500 block mb-1">{field.label}</label>
                      <input type={field.type} placeholder={field.label} value={hicMetrics[field.key] || ''}
                        onChange={(e) => setHicMetrics((p) => ({ ...p, [field.key]: e.target.value }))}
                        className="w-full bg-dark-500 border border-white/5 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Long notes */}
          {todayWorkout.type === 'long' && (
            <div className="bg-dark-700 rounded-xl p-4 border border-white/5">
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Workout Notes</label>
              <textarea value={longNotes} onChange={(e) => setLongNotes(e.target.value)}
                placeholder="Describe your workout..."
                className="w-full bg-dark-500 border border-white/5 rounded-lg px-3 py-2 text-sm text-white min-h-[100px] resize-y" />
            </div>
          )}
        </div>
      )}

      {todayWorkout.type !== 'rest' && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleComplete}
          className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase tracking-wider transition-colors"
        >
          Complete Workout
        </motion.button>
      )}
    </div>
  );
}
