import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function generateShareCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function getMonthStart() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function calcVolume(entries) {
  let total = 0
  for (const entry of entries) {
    const lifts = entry.details?.lifts ?? []
    for (const lift of lifts) {
      total += (lift.weight ?? 0) * (lift.reps ?? 0) * (lift.setsCompleted ?? 0)
    }
  }
  return total
}

function calcStreak(entries) {
  if (!entries.length) return 0
  const days = new Set(entries.map((e) => e.date?.slice(0, 10)))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (days.has(key)) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}

export function useSocial() {
  const { user, userSettings } = useAuth()
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [sharedPlans, setSharedPlans] = useState([])
  const [loading, setLoading] = useState(false)

  const loadFriends = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, user_a, user_b, status,
        profile_a:profiles!friendships_user_a_fkey(id, display_name, avatar_url),
        profile_b:profiles!friendships_user_b_fkey(id, display_name, avatar_url)
      `)
      .eq('status', 'accepted')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

    if (error) { console.error('loadFriends:', error); return }

    const list = (data ?? []).map((f) => {
      const isSender = f.user_a === user.id
      const friendProfile = isSender ? f.profile_b : f.profile_a
      const friendId = isSender ? f.user_b : f.user_a
      return { friendshipId: f.id, friendId, ...friendProfile }
    })
    setFriends(list)
  }, [user])

  const loadPendingRequests = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, user_a, status,
        sender:profiles!friendships_user_a_fkey(id, display_name, avatar_url)
      `)
      .eq('user_b', user.id)
      .eq('status', 'pending')

    if (error) { console.error('loadPendingRequests:', error); return }
    setPendingRequests(data ?? [])
  }, [user])

  const loadSharedPlans = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('shared_plans')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadSharedPlans:', error); return }
    setSharedPlans(data ?? [])
  }, [user])

  useEffect(() => {
    if (user) {
      loadFriends()
      loadPendingRequests()
      loadSharedPlans()
    }
  }, [user, loadFriends, loadPendingRequests, loadSharedPlans])

  // Note: sendFriendRequest requires a Supabase database function to look up
  // auth.users by email from the client, since auth.users is not directly
  // accessible via RLS. Example SQL:
  //   CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input text)
  //   RETURNS uuid AS $$ SELECT id FROM auth.users WHERE email = email_input $$
  //   LANGUAGE sql SECURITY DEFINER;
  async function sendFriendRequest(email) {
    if (!user) return { error: new Error('Not authenticated') }

    const { data: targetUserId, error: rpcError } = await supabase.rpc(
      'get_user_id_by_email',
      { email_input: email.toLowerCase().trim() }
    )

    if (rpcError || !targetUserId) {
      return { error: new Error('No user found with that email') }
    }
    if (targetUserId === user.id) {
      return { error: new Error('Cannot send a request to yourself') }
    }

    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(
        `and(user_a.eq.${user.id},user_b.eq.${targetUserId}),` +
        `and(user_a.eq.${targetUserId},user_b.eq.${user.id})`
      )
      .maybeSingle()

    if (existing) {
      return { error: new Error('Already friends') }
    }

    const { error } = await supabase.from('friendships').insert({
      user_a: user.id,
      user_b: targetUserId,
      status: 'pending',
    })
    if (error) return { error }
    return { success: true }
  }

  async function acceptFriendRequest(friendshipId) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
    if (error) return { error }
    await loadFriends()
    await loadPendingRequests()
    return { success: true }
  }

  async function declineFriendRequest(friendshipId) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (error) return { error }
    await loadPendingRequests()
    return { success: true }
  }

  async function removeFriend(friendshipId) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (error) return { error }
    await loadFriends()
    return { success: true }
  }

  // Note: Cross-user leaderboard queries are blocked by RLS (users can only read
  // their own workout_history). A Supabase Edge Function or SECURITY DEFINER
  // database function is required to safely aggregate friends' workout data.
  // Until then, only the current user's real data is shown; friend rows are mocked.
  async function getLeaderboard(metric) {
    if (!user) return []
    setLoading(true)

    let myEntries = []
    try {
      if (metric === 'volume') {
        const { data } = await supabase
          .from('workout_history')
          .select('details')
          .eq('user_id', user.id)
          .gte('date', getWeekStart())
        myEntries = data ?? []
      } else if (metric === 'streak') {
        const { data } = await supabase
          .from('workout_history')
          .select('date')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
        myEntries = data ?? []
      } else {
        const { data } = await supabase
          .from('workout_history')
          .select('date')
          .eq('user_id', user.id)
          .gte('date', getMonthStart())
        myEntries = data ?? []
      }
    } catch (e) {
      console.error('getLeaderboard:', e)
    }

    let myValue = 0
    if (metric === 'volume') myValue = calcVolume(myEntries)
    else if (metric === 'streak') myValue = calcStreak(myEntries)
    else myValue = myEntries.length

    const me = {
      userId: user.id,
      displayName: 'You',
      avatarUrl: null,
      value: myValue,
      isCurrentUser: true,
    }

    // Friends' data requires cross-user query — mocked until Edge Function is added
    const friendRows = friends.map((f) => ({
      userId: f.friendId,
      displayName: f.display_name || 'Friend',
      avatarUrl: f.avatar_url,
      value: null,
      isCurrentUser: false,
      isMocked: true,
    }))

    const rows = [me, ...friendRows].sort((a, b) => {
      if (a.value === null) return 1
      if (b.value === null) return -1
      return b.value - a.value
    })

    setLoading(false)
    return rows
  }

  async function sharePlan(name, description) {
    if (!user) return { error: new Error('Not authenticated') }

    const shareCode = generateShareCode()
    const planData = userSettings ?? {}

    const { data, error } = await supabase
      .from('shared_plans')
      .insert({
        owner_id: user.id,
        name,
        description,
        plan_data: planData,
        share_code: shareCode,
      })
      .select()
      .single()

    if (error) return { error }
    await loadSharedPlans()
    return { data }
  }

  async function joinPlan(shareCode) {
    if (!user) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('shared_plans')
      .select('*')
      .eq('share_code', shareCode.toUpperCase().trim())
      .single()

    if (error || !data) return { error: new Error('Plan not found') }
    return { data }
  }

  async function deleteSharedPlan(planId) {
    const { error } = await supabase
      .from('shared_plans')
      .delete()
      .eq('id', planId)
      .eq('owner_id', user.id)
    if (error) return { error }
    await loadSharedPlans()
    return { success: true }
  }

  return {
    friends,
    pendingRequests,
    sharedPlans,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    getLeaderboard,
    sharePlan,
    joinPlan,
    deleteSharedPlan,
    refresh: () => {
      loadFriends()
      loadPendingRequests()
      loadSharedPlans()
    },
  }
}
