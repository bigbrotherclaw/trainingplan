import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { EXERCISE_MUSCLE_MAP } from '../data/training';

const SCALE = [
  { max: 0, color: '#1e293b', label: 'Rest' },
  { max: 2, color: '#164e63', label: 'Light' },
  { max: 4, color: '#0e7490', label: 'Moderate' },
  { max: 6, color: '#0891b2', label: 'Worked' },
  { max: 8, color: '#f59e0b', label: 'Hammered' },
  { max: Infinity, color: '#ef4444', label: 'Destroyed' },
];

function getColorForPoints(pts) {
  for (const s of SCALE) {
    if (pts <= s.max) return s.color;
  }
  return '#ef4444';
}

function getLabelForPoints(pts) {
  for (const s of SCALE) {
    if (pts <= s.max) return s.label;
  }
  return 'Destroyed';
}

function getMusclePoints(history) {
  const points = {};
  history.forEach((entry) => {
    if (entry.type === 'strength') {
      if (Array.isArray(entry.details?.lifts)) {
        entry.details.lifts.forEach((lift) => {
          const mapping = EXERCISE_MUSCLE_MAP[lift.name];
          if (mapping) {
            Object.entries(mapping).forEach(([muscle, pts]) => {
              points[muscle] = (points[muscle] || 0) + pts;
            });
          }
        });
      }
      if (Array.isArray(entry.details?.accessories)) {
        entry.details.accessories.forEach((acc) => {
          const mapping = EXERCISE_MUSCLE_MAP[acc.name];
          if (mapping) {
            Object.entries(mapping).forEach(([muscle, pts]) => {
              points[muscle] = (points[muscle] || 0) + pts;
            });
          }
        });
      }
    } else if (entry.type === 'tri') {
      if (entry.details?.cardio?.name) {
        const cn = entry.details.cardio.name.toLowerCase();
        if (cn.includes('run') || cn.includes('track')) {
          points.quads = (points.quads || 0) + 2;
          points.hamstrings = (points.hamstrings || 0) + 2;
          points.calves = (points.calves || 0) + 2;
          points.glutes = (points.glutes || 0) + 1;
          points.core = (points.core || 0) + 1;
        } else if (cn.includes('bike') || cn.includes('turbo') || cn.includes('trainer')) {
          points.quads = (points.quads || 0) + 2;
          points.glutes = (points.glutes || 0) + 1;
          points.hamstrings = (points.hamstrings || 0) + 1;
          points.calves = (points.calves || 0) + 1;
        } else if (cn.includes('swim')) {
          points.shoulders = (points.shoulders || 0) + 2;
          points.lats = (points.lats || 0) + 2;
          points.core = (points.core || 0) + 1;
          points.triceps = (points.triceps || 0) + 1;
        }
      }
      if (!entry.details?.hic?.skipped && entry.details?.hic?.name) {
        points.core = (points.core || 0) + 1;
        points.quads = (points.quads || 0) + 1;
        points.shoulders = (points.shoulders || 0) + 1;
      }
    } else if (entry.type === 'long' && entry.details?.cardio?.name) {
      const cn = entry.details.cardio.name.toLowerCase();
      if (cn.includes('run')) {
        points.quads = (points.quads || 0) + 2;
        points.hamstrings = (points.hamstrings || 0) + 2;
        points.calves = (points.calves || 0) + 2;
        points.glutes = (points.glutes || 0) + 1;
        points.core = (points.core || 0) + 1;
      } else if (cn.includes('bike')) {
        points.quads = (points.quads || 0) + 2;
        points.glutes = (points.glutes || 0) + 1;
        points.hamstrings = (points.hamstrings || 0) + 1;
        points.calves = (points.calves || 0) + 1;
      }
    }
  });
  return points;
}

// Label component for SVG
function MuscleLabel({ x, y, muscle, points, anchor = 'middle' }) {
  const color = getColorForPoints(points);
  return (
    <text x={x} y={y} textAnchor={anchor} fill={color} fontSize="7" fontWeight="600" style={{ textTransform: 'uppercase' }}>
      {muscle}
    </text>
  );
}

export default function MuscleHeatmap({ period = 'week' }) {
  const { workoutHistory } = useApp();

  const filteredHistory = useMemo(() => {
    const now = new Date();
    if (period === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return workoutHistory.filter((e) => new Date(e.date) >= weekStart);
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return workoutHistory.filter((e) => new Date(e.date) >= monthStart);
  }, [workoutHistory, period]);

  const mp = useMemo(() => getMusclePoints(filteredHistory), [filteredHistory]);

  const c = (muscle) => getColorForPoints(mp[muscle] || 0);

  // Build sorted list for the breakdown table
  const muscleList = useMemo(() => {
    const all = ['chest', 'shoulders', 'lats', 'traps', 'biceps', 'triceps', 'forearms', 'core', 'obliques', 'lowerBack', 'quads', 'hamstrings', 'glutes', 'calves'];
    const labels = { chest: 'Chest', shoulders: 'Shoulders', lats: 'Lats', traps: 'Traps', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', core: 'Core', obliques: 'Obliques', lowerBack: 'Lower Back', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves' };
    return all
      .map(m => ({ key: m, label: labels[m], points: mp[m] || 0, color: getColorForPoints(mp[m] || 0), status: getLabelForPoints(mp[m] || 0) }))
      .sort((a, b) => b.points - a.points);
  }, [mp]);

  return (
    <div>
      <div className="flex justify-center gap-6 mb-4">
        <div className="text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Front</div>
          <svg width="130" height="280" viewBox="0 0 180 360" className="max-w-full h-auto">
            {/* Head */}
            <ellipse cx="90" cy="24" rx="18" ry="22" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
            {/* Neck */}
            <rect x="82" y="44" width="16" height="14" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            {/* Traps */}
            <path d="M70 56 L82 50 L82 62 L70 66 Z" fill={c('traps')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M110 56 L98 50 L98 62 L110 66 Z" fill={c('traps')} stroke="#334155" strokeWidth="0.5"/>
            {/* Shoulders */}
            <ellipse cx="54" cy="72" rx="16" ry="12" fill={c('shoulders')} stroke="#334155" strokeWidth="0.5"/>
            <ellipse cx="126" cy="72" rx="16" ry="12" fill={c('shoulders')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="10" y="75" muscle="Delts" points={mp.shoulders || 0} anchor="start" />
            {/* Chest */}
            <path d="M66 64 L90 62 L90 98 L66 90 Q58 82 66 64" fill={c('chest')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M114 64 L90 62 L90 98 L114 90 Q122 82 114 64" fill={c('chest')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="90" y="82" muscle="Chest" points={mp.chest || 0} />
            {/* Biceps */}
            <ellipse cx="46" cy="104" rx="9" ry="20" fill={c('biceps')} stroke="#334155" strokeWidth="0.5" transform="rotate(-8 46 104)"/>
            <ellipse cx="134" cy="104" rx="9" ry="20" fill={c('biceps')} stroke="#334155" strokeWidth="0.5" transform="rotate(8 134 104)"/>
            <MuscleLabel x="10" y="108" muscle="Bi's" points={mp.biceps || 0} anchor="start" />
            {/* Forearms */}
            <ellipse cx="42" cy="142" rx="7" ry="18" fill={c('forearms')} stroke="#334155" strokeWidth="0.5" transform="rotate(-4 42 142)"/>
            <ellipse cx="138" cy="142" rx="7" ry="18" fill={c('forearms')} stroke="#334155" strokeWidth="0.5" transform="rotate(4 138 142)"/>
            {/* Core */}
            <rect x="72" y="98" width="36" height="50" rx="6" fill={c('core')} stroke="#334155" strokeWidth="0.5"/>
            <line x1="90" y1="100" x2="90" y2="146" stroke="#0e7490" strokeWidth="0.5"/>
            <MuscleLabel x="90" y="126" muscle="Core" points={mp.core || 0} />
            {/* Obliques */}
            <path d="M66 98 L72 98 L72 146 L66 140 Q60 120 66 98" fill={c('obliques')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M114 98 L108 98 L108 146 L114 140 Q120 120 114 98" fill={c('obliques')} stroke="#334155" strokeWidth="0.5"/>
            {/* Hip */}
            <path d="M72 148 L90 148 L84 168 L68 164 Z" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            <path d="M108 148 L90 148 L96 168 L112 164 Z" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            {/* Quads */}
            <path d="M64 168 L84 168 L82 248 L62 244 Q56 210 64 168" fill={c('quads')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M116 168 L96 168 L98 248 L118 244 Q124 210 116 168" fill={c('quads')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="10" y="210" muscle="Quads" points={mp.quads || 0} anchor="start" />
            {/* Knee */}
            <ellipse cx="72" cy="254" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            <ellipse cx="108" cy="254" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            {/* Shins */}
            <path d="M62 262 L78 262 L76 316 L64 316 Q58 290 62 262" fill={c('shins')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M118 262 L102 262 L104 316 L116 316 Q122 290 118 262" fill={c('shins')} stroke="#334155" strokeWidth="0.5"/>
            {/* Feet */}
            <ellipse cx="70" cy="326" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            <ellipse cx="110" cy="326" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          </svg>
        </div>

        <div className="text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Back</div>
          <svg width="130" height="280" viewBox="0 0 180 360" className="max-w-full h-auto">
            {/* Head */}
            <ellipse cx="90" cy="24" rx="18" ry="22" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
            {/* Neck */}
            <rect x="82" y="44" width="16" height="14" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            {/* Traps */}
            <path d="M62 56 L82 46 L90 52 L70 70 Z" fill={c('traps')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M118 56 L98 46 L90 52 L110 70 Z" fill={c('traps')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="90" y="56" muscle="Traps" points={mp.traps || 0} />
            {/* Shoulders */}
            <ellipse cx="54" cy="72" rx="16" ry="12" fill={c('shoulders')} stroke="#334155" strokeWidth="0.5"/>
            <ellipse cx="126" cy="72" rx="16" ry="12" fill={c('shoulders')} stroke="#334155" strokeWidth="0.5"/>
            {/* Lats */}
            <path d="M66 74 L82 68 L82 120 L60 108 Q54 90 66 74" fill={c('lats')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M114 74 L98 68 L98 120 L120 108 Q126 90 114 74" fill={c('lats')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="170" y="95" muscle="Lats" points={mp.lats || 0} anchor="end" />
            {/* Lower back */}
            <path d="M82 68 L90 66 L90 100 L82 100 Z" fill={c('lowerBack')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M98 68 L90 66 L90 100 L98 100 Z" fill={c('lowerBack')} stroke="#334155" strokeWidth="0.5"/>
            {/* Triceps */}
            <ellipse cx="46" cy="104" rx="9" ry="20" fill={c('triceps')} stroke="#334155" strokeWidth="0.5" transform="rotate(-8 46 104)"/>
            <ellipse cx="134" cy="104" rx="9" ry="20" fill={c('triceps')} stroke="#334155" strokeWidth="0.5" transform="rotate(8 134 104)"/>
            <MuscleLabel x="170" y="108" muscle="Tri's" points={mp.triceps || 0} anchor="end" />
            {/* Forearms */}
            <ellipse cx="42" cy="142" rx="7" ry="18" fill={c('forearms')} stroke="#334155" strokeWidth="0.5" transform="rotate(-4 42 142)"/>
            <ellipse cx="138" cy="142" rx="7" ry="18" fill={c('forearms')} stroke="#334155" strokeWidth="0.5" transform="rotate(4 138 142)"/>
            {/* Lower back mid section */}
            <path d="M74 100 L90 98 L90 150 L74 146 Z" fill={c('lowerBack')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M106 100 L90 98 L90 150 L106 146 Z" fill={c('lowerBack')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="90" y="130" muscle="Low Back" points={mp.lowerBack || 0} />
            {/* Glutes */}
            <ellipse cx="78" cy="164" rx="16" ry="14" fill={c('glutes')} stroke="#334155" strokeWidth="0.5"/>
            <ellipse cx="102" cy="164" rx="16" ry="14" fill={c('glutes')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="90" y="167" muscle="Glutes" points={mp.glutes || 0} />
            {/* Hamstrings */}
            <path d="M62 178 L84 178 L82 248 L60 244 Q54 214 62 178" fill={c('hamstrings')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M118 178 L96 178 L98 248 L120 244 Q126 214 118 178" fill={c('hamstrings')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="170" y="210" muscle="Hams" points={mp.hamstrings || 0} anchor="end" />
            {/* Knee */}
            <ellipse cx="72" cy="254" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            <ellipse cx="108" cy="254" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            {/* Calves */}
            <path d="M60 262 L80 262 L76 316 L62 316 Q54 290 60 262" fill={c('calves')} stroke="#334155" strokeWidth="0.5"/>
            <path d="M120 262 L100 262 L104 316 L118 316 Q126 290 120 262" fill={c('calves')} stroke="#334155" strokeWidth="0.5"/>
            <MuscleLabel x="170" y="290" muscle="Calves" points={mp.calves || 0} anchor="end" />
            {/* Feet */}
            <ellipse cx="70" cy="326" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
            <ellipse cx="110" cy="326" rx="12" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
          </svg>
        </div>
      </div>

      {/* Color scale */}
      <div className="flex justify-center items-center gap-1.5 mb-4">
        {SCALE.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-[9px] text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Muscle breakdown table */}
      <div className="space-y-1">
        {muscleList.filter(m => m.points > 0).map((m) => (
          <div key={m.key} className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: m.color }} />
              <span className="text-[11px] text-slate-300">{m.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">{m.points} pts</span>
              <span className="text-[10px] font-semibold" style={{ color: m.color }}>{m.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
