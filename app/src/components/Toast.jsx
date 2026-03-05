import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-20 left-4 right-4 z-50"
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${
        type === 'success'
          ? 'bg-emerald-950/90 border-emerald-800/50 text-emerald-200'
          : 'bg-red-950/90 border-red-800/50 text-red-200'
      }`}>
        {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
        <span className="flex-1 text-sm font-medium">{message}</span>
        <button onClick={onClose} className="text-white/50 hover:text-white/80">
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}
