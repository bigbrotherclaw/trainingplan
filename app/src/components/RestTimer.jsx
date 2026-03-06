import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, X, Play, RotateCcw } from 'lucide-react';

export default function RestTimer({ defaultSeconds = 120 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setIsRunning(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, seconds]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = seconds / defaultSeconds;

  const reset = () => {
    setIsRunning(false);
    setSeconds(defaultSeconds);
  };

  const toggle = () => {
    if (seconds === 0) {
      reset();
      return;
    }
    setIsRunning(!isRunning);
  };

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); reset(); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-500 text-[#666666] text-xs font-medium hover:bg-dark-400 transition-colors"
      >
        <Timer size={14} />
        Rest Timer
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-800 rounded-2xl p-8 w-72 text-center relative border border-white/[0.03]"
            >
              <button onClick={() => setIsOpen(false)} className="absolute top-3 right-3 text-[#666666]">
                <X size={20} />
              </button>

              <div className="relative w-40 h-40 mx-auto mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a1a" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke={seconds === 0 ? '#10b981' : '#3b82f6'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 283} 283`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white tabular-nums">
                    {mins}:{secs.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button onClick={toggle} className="w-14 h-14 rounded-full bg-accent-blue flex items-center justify-center text-white active:scale-[0.95] transition-transform">
                  <Play size={24} className={isRunning ? 'hidden' : ''} />
                  {isRunning && <div className="w-5 h-5 border-2 border-white rounded-sm" />}
                </button>
                <button onClick={reset} className="w-14 h-14 rounded-full bg-dark-500 flex items-center justify-center text-[#666666] active:scale-[0.95] transition-transform">
                  <RotateCcw size={20} />
                </button>
              </div>

              <div className="flex justify-center gap-2 mt-4">
                {[60, 90, 120, 180, 300].map((t) => (
                  <button
                    key={t}
                    onClick={() => { setSeconds(t); setIsRunning(false); }}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      defaultSeconds === t ? 'bg-accent-blue/20 text-accent-blue' : 'bg-dark-500 text-[#666666]'
                    }`}
                  >
                    {t >= 60 ? `${Math.floor(t / 60)}m` : `${t}s`}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
