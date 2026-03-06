import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudUpload, RefreshCw, CheckCircle } from 'lucide-react';

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

/**
 * MigrationModal — shown when a user logs in with existing localStorage data.
 *
 * Props:
 *   workoutCount  {number}    - count of local workouts found
 *   onSync        {function}  - async fn to sync local data to cloud
 *   onStartFresh  {function}  - fn to discard local data and start fresh
 *   onDismiss     {function}  - fn called after success state is dismissed
 */
export default function MigrationModal({ workoutCount = 0, onSync, onStartFresh, onDismiss }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [error, setError] = useState('');

  const handleSync = async () => {
    setError('');
    setStatus('loading');
    try {
      if (onSync) await onSync();
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Sync failed. Please try again.');
      setStatus('idle');
    }
  };

  const handleStartFresh = () => {
    if (onStartFresh) onStartFresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="relative w-full max-w-sm bg-[#111111] rounded-2xl border border-white/[0.03] p-6 z-10"
      >
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            /* Success state */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-2"
            >
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="text-green-400" size={28} />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-base">All caught up!</p>
                <p className="text-[#666666] text-sm mt-1">Your workouts have been synced to the cloud.</p>
              </div>
              <button
                onClick={onDismiss}
                className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-semibold rounded-xl py-3 text-sm transition-colors mt-1"
              >
                Let's go
              </button>
            </motion.div>
          ) : (
            /* Default / loading state */
            <motion.div
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-5"
            >
              {/* Icon + heading */}
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
                  <CloudUpload className="text-[#3B82F6]" size={22} />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-base leading-snug">
                    Welcome! We found existing workout data on this device.
                  </h3>
                </div>
              </div>

              {/* Workout count pill */}
              <div className="bg-black/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <RefreshCw className="text-[#3B82F6] shrink-0" size={16} />
                <p className="text-[#B3B3B3] text-sm">
                  <span className="text-white font-semibold">{workoutCount} workout{workoutCount !== 1 ? 's' : ''}</span>{' '}
                  ready to sync
                </p>
              </div>

              {/* Hint */}
              <p className="text-[#666666] text-xs leading-relaxed">
                This will merge your local data with your cloud account so you never lose your progress.
              </p>

              {/* Error */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-xs -mt-2"
                >
                  {error}
                </motion.p>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleSync}
                  disabled={status === 'loading'}
                  className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? (
                    <>
                      <Spinner />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <CloudUpload size={16} />
                      Sync to Cloud
                    </>
                  )}
                </button>

                <button
                  onClick={handleStartFresh}
                  disabled={status === 'loading'}
                  className="w-full border border-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-[#B3B3B3] hover:text-white font-medium rounded-xl py-3 text-sm transition-colors"
                >
                  Start Fresh
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
