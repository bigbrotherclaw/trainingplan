import { motion } from 'framer-motion';

const PLANNED = 6;
const R = 45;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function ComplianceRing({ weekWorkouts, size = 100 }) {
  const pct = Math.min(100, Math.round((weekWorkouts / PLANNED) * 100));
  const filled = (pct / 100) * CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center">
      {pct === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className="flex items-center justify-center rounded-full border-2 border-white/10 text-[#555555] font-bold"
            style={{ width: size, height: size, fontSize: size * 0.28 }}
          >
            ?
          </div>
          <p className="text-[12px] text-[#555555] text-center mt-1">Log your first workout!</p>
        </div>
      ) : (
        <>
          <div className="relative" style={{ width: size, height: size }}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={R} fill="none" stroke="#222222" strokeWidth="3" />
              <motion.circle
                cx="50" cy="50" r={R} fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE}`}
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: CIRCUMFERENCE - filled }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[22px] font-bold text-white">{pct}%</span>
            </div>
          </div>
          <p className="text-[12px] uppercase tracking-wider text-[#555555] mt-2 text-center">This Week</p>
        </>
      )}
    </div>
  );
}
