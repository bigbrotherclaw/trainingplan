import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Timer, ChevronDown, ChevronUp, PartyPopper, SkipForward } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { WEEKLY_TEMPLATE, OPERATOR_LOADING, OPERATOR_LIFTS, ACCESSORIES } from '../data/training'
import { HIC_PRESETS, HIC_INPUT_FIELDS, DEFAULT_HIC_FIELDS } from '../data/hic'
import { SWIM_PRESETS, BIKE_PRESETS, RUN_PRESETS, BIKE_ENDURANCE_PRESETS, RUN_ENDURANCE_PRESETS, getCardioForWeek } from '../data/cardio'
import { getWorkoutForDate, getLoadingForWeek, getLiftWeight, getRecommendedHics, getLastCardioModality } from '../utils/workout'
import { format } from 'date-fns'

function RestTimer() {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <div className="flex items-center gap-3 bg-[#1a1a1a] border border-gray-800 rounded-lg px-3 py-2 mb-3">
      <Timer size={16} className="text-blue-400" />
      <span className="text-lg font-mono text-slate-200">{mins}:{secs.toString().padStart(2, '0')}</span>
      <button onClick={() => { setRunning(!running) }} className="px-3 py-1 text-xs rounded bg-blue-600 text-white font-semibold">
        {running ? 'Pause' : 'Start'}
      </button>
      <button onClick={() => { setSeconds(0); setRunning(false) }} className="px-3 py-1 text-xs rounded bg-gray-700 text-slate-300 font-semibold">
        Reset
      </button>
    </div>
  )
}

export default function Workout() {
  const { settings, workoutHistory, setWorkoutHistory, workoutOverrides, setWorkoutOverrides, addToast } = useApp()

  const [selectedCardio, setSelectedCardio] = useState(null)
  const [cardioMetrics, setCardioMetrics] = useState({})
  const [selectedHic, setSelectedHic] = useState(null)
  const [skippedHic, setSkippedHic] = useState(false)
  const [liftData, setLiftData] = useState({})
  const [completedSets, setCompletedSets] = useState({})
  const [completedAccessorySets, setCompletedAccessorySets] = useState({})
  const [accessoryData, setAccessoryData] = useState({})
  const [hicMetrics, setHicMetrics] = useState({})
  const [longNotes, setLongNotes] = useState('')
  const [showAllHics, setShowAllHics] = useState(false)
  const [showAllCardio, setShowAllCardio] = useState(false)
  const [cardioModality, setCardioModality] = useState(null)
  const [showWorkoutSelector, setShowWorkoutSelector] = useState(false)
  const [celebration, setCelebration] = useState(false)
  const [expandedAccessories, setExpandedAccessories] = useState({})

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const dateKey = today.toISOString().split('T')[0]
  const override = workoutOverrides?.[dateKey]

  let todayWorkout = getWorkoutForDate(today)
  if (override) {
    todayWorkout = Object.values(WEEKLY_TEMPLATE).find((w) => w.type === override.type) || todayWorkout
  }

  const loading = getLoadingForWeek(settings.week)

  useEffect(() => {
    if (todayWorkout.type === 'tri') {
      if (todayWorkout.name.includes('Run')) setCardioModality('run')
      else {
        const last = getLastCardioModality(workoutHistory, today.getDay())
        setCardioModality(last === 'swim' ? 'bike' : 'swim')
      }
    } else if (todayWorkout.type === 'long') {
      setCardioModality('endurance-bike')
    }
  }, [todayWorkout.type, todayWorkout.name])

  useEffect(() => {
    if (todayWorkout.type === 'strength' && todayWorkout.accessories) {
      const accs = ACCESSORIES[todayWorkout.accessories] || []
      const prefill = {}
      let has = false
      accs.forEach((acc) => {
        for (let i = workoutHistory.length - 1; i >= 0; i--) {
          const entry = workoutHistory[i]
          if (Array.isArray(entry.details?.accessories)) {
            const found = entry.details.accessories.find((a) => a.name === acc.name)
            if (found?.weight) { prefill[`${acc.name}-weight`] = found.weight.toString(); has = true; break }
          }
        }
      })
      if (has) setAccessoryData((prev) => {
        const merged = { ...prefill }
        Object.keys(prev).forEach((k) => { if (prev[k]) merged[k] = prev[k] })
        return merged
      })
    }
  }, [todayWorkout.accessories])

  const getCardioPresets = (showAll) => {
    let presets = []
    if (cardioModality === 'swim') presets = SWIM_PRESETS
    else if (cardioModality === 'bike') presets = BIKE_PRESETS
    else if (cardioModality === 'run') presets = RUN_PRESETS
    else if (cardioModality === 'endurance-bike') presets = BIKE_ENDURANCE_PRESETS
    else if (cardioModality === 'endurance-run') presets = RUN_ENDURANCE_PRESETS
    if (showAll) return presets
    const wp = getCardioForWeek(presets, settings.week)
    return wp ? [wp] : presets.length ? [presets[0]] : []
  }

  const getModalities = () => {
    if (todayWorkout.type === 'tri' && todayWorkout.name.includes('Run')) return [{ label: 'Run', value: 'run' }]
    if (todayWorkout.type === 'tri') return [{ label: 'Swim', value: 'swim' }, { label: 'Bike', value: 'bike' }]
    return [{ label: 'Endurance Bike', value: 'endurance-bike' }, { label: 'Z2 Run', value: 'endurance-run' }]
  }

  const recommendedHics = useMemo(() => getRecommendedHics(workoutHistory), [workoutHistory])

  const getLastAccessoryData = (name) => {
    for (let i = workoutHistory.length - 1; i >= 0; i--) {
      if (Array.isArray(workoutHistory[i].details?.accessories)) {
        const found = workoutHistory[i].details.accessories.find((a) => a.name === name)
        if (found) return found
      }
    }
    return null
  }

  const handleComplete = () => {
    if (todayWorkout.type === 'strength') {
      const lifts = OPERATOR_LIFTS.map((lift) => {
        const weight = parseInt(liftData[`${lift.name}-weight`]) || getLiftWeight(settings, lift.name, loading)
        const reps = parseInt(liftData[`${lift.name}-reps`]) || loading.reps
        let sc = 0
        for (let i = 1; i <= loading.sets; i++) if (completedSets[`${lift.name}-${i}`]) sc++
        return { name: lift.name, weight, reps, setsCompleted: sc }
      })
      const accessories = (ACCESSORIES[todayWorkout.accessories] || []).map((acc) => {
        const weight = parseInt(accessoryData[`${acc.name}-weight`]) || 0
        const reps = parseInt(accessoryData[`${acc.name}-reps`]) || acc.reps
        let sc = 0
        for (let i = 1; i <= acc.sets; i++) if (completedAccessorySets[`${acc.name}-${i}`]) sc++
        return { name: acc.name, weight, reps, setsCompleted: sc }
      })
      setWorkoutHistory((prev) => [...prev, {
        date: new Date().toISOString(), workoutName: todayWorkout.name, type: 'strength',
        details: { lifts, accessories, loading: { sets: loading.sets, reps: loading.reps, percentage: loading.percentage } }
      }])
    } else if (todayWorkout.type === 'tri') {
      if (!selectedCardio) { addToast('Select a cardio workout', 'error'); return }
      if (!selectedHic && !skippedHic) { addToast('Select HIC or skip', 'error'); return }
      setWorkoutHistory((prev) => [...prev, {
        date: new Date().toISOString(), workoutName: todayWorkout.name, type: 'tri',
        details: {
          cardio: { name: selectedCardio, metrics: { ...cardioMetrics } },
          hic: skippedHic ? { name: 'Skipped', skipped: true } : { name: selectedHic, metrics: { ...hicMetrics } }
        }
      }])
    } else if (todayWorkout.type === 'long') {
      if (!selectedCardio) { addToast('Select a cardio workout', 'error'); return }
      setWorkoutHistory((prev) => [...prev, {
        date: new Date().toISOString(), workoutName: todayWorkout.name, type: 'long',
        details: { cardio: { name: selectedCardio, metrics: { ...cardioMetrics } }, notes: longNotes }
      }])
    }

    setCelebration(true)
    addToast('Workout logged!')
    setTimeout(() => setCelebration(false), 3000)
    setLiftData({}); setCompletedSets({}); setAccessoryData({}); setCompletedAccessorySets({})
    setSelectedCardio(null); setCardioMetrics({}); setSelectedHic(null); setSkippedHic(false); setHicMetrics({}); setLongNotes('')
  }

  const hicFields = HIC_INPUT_FIELDS[selectedHic] || DEFAULT_HIC_FIELDS

  return (
    <div className="p-4 pb-8">
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setCelebration(false)}
          >
            <div className="text-center">
              <PartyPopper size={64} className="text-yellow-400 mx-auto mb-4" />
              <div className="text-3xl font-bold text-white">Workout Complete!</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Card */}
      <div className="bg-[#1a1a1a] border-2 border-blue-600 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-slate-400 mb-1">{format(today, 'EEEE, MMM d')}</div>
            <h2 className="text-lg font-bold text-slate-100">{todayWorkout.name}</h2>
          </div>
          <button onClick={() => setShowWorkoutSelector(!showWorkoutSelector)} className="px-3 py-1.5 text-xs rounded-md bg-gray-800 border border-gray-700 text-slate-300">
            Change
          </button>
        </div>
        {showWorkoutSelector && (
          <div className="mt-3 grid gap-2">
            {Object.entries(WEEKLY_TEMPLATE).map(([k, w]) => (
              <button key={k} onClick={() => {
                setWorkoutOverrides((p) => ({ ...p, [dateKey]: { type: w.type } }))
                setShowWorkoutSelector(false)
              }}
                className={`text-left p-2 rounded-md text-sm border ${todayWorkout.type === w.type ? 'border-blue-500 bg-blue-900/30' : 'border-gray-700 bg-gray-800/50'}`}
              >
                <div className="font-semibold text-slate-200">{w.short}</div>
                <div className="text-[10px] text-slate-500">{w.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rest Day */}
      {todayWorkout.type === 'rest' && (
        <div className="bg-[#1a1a1a] rounded-lg p-6 text-center">
          <div className="text-xl font-bold text-slate-300 mb-2">Rest Day</div>
          <p className="text-sm text-slate-500">Take time to recover and prepare for tomorrow.</p>
          <div className="text-xs text-slate-600 mt-3">Next: <strong>{WEEKLY_TEMPLATE[(today.getDay() + 1) % 7]?.short}</strong></div>
        </div>
      )}

      {/* Strength */}
      {todayWorkout.type === 'strength' && (
        <div className="space-y-3">
          <RestTimer />
          {OPERATOR_LIFTS.map((lift) => {
            const weight = getLiftWeight(settings, lift.name, loading)
            return (
              <div key={lift.name} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
                <div className="font-semibold text-slate-200 mb-1">{lift.name}</div>
                <div className="text-xs text-slate-500 mb-2">{loading.sets} x {loading.reps} @ {weight} lbs (Rest: {loading.restMin} - {loading.restMax})</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-slate-600 uppercase block mb-1">Weight</label>
                    <input type="number" placeholder={weight.toString()} value={liftData[`${lift.name}-weight`] || ''}
                      onChange={(e) => setLiftData((p) => ({ ...p, [`${lift.name}-weight`]: e.target.value }))}
                      className="w-full bg-[#2a2a2a] border border-gray-700 text-slate-200 px-2 py-1.5 rounded text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 uppercase block mb-1">Reps</label>
                    <input type="number" placeholder={loading.reps.toString()} value={liftData[`${lift.name}-reps`] || ''}
                      onChange={(e) => setLiftData((p) => ({ ...p, [`${lift.name}-reps`]: e.target.value }))}
                      className="w-full bg-[#2a2a2a] border border-gray-700 text-slate-200 px-2 py-1.5 rounded text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                {Array.from({ length: loading.sets }).map((_, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-slate-300 mb-1 cursor-pointer" onClick={() => setCompletedSets((p) => ({ ...p, [`${lift.name}-${i+1}`]: !p[`${lift.name}-${i+1}`] }))}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${completedSets[`${lift.name}-${i+1}`] ? 'bg-blue-600 border-blue-500' : 'border-gray-600'}`}>
                      {completedSets[`${lift.name}-${i+1}`] && <Check size={14} className="text-white" />}
                    </div>
                    Set {i+1} of {loading.sets}
                  </label>
                ))}
              </div>
            )
          })}

          <div className="mt-4">
            <h3 className="font-semibold text-slate-200 mb-3">Accessories {todayWorkout.accessories}</h3>
            {(ACCESSORIES[todayWorkout.accessories] || []).map((acc, idx) => {
              const last = getLastAccessoryData(acc.name)
              const expanded = expandedAccessories[idx] !== false
              return (
                <div key={idx} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 mb-2">
                  <button onClick={() => setExpandedAccessories((p) => ({ ...p, [idx]: !expanded }))} className="w-full flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-semibold text-slate-200 text-sm">{acc.name}</div>
                      <div className="text-[10px] text-slate-500">{acc.sets} x {acc.reps} {last ? `(last: ${last.weight || 0} lbs)` : ''}</div>
                    </div>
                    {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </button>
                  {expanded && (
                    <div className="mt-2">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-[10px] text-slate-600 uppercase block mb-1">Weight</label>
                          <input type="number" placeholder={last?.weight?.toString() || ''} value={accessoryData[`${acc.name}-weight`] || ''}
                            onChange={(e) => setAccessoryData((p) => ({ ...p, [`${acc.name}-weight`]: e.target.value }))}
                            className="w-full bg-[#2a2a2a] border border-gray-700 text-slate-200 px-2 py-1.5 rounded text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-600 uppercase block mb-1">Reps</label>
                          <input type="number" placeholder={acc.reps.toString()} value={accessoryData[`${acc.name}-reps`] || ''}
                            onChange={(e) => setAccessoryData((p) => ({ ...p, [`${acc.name}-reps`]: e.target.value }))}
                            className="w-full bg-[#2a2a2a] border border-gray-700 text-slate-200 px-2 py-1.5 rounded text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      {Array.from({ length: acc.sets }).map((_, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm text-slate-300 mb-1 cursor-pointer"
                          onClick={() => setCompletedAccessorySets((p) => ({ ...p, [`${acc.name}-${i+1}`]: !p[`${acc.name}-${i+1}`] }))}>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${completedAccessorySets[`${acc.name}-${i+1}`] ? 'bg-blue-600 border-blue-500' : 'border-gray-600'}`}>
                            {completedAccessorySets[`${acc.name}-${i+1}`] && <Check size={14} className="text-white" />}
                          </div>
                          Set {i+1} of {acc.sets}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tri / Long Cardio */}
      {(todayWorkout.type === 'tri' || todayWorkout.type === 'long') && (
        <div className="space-y-3">
          {/* Cardio */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
            <div className="font-semibold text-slate-200 mb-2 text-sm">Cardio Session</div>
            {getModalities().length > 1 && (
              <div className="flex gap-2 mb-3 border-b border-gray-700 pb-2">
                {getModalities().map((m) => (
                  <button key={m.value} onClick={() => { setCardioModality(m.value); setSelectedCardio(null); setCardioMetrics({}) }}
                    className={`px-3 py-1 text-xs font-semibold uppercase rounded-md transition-colors ${cardioModality === m.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-slate-400'}`}
                  >{m.label}</button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {getCardioPresets(showAllCardio).map((preset, idx) => (
                <div key={idx} onClick={() => { setSelectedCardio(preset.name); setCardioMetrics({}) }}
                  className={`p-3 rounded-md border cursor-pointer transition-all ${selectedCardio === preset.name ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'}`}
                >
                  <div className="font-semibold text-slate-200 text-sm">{preset.name}{preset.week ? ` (Wk ${preset.week})` : ''}</div>
                  <div className="text-[10px] text-slate-500">{preset.time}{preset.distance ? ` / ${preset.distance}` : ''}</div>
                  <div className="text-xs text-slate-400 mt-1 whitespace-pre-line leading-relaxed">{preset.description}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowAllCardio(!showAllCardio)}
              className="w-full mt-2 py-1.5 text-xs text-slate-500 bg-gray-800/50 rounded border border-gray-700 hover:text-blue-400 hover:border-blue-500 transition-colors"
            >{showAllCardio ? 'Show This Week Only' : 'Show All Weeks'}</button>
          </div>

          {/* Cardio Metrics */}
          {selectedCardio && (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
              <div className="font-semibold text-slate-200 mb-2 text-sm">{selectedCardio} - Log Metrics</div>
              {(() => {
                const preset = getCardioPresets(true).find((p) => p.name === selectedCardio)
                return preset?.inputFields?.map((f, i) => (
                  <div key={i} className="mb-2">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.label} value={cardioMetrics[f.key] || ''}
                      onChange={(e) => setCardioMetrics((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-[#2a2a2a] border border-gray-700 text-slate-200 px-2 py-1.5 rounded text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ))
              })()}
            </div>
          )}

          {/* HIC (tri only) */}
          {todayWorkout.type === 'tri' && (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold text-slate-200 text-sm">HIC Session</div>
                <button onClick={() => { setSkippedHic(!skippedHic); if (!skippedHic) { setSelectedHic(null); setHicMetrics({}) } }}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors ${skippedHic ? 'bg-amber-600 border-amber-500 text-white' : 'border-gray-600 text-slate-400 hover:border-amber-500'}`}
                >
                  <SkipForward size={12} className="inline mr-1" />
                  {skippedHic ? 'Skipped' : 'Skip HIC'}
                </button>
              </div>
              {!skippedHic && (
                <div className="space-y-2">
                  {(showAllHics ? HIC_PRESETS : recommendedHics).map((hic, idx) => (
                    <div key={idx} onClick={() => { setSelectedHic(hic.name); setSkippedHic(false); setHicMetrics({}) }}
                      className={`p-3 rounded-md border cursor-pointer transition-all ${selectedHic === hic.name ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'}`}
                    >
                      <div className="text-[10px] text-slate-500 uppercase">{hic.category}</div>
                      <div className="font-semibold text-slate-200 text-sm">{hic.name}</div>
                      <div className="text-[10px] text-slate-500">{hic.time}</div>
                      <div className="text-xs text-slate-400 mt-1">{hic.description}</div>
                    </div>
                  ))}
                  <button onClick={() => setShowAllHics(!showAllHics)}
                    className="w-full py-1.5 text-xs text-slate-500 bg-gray-800/50 rounded border border-gray-700 hover:text-blue-400 hover:border-blue-500 transition-colors"
                  >{showAllHics ? 'Show Recommended' : 'Show All HICs'}</button>
                </div>
              )}

              {selectedHic && !skippedHic && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  {hicFields.map((f, i) => (
                    <div key={i} className="mb-2">
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">{f.label}</label>
                      <input type={f.type} placeholder={f.label} value={hicMetrics[f.key] || ''}
                        onChange={(e) => setHicMetrics((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full bg-[#2a2a2a] border border-gray-700 text-slate-200 px-2 py-1.5 rounded text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Long notes */}
          {todayWorkout.type === 'long' && (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
              <label className="text-xs text-slate-500 uppercase block mb-1">Notes</label>
              <textarea value={longNotes} onChange={(e) => setLongNotes(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-gray-700 text-slate-200 px-3 py-2 rounded text-sm focus:border-blue-500 focus:outline-none min-h-[80px] resize-y"
                placeholder="Session notes..."
              />
            </div>
          )}
        </div>
      )}

      {/* Complete Button */}
      {todayWorkout.type !== 'rest' && (
        <button onClick={handleComplete}
          className="w-full mt-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase tracking-wider transition-colors"
        >
          Complete Workout
        </button>
      )}
    </div>
  )
}
