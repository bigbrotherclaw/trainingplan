import { motion } from 'framer-motion'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function Toast({ message, type = 'success' }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className={`px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${
        type === 'error' ? 'bg-red-900/90 text-red-200' : 'bg-emerald-900/90 text-emerald-200'
      }`}
    >
      {type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
      {message}
    </motion.div>
  )
}
