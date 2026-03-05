import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react'

export default function SettingsPage() {
  const { settings, setSettings, exportData, importData, resetAll, addToast } = useApp()
  const [showReset, setShowReset] = useState(false)
  const fileRef = useRef(null)

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => importData(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  const fields = [
    { section: '1RM Values', items: [
      { key: 'benchPress1RM', label: 'Bench Press 1RM (lbs)', type: 'number' },
      { key: 'squat1RM', label: 'Back Squat 1RM (lbs)', type: 'number' },
      { key: 'weightedPullup1RM', label: 'Weighted Pull-up 1RM (lbs)', type: 'number' },
    ]},
    { section: 'Program', items: [
      { key: 'block', label: 'Current Block', type: 'number' },
      { key: 'week', label: 'Current Week (1-6)', type: 'number' },
    ]},
    { section: 'Lactate Threshold', items: [
      { key: 'runLTPace', label: 'Run LT Pace (min/mi)', type: 'number' },
      { key: 'runLTHR', label: 'Run LTHR (bpm)', type: 'number' },
      { key: 'bikeFTP', label: 'Bike FTP (watts)', type: 'number' },
      { key: 'bikeLTHR', label: 'Bike LTHR (bpm)', type: 'number' },
    ]},
  ]

  return (
    <div className="p-4 pb-8">
      <h2 className="text-lg font-bold text-slate-100 mb-4">Settings</h2>

      {fields.map((section) => (
        <div key={section.section} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 mb-3">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-3">{section.section}</div>
          {section.items.map((f) => (
            <div key={f.key} className="mb-3 last:mb-0">
              <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
              <input
                type={f.type}
                value={settings[f.key] || ''}
                onChange={(e) => update(f.key, f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                className="w-full bg-[#2a2a2a] border border-gray-700 text-slate-200 px-3 py-2 rounded text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      ))}

      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 mb-3">
        <div className="text-[10px] text-slate-500 uppercase font-semibold mb-3">Data</div>
        <div className="space-y-2">
          <button onClick={exportData} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
            <Download size={16} /> Export JSON
          </button>
          <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-slate-200 text-sm font-semibold transition-colors">
            <Upload size={16} /> Import JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-red-900/50 rounded-lg p-4">
        <div className="text-[10px] text-red-400 uppercase font-semibold mb-3">Danger Zone</div>
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm font-semibold border border-red-900 transition-colors">
            <Trash2 size={16} /> Reset All Data
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle size={16} /> This will delete all your workout data!
            </div>
            <div className="flex gap-2">
              <button onClick={() => { resetAll(); setShowReset(false) }} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">
                Confirm Reset
              </button>
              <button onClick={() => setShowReset(false)} className="flex-1 py-2 rounded-lg bg-gray-700 text-slate-300 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
