import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { HIC_PRESETS } from '../data/hic'
import { OPERATOR_LOADING, OPERATOR_LIFTS, ACCESSORIES, WEEKLY_TEMPLATE } from '../data/training'
import { useApp } from '../context/AppContext'

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg">
        <span className="font-semibold text-slate-200 text-sm">{title}</span>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>
      {open && <div className="mt-1 space-y-2 pl-1">{children}</div>}
    </div>
  )
}

export default function Overview() {
  const { settings } = useApp()

  const categories = ['Aerobic-Anaerobic', 'General Conditioning', 'Power Development', 'Swim']

  return (
    <div className="p-4 pb-8">
      <h2 className="text-lg font-bold text-slate-100 mb-4">Program Overview</h2>

      <Section title="Weekly Template" defaultOpen={true}>
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
          {Object.entries(WEEKLY_TEMPLATE).map(([day, w]) => (
            <div key={day} className="flex items-center justify-between px-3 py-2 border-b border-gray-800 last:border-b-0">
              <span className="text-sm text-slate-200">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]}</span>
              <span className="text-xs text-slate-400">{w.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Operator Loading (6 Weeks)">
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-5 text-[10px] text-slate-500 uppercase p-2 border-b border-gray-800 font-semibold">
            <span>Week</span><span>Sets</span><span>Reps</span><span>%1RM</span><span>Rest</span>
          </div>
          {OPERATOR_LOADING.map((l) => (
            <div key={l.week} className={`grid grid-cols-5 text-sm px-2 py-1.5 border-b border-gray-800 last:border-b-0 ${l.week === settings.week ? 'bg-blue-900/20' : ''}`}>
              <span className="text-slate-300">Wk {l.week}</span>
              <span className="text-slate-400">{l.sets}</span>
              <span className="text-slate-400">{l.reps}</span>
              <span className="text-slate-400">{l.percentage}%</span>
              <span className="text-slate-500 text-xs">{l.restMin}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Main Lifts">
        <div className="space-y-2">
          {OPERATOR_LIFTS.map((l) => (
            <div key={l.name} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-slate-200">{l.name}</span>
              <span className="text-sm text-blue-400 font-semibold">{settings[l.settingsKey]} lbs 1RM</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Accessories">
        {Object.entries(ACCESSORIES).map(([group, accs]) => (
          <div key={group}>
            <div className="text-xs text-slate-500 uppercase font-semibold mb-1 mt-2">Group {group}</div>
            {accs.map((a, i) => (
              <div key={i} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-2 mb-1 flex justify-between">
                <span className="text-sm text-slate-300">{a.name}</span>
                <span className="text-xs text-slate-500">{a.sets}x{a.reps} ({a.category})</span>
              </div>
            ))}
          </div>
        ))}
      </Section>

      {categories.map((cat) => (
        <Section key={cat} title={`HIC: ${cat}`}>
          {HIC_PRESETS.filter((h) => h.category === cat).map((hic, idx) => (
            <div key={idx} className="bg-[#1a1a1a] border-l-2 border-blue-600 border-y border-r border-gray-800 rounded-r-lg p-3">
              <div className="font-semibold text-slate-200 text-sm">{hic.name}</div>
              <div className="text-[10px] text-slate-500 mb-1">{hic.time}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{hic.description}</div>
            </div>
          ))}
        </Section>
      ))}
    </div>
  )
}
