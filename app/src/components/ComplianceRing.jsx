import { motion } from 'framer-motion';

const PLANNED = 6; // Mon-Sat, Sunday is rest
const CIRCUMFERENCE = 2 * Math.PI * 45;

export default function ComplianceRing({ weekWorkouts }) {
  const pct = Math.min(100, Math.round((weekWorkouts / PLANNED) * 100));
  const filled = (pct / 100) * CIRCUMFERENCE;
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="bg-dark-700 rounded-2xl p-4 border border-white/5">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Weekly Compliance</h3>
      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="45" fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE}`}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: CIRCUMFERENCE - filled }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{pct}%</span>
            <span className="text-[10px] text-slate-500">{weekWorkouts}/{PLANNED}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
