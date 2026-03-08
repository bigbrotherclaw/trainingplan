import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WHOOP_API = 'https://api.prod.whoop.com/developer'
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID') || ''
const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshToken(supabase: any, userId: string, tokens: any) {
  console.log('Refreshing Whoop token for user:', userId)
  
  const resp = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: WHOOP_CLIENT_ID,
      client_secret: WHOOP_CLIENT_SECRET,
      scope: 'offline',
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    console.error('Token refresh failed:', resp.status, errText)
    
    // Mark token as expired in DB so the app can show a warning
    await supabase
      .from('whoop_tokens')
      .update({ token_error: errText, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    
    throw new Error(`Token refresh failed: ${errText}`)
  }

  const newTokens = await resp.json()
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()

  // Always save the new refresh token — Whoop rotates them (one-time use)
  await supabase
    .from('whoop_tokens')
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
      token_error: null, // clear any previous error
    })
    .eq('user_id', userId)

  console.log('Token refreshed, new expiry:', newExpiresAt, 'new refresh_token:', !!newTokens.refresh_token)
  return newTokens.access_token
}

async function refreshTokenIfNeeded(supabase: any, userId: string, tokens: any) {
  const expiresAt = new Date(tokens.expires_at)
  const now = new Date()
  const timeLeft = expiresAt.getTime() - now.getTime()
  
  // Refresh proactively when 50% through lifetime (not just 5 min before)
  // Whoop tokens last ~1 hour, so refresh at ~30 min
  const totalLifetime = tokens.updated_at 
    ? expiresAt.getTime() - new Date(tokens.updated_at).getTime()
    : 3600 * 1000 // default 1 hour
  const halfLife = totalLifetime / 2
  
  if (timeLeft > halfLife) {
    return tokens.access_token
  }

  console.log(`Token ${timeLeft > 0 ? 'expiring soon' : 'expired'} (${Math.round(timeLeft/1000)}s left), refreshing...`)
  return refreshToken(supabase, userId, tokens)
}

async function fetchWhoopData(accessToken: string, endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${WHOOP_API}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!resp.ok) {
    throw new Error(`Whoop API error: ${resp.status} ${await resp.text()}`)
  }

  return resp.json()
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!userToken) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Support admin calls with userId param (for server-side/CLI triggers)
    const bodyPeek = await req.clone().json().catch(() => ({}))
    let userId: string

    if (bodyPeek.userId) {
      // Admin mode: caller provides userId directly (requires service role or no-verify-jwt)
      userId = bodyPeek.userId
    } else {
      const { data: { user } } = await supabase.auth.getUser(userToken)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid user' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      userId = user.id
    }

    // Get stored tokens
    const { data: tokens } = await supabase
      .from('whoop_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!tokens) {
      return new Response(JSON.stringify({ error: 'Whoop not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, userId, tokens)

    // Determine what to sync based on request body
    const body = await req.json().catch(() => ({}))
    const syncType = body.type || 'all' // 'all', 'recovery', 'sleep', 'cycle', 'workout'
    const days = body.days || 7 // How many days to sync
    // Client sends their local date so we key "today" correctly (server is UTC)
    const clientToday = body.clientToday || new Date().toISOString().split('T')[0]

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startParam = startDate.toISOString()

    const results: Record<string, any> = {}

    // Sync recovery data
    if (syncType === 'all' || syncType === 'recovery') {
      const data = await fetchWhoopData(accessToken, '/v2/recovery', {
        start: startParam,
        limit: String(Math.min(days, 25)),
      })
      results.recovery = data
      
      // Cache each recovery record
      if (data.records) {
        for (const record of data.records) {
          const date = record.created_at?.split('T')[0]
          if (date) {
            await supabase.from('whoop_data').upsert({
              user_id: userId,
              data_type: 'recovery',
              date,
              data: record,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'user_id,data_type,date' })
          }
        }
      }
    }

    // Sync sleep data
    if (syncType === 'all' || syncType === 'sleep') {
      const data = await fetchWhoopData(accessToken, '/v2/activity/sleep', {
        start: startParam,
        limit: String(Math.min(days, 25)),
      })
      results.sleep = data

      if (data.records) {
        for (const record of data.records) {
          const date = record.start?.split('T')[0] || record.created_at?.split('T')[0]
          if (date) {
            await supabase.from('whoop_data').upsert({
              user_id: userId,
              data_type: 'sleep',
              date,
              data: record,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'user_id,data_type,date' })
          }
        }
      }
    }

    // Sync cycle (strain) data
    if (syncType === 'all' || syncType === 'cycle') {
      const data = await fetchWhoopData(accessToken, '/v2/cycle', {
        start: startParam,
        limit: String(Math.min(days, 25)),
      })
      results.cycle = data

      if (data.records) {
        for (const record of data.records) {
          const date = record.start?.split('T')[0] || record.created_at?.split('T')[0]
          if (date) {
            await supabase.from('whoop_data').upsert({
              user_id: userId,
              data_type: 'cycle',
              date,
              data: record,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'user_id,data_type,date' })
          }
        }
      }
    }

    // Sync CURRENT cycle + recovery (today's live data)
    if (syncType === 'all' || syncType === 'recovery' || syncType === 'cycle') {
      try {
        // Get the latest (current) cycle
        const cycleData = await fetchWhoopData(accessToken, '/v2/cycle', { limit: '1' })
        if (cycleData.records?.length > 0) {
          const currentCycle = cycleData.records[0]
          const cycleId = currentCycle.id
          
          // Use client's local date for the current active cycle key
          const isActive = !currentCycle.end
          const cycleDate = isActive ? clientToday : (currentCycle.start?.split('T')[0] || clientToday)
          
          // Cache current cycle
          await supabase.from('whoop_data').upsert({
            user_id: userId,
            data_type: 'cycle',
            date: cycleDate,
            data: currentCycle,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'user_id,data_type,date' })
          
          // Get recovery for this cycle
          try {
            const recoveryData = await fetchWhoopData(accessToken, `/v2/recovery/${cycleId}`)
            if (recoveryData && recoveryData.score_state === 'SCORED') {
              await supabase.from('whoop_data').upsert({
                user_id: userId,
                data_type: 'recovery',
                date: cycleDate,
                data: recoveryData,
                synced_at: new Date().toISOString(),
              }, { onConflict: 'user_id,data_type,date' })
            }
          } catch (recErr) {
            console.log('No recovery for current cycle:', recErr.message)
          }
        }
        
        // Also get latest sleep (may be today's)
        const sleepData = await fetchWhoopData(accessToken, '/v2/activity/sleep', { limit: '1' })
        if (sleepData.records?.length > 0) {
          const latestSleep = sleepData.records[0]
          const sleepDate = latestSleep.start?.split('T')[0] || clientToday
          // If sleep ended today (client's today), key it to today
          const sleepEnd = latestSleep.end ? new Date(latestSleep.end) : null
          const sleepEndDate = sleepEnd ? sleepEnd.toISOString().split('T')[0] : null
          // Key to clientToday if sleep ended today or yesterday (covers timezone edge cases)
          const finalSleepDate = (sleepEnd && (sleepEndDate === clientToday || sleepEndDate >= clientToday)) ? clientToday : sleepDate
          
          await supabase.from('whoop_data').upsert({
            user_id: userId,
            data_type: 'sleep',
            date: finalSleepDate,
            data: latestSleep,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'user_id,data_type,date' })
        }
      } catch (currentErr) {
        console.error('Error syncing current data:', currentErr.message)
      }
    }

    // Sync workout data — use unique data_type per workout so multiple per day are preserved
    if (syncType === 'all' || syncType === 'workout') {
      const data = await fetchWhoopData(accessToken, '/v2/activity/workout', {
        start: startParam,
        limit: String(Math.min(days * 3, 25)),
      })
      results.workout = data

      if (data.records) {
        for (const record of data.records) {
          // Use timezone_offset from the record to compute local date, fall back to UTC split
          let date: string
          if (record.start && record.timezone_offset) {
            const startUtc = new Date(record.start)
            const offsetMatch = record.timezone_offset.match(/^([+-])(\d{2}):(\d{2})$/)
            if (offsetMatch) {
              const sign = offsetMatch[1] === '+' ? 1 : -1
              const offsetMs = (parseInt(offsetMatch[2]) * 60 + parseInt(offsetMatch[3])) * 60000 * sign
              const localTime = new Date(startUtc.getTime() + offsetMs)
              date = localTime.toISOString().split('T')[0]
            } else {
              date = record.start.split('T')[0]
            }
          } else {
            date = record.start?.split('T')[0] || record.created_at?.split('T')[0]
          }
          const whoopId = record.id || record.v1_id || date
          if (date) {
            await supabase.from('whoop_data').upsert({
              user_id: userId,
              data_type: `workout:${whoopId}`,
              date,
              data: record,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'user_id,data_type,date' })
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      synced: Object.keys(results),
      days,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Whoop sync error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
