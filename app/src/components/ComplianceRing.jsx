import { motion } from 'framer-motion';

const PLANNED = 6;
const CIRCUMFERENCE = 2 * Math.PI * 45;

export default function ComplianceRing({ weekWorkouts }) {
  const pct = Math.min(100, Math.round((weekWorkouts / PLANNED) * 100));
  const filled = (pct / 100) * CIRCUMFERENCE;
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="bg-dark-800 rounded-2xl p-5 border border-white/[0.03] active:scale-[0.98] transition-transform">
      <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-widest mb-4">Weekly Compliance</h2>
      <div className="flex items-center justify-center">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a1a" strokeWidth="6" />
            <motion.circle
              cx="50" cy="50" r="45" fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE}`}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: CIRCUMFERENCE - filled }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{pct}%</span>
            <span className="text-xs text-[#666666]">{weekWorkouts}/{PLANNED}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
