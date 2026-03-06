import { useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SharePlanCard({ plan, onDelete }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plan.share_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: plan.name,
          text: `Join my training plan "${plan.name}" with code: ${plan.share_code}`,
        })
        return
      } catch {
        // user cancelled or not supported — fall through to copy
      }
    }
    handleCopy()
  }

  return (
    <motion.div
      layout
      className="bg-[#111111] rounded-xl border border-white/[0.03] p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-white text-sm font-medium leading-tight">{plan.name}</p>
          {plan.description && (
            <p className="text-[#666666] text-xs mt-0.5">{plan.description}</p>
          )}
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(plan.id)}
            className="text-[#666666] text-xs active:text-red-400 transition-colors shrink-0"
          >
            Delete
          </button>
        )}
      </div>

      <div className="bg-black rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 border border-white/[0.05]">
        <span className="font-mono text-xl font-bold text-white tracking-[0.15em]">
          {plan.share_code}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            aria-label="Copy code"
            className="p-1.5 rounded-lg text-[#666666] active:text-white transition-colors active:scale-[0.98]"
          >
            {copied ? <Check size={16} className="text-[#3B82F6]" /> : <Copy size={16} />}
          </button>
          <button
            onClick={handleShare}
            aria-label="Share"
            className="p-1.5 rounded-lg text-[#666666] active:text-white transition-colors active:scale-[0.98]"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {copied && (
        <p className="text-[#3B82F6] text-xs mt-1.5">Code copied to clipboard!</p>
      )}
    </motion.div>
  )
}
