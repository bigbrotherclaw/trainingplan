import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronDown, ChevronUp, Dumbbell, Waves, Trophy } from 'lucide-react'
import { format } from 'date-fns'

const TYPE_COLORS = {
  strength: { bg: 'bg-blue-900/30', border: 'border-blue-800', text: 'text-blue-300', label: 'STR' },
  tri: { bg: 'bg-teal-900/30', border: 'border-teal-800', text: 'text-teal-300', label: 'TRI' },
  long: { bg: 'bg-violet-900/30', border: 'border-violet-800', text: 'text-violet-300', label: 'LONG' },
}

export default function History() {
  const { workoutHistory } = useApp()
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState({})

  const filtered = useMemo(() => {
    let h = [...workoutHistory].reverse()
    if (filter !== 'all') h = h.filter((e) => e.type === filter)
    return h
  }, [workoutHistory, filter])

  return (
    <div className="p-4 pb-8">
      <h2 className="text-lg font-bold text-slate-100 mb-4">History</h2>

      <div className="flex gap-2 mb-4">
        {[{ id: 'all', label: 'All' }, { id: 'strength', label: 'Strength' }, { id: 'tri', label: 'Tri' }, { id: 'long', label: 'Long' }].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${filter === f.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-slate-400'}`}
          >{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 && <div className="text-center text-slate-600 py-8">No workouts logged yet</div>}

      <div className="space-y-2">
        {filtered.map((entry, idx) => {
          const tc = TYPE_COLORS[entry.type] || TYPE_COLORS.strength
          const isExpanded = expanded[idx]
          return (
            <div key={idx} className={`${tc.bg} border ${tc.border} rounded-lg overflow-hidden`}>
              <button onClick={() => setExpanded((p) => ({ ...p, [idx]: !isExpanded }))} className="w-full p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${tc.bg} ${tc.text}`}>{tc.label}</span>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-200">{entry.workoutName}</div>
                    <div className="text-[10px] text-slate-500">{format(new Date(entry.date), 'EEE, MMM d yyyy')}</div>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 text-xs text-slate-400 space-y-1 border-t border-gray-800 pt-2">
                  {entry.type === 'strength' && (
                    <>
                      {Array.isArray(entry.details?.lifts) && entry.details.lifts.map((l, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-slate-300">{l.name}</span>
                          <span>{l.weight} lbs x {l.reps} ({l.setsCompleted} sets)</span>
                        </div>
                      ))}
                      {Array.isArray(entry.details?.accessories) && entry.details.accessories.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-700">
                          <div className="text-[10px] text-slate-500 uppercase mb-1">Accessories</div>
                          {entry.details.accessories.map((a, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-slate-300">{a.name}</span>
                              <span>{a.weight || 0} lbs x {a.reps} ({a.setsCompleted} sets)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {entry.type === 'tri' && (
                    <>
                      {entry.details?.cardio && (
                        <div>
                          <span className="text-slate-300">Cardio: {entry.details.cardio.name}</span>
                          {entry.details.cardio.metrics && Object.entries(entry.details.cardio.metrics).filter(([,v]) => v).map(([k, v]) => (
                            <div key={k} className="ml-2">- {k}: {v}</div>
                          ))}
                        </div>
                      )}
                      {entry.details?.hic && (
                        <div className="mt-1">
                          <span className="text-slate-300">HIC: {entry.details.hic.skipped ? 'Skipped' : entry.details.hic.name}</span>
                          {entry.details.hic.metrics && Object.entries(entry.details.hic.metrics).filter(([,v]) => v).map(([k, v]) => (
                            <div key={k} className="ml-2">- {k}: {v}</div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {entry.type === 'long' && (
                    <>
                      {entry.details?.cardio && (
                        <div>
                          <span className="text-slate-300">Cardio: {entry.details.cardio.name}</span>
                          {entry.details.cardio.metrics && Object.entries(entry.details.cardio.metrics).filter(([,v]) => v).map(([k, v]) => (
                            <div key={k} className="ml-2">- {k}: {v}</div>
                          ))}
                        </div>
                      )}
                      {entry.details?.notes && <div className="mt-1 text-slate-300">Notes: {entry.details.notes}</div>}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
