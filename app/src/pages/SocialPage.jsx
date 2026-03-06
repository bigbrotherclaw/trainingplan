import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, UserPlus, Trophy, Share2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocial } from '../hooks/useSocial'
import AddFriendModal from '../components/AddFriendModal'
import SharePlanCard from '../components/SharePlanCard'

const METRICS = [
  { id: 'volume', label: 'Weekly Volume', unit: 'kg' },
  { id: 'streak', label: 'Streak', unit: 'days' },
  { id: 'monthly', label: 'Monthly', unit: 'sessions' },
]

function AvatarCircle({ name, avatarUrl, size = 'md' }) {
  const initial = (name?.[0] ?? '?').toUpperCase()
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${cls} rounded-full bg-[#3B82F6]/20 flex items-center justify-center shrink-0 overflow-hidden`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[#3B82F6] font-semibold">{initial}</span>
      )}
    </div>
  )
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-[#3B82F6]" />
      <h2 className="text-white font-semibold text-sm">{title}</h2>
    </div>
  )
}

// --- Friends Section ---
function FriendsSection({ friends, pendingRequests, onAddFriend, onAccept, onDecline, onRemove }) {
  return (
    <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[#3B82F6]" />
          <h2 className="text-white font-semibold text-sm">Friends</h2>
        </div>
        <button
          onClick={onAddFriend}
          className="flex items-center gap-1.5 bg-[#3B82F6] text-white text-xs font-semibold px-3 min-h-[48px] rounded-xl active:scale-[0.98] transition-transform"
        >
          <UserPlus size={14} />
          Add Friend
        </button>
      </div>

      {pendingRequests.length > 0 && (
        <div className="mb-3">
          <p className="text-[#666666] text-xs mb-2">Pending requests</p>
          <div className="flex flex-col gap-2">
            {pendingRequests.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 min-h-[52px]"
              >
                <AvatarCircle name={req.sender?.display_name} avatarUrl={req.sender?.avatar_url} size="sm" />
                <span className="text-[#B3B3B3] text-sm flex-1 truncate">
                  {req.sender?.display_name || 'Unknown'}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onAccept(req.id)}
                    className="text-xs text-[#3B82F6] font-medium px-3 py-2 rounded-lg border border-[#3B82F6]/30 active:scale-[0.98] transition-transform"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDecline(req.id)}
                    className="text-xs text-[#666666] px-3 py-2 rounded-lg border border-white/[0.10] active:scale-[0.98] transition-transform"
                  >
                    Decline
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          {friends.length > 0 && <div className="border-t border-white/[0.04] mt-3 mb-3" />}
        </div>
      )}

      {friends.length === 0 && pendingRequests.length === 0 ? (
        <p className="text-[#666666] text-sm text-center py-4">
          Add friends to compare training stats
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {friends.map((f, i) => (
              <motion.div
                key={f.friendshipId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 min-h-[52px]"
              >
                <AvatarCircle name={f.display_name} avatarUrl={f.avatar_url} size="sm" />
                <span className="text-[#B3B3B3] text-sm flex-1 truncate">
                  {f.display_name || 'Friend'}
                </span>
                <button
                  onClick={() => onRemove(f.friendshipId)}
                  className="text-[#444444] text-xs active:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// --- Leaderboard Section ---
function LeaderboardSection({ friends, getLeaderboard }) {
  const [metric, setMetric] = useState('volume')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const data = await getLeaderboard(metric)
      if (!cancelled) {
        setRows(data)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [metric, friends])

  const metricDef = METRICS.find((m) => m.id === metric)

  function formatValue(row) {
    if (row.isMocked) return '—'
    if (metric === 'volume') return `${(row.value / 1000).toFixed(1)}t`
    return `${row.value} ${metricDef.unit}`
  }

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[#3B82F6]" />
          <h2 className="text-white font-semibold text-sm">Leaderboard</h2>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-black rounded-lg p-1">
        {METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors active:scale-[0.98] ${
              metric === m.id
                ? 'bg-[#3B82F6] text-white'
                : 'text-[#666666] active:text-[#999]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-6 text-[#666666] text-sm">Loading…</div>
      ) : (
        <div className="flex flex-col gap-1">
          <AnimatePresence mode="wait">
            {rows.map((row, i) => (
              <motion.div
                key={row.userId}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 min-h-[48px] rounded-xl px-3 ${
                  row.isCurrentUser
                    ? 'border border-[#3B82F6]/30 bg-[#3B82F6]/5'
                    : 'border border-transparent'
                }`}
              >
                <span className="text-[#666666] text-xs w-5 text-center font-mono">
                  {i + 1}
                </span>
                <AvatarCircle name={row.displayName} avatarUrl={row.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${row.isCurrentUser ? 'text-white' : 'text-[#B3B3B3]'}`}>
                    {row.displayName}
                  </p>
                  {row.isMocked && (
                    <p className="text-[#444] text-[10px]">Coming soon: see how friends compare!</p>
                  )}
                </div>
                <span className={`text-sm font-semibold tabular-nums ${row.isCurrentUser ? 'text-[#3B82F6]' : 'text-[#666666]'}`}>
                  {formatValue(row)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {rows.length === 0 && (
            <p className="text-[#666666] text-sm text-center py-4">
              No workout data this period
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// --- Shared Plans Section ---
function SharedPlansSection({ sharedPlans, sharePlan, joinPlan, deleteSharedPlan }) {
  const [showShareForm, setShowShareForm] = useState(false)
  const [shareName, setShareName] = useState('')
  const [shareDesc, setShareDesc] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinResult, setJoinResult] = useState(null)
  const [joinError, setJoinError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)

  async function handleShare(e) {
    e.preventDefault()
    if (!shareName.trim()) return
    setShareLoading(true)
    await sharePlan(shareName.trim(), shareDesc.trim())
    setShareLoading(false)
    setShowShareForm(false)
    setShareName('')
    setShareDesc('')
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoinLoading(true)
    setJoinError('')
    setJoinResult(null)
    const { data, error } = await joinPlan(joinCode.trim())
    setJoinLoading(false)
    if (error) {
      setJoinError(error.message)
    } else {
      setJoinResult(data)
    }
  }

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/[0.10] p-5">
      <SectionHeader icon={Share2} title="Shared Plans" />

      {sharedPlans.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          <AnimatePresence>
            {sharedPlans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <SharePlanCard plan={plan} onDelete={deleteSharedPlan} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {showShareForm ? (
        <form onSubmit={handleShare} className="flex flex-col gap-2 mb-4">
          <input
            type="text"
            value={shareName}
            onChange={(e) => setShareName(e.target.value)}
            placeholder="Plan name"
            autoFocus
            className="bg-black border border-white/[0.10] rounded-xl px-4 py-3.5 min-h-[48px] text-white text-sm placeholder:text-[#444] outline-none focus:border-[#3B82F6]/60 transition-colors"
          />
          <input
            type="text"
            value={shareDesc}
            onChange={(e) => setShareDesc(e.target.value)}
            placeholder="Description (optional)"
            className="bg-black border border-white/[0.10] rounded-xl px-4 py-3.5 min-h-[48px] text-white text-sm placeholder:text-[#444] outline-none focus:border-[#3B82F6]/60 transition-colors"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowShareForm(false)}
              className="flex-1 min-h-[48px] rounded-xl border border-white/[0.10] text-[#B3B3B3] text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={shareLoading || !shareName.trim()}
              className="flex-1 min-h-[48px] rounded-xl bg-[#3B82F6] text-white text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {shareLoading ? 'Creating…' : 'Create Share Code'}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowShareForm(true)}
          className="w-full min-h-[48px] rounded-xl border border-[#3B82F6]/30 text-[#3B82F6] text-sm font-semibold mb-4 active:scale-[0.98] transition-transform"
        >
          Share My Plan
        </button>
      )}

      <div className="border-t border-white/[0.04] pt-4">
        <p className="text-[#666666] text-xs mb-2">Join a friend's plan</p>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
            placeholder="Enter code (e.g. A1B2C3)"
            className="flex-1 bg-black border border-white/[0.10] rounded-xl px-4 py-3.5 min-h-[48px] text-white text-sm placeholder:text-[#444] outline-none focus:border-[#3B82F6]/60 transition-colors font-mono uppercase tracking-wider"
            maxLength={6}
          />
          <button
            type="submit"
            disabled={joinLoading || !joinCode.trim()}
            className="px-4 min-h-[48px] rounded-xl bg-[#3B82F6] text-white text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform shrink-0"
          >
            {joinLoading ? '…' : 'Join'}
          </button>
        </form>

        <AnimatePresence>
          {joinError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-red-400 text-xs mt-2"
            >
              {joinError}
            </motion.p>
          )}
          {joinResult && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 bg-black rounded-xl border border-white/[0.10] p-3"
            >
              <p className="text-white text-sm font-medium">{joinResult.name}</p>
              {joinResult.description && (
                <p className="text-[#B3B3B3] text-xs mt-0.5">{joinResult.description}</p>
              )}
              <p className="text-[#666666] text-xs mt-2">Plan data loaded — apply in Settings.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// --- Main Page ---
export default function SocialPage() {
  const {
    friends,
    pendingRequests,
    sharedPlans,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    getLeaderboard,
    sharePlan,
    joinPlan,
    deleteSharedPlan,
  } = useSocial()

  const [showAddFriend, setShowAddFriend] = useState(false)

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  }

  return (
    <div className="px-5 pt-4 pb-28 min-h-screen bg-black space-y-5">
      <h2 className="text-[28px] font-bold text-white mb-2">Social</h2>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-4 max-w-lg mx-auto"
      >
        <motion.div variants={itemVariants}>
          <FriendsSection
            friends={friends}
            pendingRequests={pendingRequests}
            onAddFriend={() => setShowAddFriend(true)}
            onAccept={acceptFriendRequest}
            onDecline={declineFriendRequest}
            onRemove={removeFriend}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <LeaderboardSection friends={friends} getLeaderboard={getLeaderboard} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <SharedPlansSection
            sharedPlans={sharedPlans}
            sharePlan={sharePlan}
            joinPlan={joinPlan}
            deleteSharedPlan={deleteSharedPlan}
          />
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showAddFriend && (
          <AddFriendModal onClose={() => setShowAddFriend(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
