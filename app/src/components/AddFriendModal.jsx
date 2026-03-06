import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, X, Check } from 'lucide-react'
import { useSocial } from '../hooks/useSocial'

export default function AddFriendModal({ onClose }) {
  const { sendFriendRequest } = useSocial()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setErrorMsg('')

    const { error } = await sendFriendRequest(email.trim())
    setLoading(false)

    if (error) {
      setErrorMsg(error.message || 'Something went wrong')
    } else {
      setSuccess(true)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-[#111111] rounded-2xl border border-white/[0.06] p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-[#3B82F6]" />
            <h2 className="text-white font-semibold text-base">Add Friend</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#666666] active:text-white transition-colors p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[#3B82F6]/20 flex items-center justify-center">
                <Check size={24} className="text-[#3B82F6]" />
              </div>
              <p className="text-white font-medium">Friend request sent!</p>
              <p className="text-[#B3B3B3] text-sm">
                We sent a request to <span className="text-white">{email}</span>
              </p>
              <button
                onClick={onClose}
                className="mt-2 text-[#3B82F6] text-sm font-medium active:opacity-70 transition-opacity"
              >
                Done
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="block text-[#B3B3B3] text-xs mb-2">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMsg('') }}
                  placeholder="friend@example.com"
                  autoFocus
                  className="w-full bg-black border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder:text-[#444] outline-none focus:border-[#3B82F6]/60 transition-colors"
                />
                <AnimatePresence>
                  {errorMsg && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-red-400 text-xs mt-2"
                    >
                      {errorMsg}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-[#B3B3B3] text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[#3B82F6] text-white text-sm font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  {loading ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
