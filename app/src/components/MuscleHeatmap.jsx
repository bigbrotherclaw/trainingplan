import { getColorForPoints } from '../utils/workout'

export default function MuscleHeatmap({ musclePoints }) {
  const c = (key) => getColorForPoints(musclePoints[key] || 0)

  return (
    <div className="flex justify-center gap-8 flex-wrap">
      <div className="text-center">
        <div className="text-slate-400 text-[11px] uppercase tracking-wider mb-2">Front</div>
        <svg width="140" height="300" viewBox="0 0 160 340" className="max-w-full h-auto">
          <ellipse cx="80" cy="24" rx="18" ry="22" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
          <rect x="72" y="44" width="16" height="14" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <path d="M60 56 L72 50 L72 62 L60 66 Z" fill={c('traps')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M100 56 L88 50 L88 62 L100 66 Z" fill={c('traps')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="44" cy="72" rx="16" ry="12" fill={c('shoulders')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="116" cy="72" rx="16" ry="12" fill={c('shoulders')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M56 64 L80 62 L80 98 L56 90 Q48 82 56 64" fill={c('chest')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M104 64 L80 62 L80 98 L104 90 Q112 82 104 64" fill={c('chest')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="36" cy="104" rx="9" ry="20" fill={c('biceps')} stroke="#334155" strokeWidth="0.5" transform="rotate(-8 36 104)"/>
          <ellipse cx="124" cy="104" rx="9" ry="20" fill={c('biceps')} stroke="#334155" strokeWidth="0.5" transform="rotate(8 124 104)"/>
          <ellipse cx="32" cy="142" rx="7" ry="18" fill={c('forearms')} stroke="#334155" strokeWidth="0.5" transform="rotate(-4 32 142)"/>
          <ellipse cx="128" cy="142" rx="7" ry="18" fill={c('forearms')} stroke="#334155" strokeWidth="0.5" transform="rotate(4 128 142)"/>
          <rect x="62" y="98" width="36" height="50" rx="6" fill={c('core')} stroke="#334155" strokeWidth="0.5"/>
          <line x1="80" y1="100" x2="80" y2="146" stroke="#0e7490" strokeWidth="0.5"/>
          <path d="M56 98 L62 98 L62 146 L56 140 Q50 120 56 98" fill={c('obliques')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M104 98 L98 98 L98 146 L104 140 Q110 120 104 98" fill={c('obliques')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M62 148 L80 148 L74 168 L58 164 Z" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <path d="M98 148 L80 148 L86 168 L102 164 Z" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <path d="M54 168 L74 168 L72 248 L52 244 Q46 210 54 168" fill={c('quads')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M106 168 L86 168 L88 248 L108 244 Q114 210 106 168" fill={c('quads')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="62" cy="254" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="98" cy="254" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <path d="M52 262 L68 262 L66 316 L54 316 Q48 290 52 262" fill={c('shins')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M108 262 L92 262 L94 316 L106 316 Q112 290 108 262" fill={c('shins')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="60" cy="326" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="100" cy="326" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
        </svg>
      </div>
      <div className="text-center">
        <div className="text-slate-400 text-[11px] uppercase tracking-wider mb-2">Back</div>
        <svg width="140" height="300" viewBox="0 0 160 340" className="max-w-full h-auto">
          <ellipse cx="80" cy="24" rx="18" ry="22" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
          <rect x="72" y="44" width="16" height="14" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <path d="M52 56 L72 46 L80 52 L60 70 Z" fill={c('traps')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M108 56 L88 46 L80 52 L100 70 Z" fill={c('traps')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="44" cy="72" rx="16" ry="12" fill={c('shoulders')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="116" cy="72" rx="16" ry="12" fill={c('shoulders')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M56 74 L72 68 L72 120 L50 108 Q44 90 56 74" fill={c('lats')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M104 74 L88 68 L88 120 L110 108 Q116 90 104 74" fill={c('lats')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M72 68 L80 66 L80 100 L72 100 Z" fill={c('lowerBack')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M88 68 L80 66 L80 100 L88 100 Z" fill={c('lowerBack')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="36" cy="104" rx="9" ry="20" fill={c('triceps')} stroke="#334155" strokeWidth="0.5" transform="rotate(-8 36 104)"/>
          <ellipse cx="124" cy="104" rx="9" ry="20" fill={c('triceps')} stroke="#334155" strokeWidth="0.5" transform="rotate(8 124 104)"/>
          <ellipse cx="32" cy="142" rx="7" ry="18" fill={c('forearms')} stroke="#334155" strokeWidth="0.5" transform="rotate(-4 32 142)"/>
          <ellipse cx="128" cy="142" rx="7" ry="18" fill={c('forearms')} stroke="#334155" strokeWidth="0.5" transform="rotate(4 128 142)"/>
          <path d="M64 100 L80 98 L80 150 L64 146 Z" fill={c('lowerBack')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M96 100 L80 98 L80 150 L96 146 Z" fill={c('lowerBack')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="68" cy="164" rx="16" ry="14" fill={c('glutes')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="92" cy="164" rx="16" ry="14" fill={c('glutes')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M52 178 L74 178 L72 248 L50 244 Q44 214 52 178" fill={c('hamstrings')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M108 178 L86 178 L88 248 L110 244 Q116 214 108 178" fill={c('hamstrings')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="62" cy="254" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="98" cy="254" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <path d="M50 262 L70 262 L66 316 L52 316 Q44 290 50 262" fill={c('calves')} stroke="#334155" strokeWidth="0.5"/>
          <path d="M110 262 L90 262 L94 316 L108 316 Q116 290 110 262" fill={c('calves')} stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="60" cy="326" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          <ellipse cx="100" cy="326" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
        </svg>
      </div>
    </div>
  )
}
