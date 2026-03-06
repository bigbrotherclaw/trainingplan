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

async function refreshTokenIfNeeded(supabase: any, userId: string, tokens: any) {
  const expiresAt = new Date(tokens.expires_at)
  const now = new Date()
  
  // Refresh if expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokens.access_token
  }

  console.log('Refreshing Whoop token for user:', userId)
  
  const resp = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: WHOOP_CLIENT_ID,
      client_secret: WHOOP_CLIENT_SECRET,
    }),
  })

  if (!resp.ok) {
    throw new Error(`Token refresh failed: ${await resp.text()}`)
  }

  const newTokens = await resp.json()
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()

  await supabase
    .from('whoop_tokens')
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return newTokens.access_token
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
    const { data: { user } } = await supabase.auth.getUser(userToken)

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get stored tokens
    const { data: tokens } = await supabase
      .from('whoop_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!tokens) {
      return new Response(JSON.stringify({ error: 'Whoop not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, user.id, tokens)

    // Determine what to sync based on request body
    const body = await req.json().catch(() => ({}))
    const syncType = body.type || 'all' // 'all', 'recovery', 'sleep', 'cycle', 'workout'
    const days = body.days || 7 // How many days to sync

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
              user_id: user.id,
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
              user_id: user.id,
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
              user_id: user.id,
              data_type: 'cycle',
              date,
              data: record,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'user_id,data_type,date' })
          }
        }
      }
    }

    // Sync workout data
    if (syncType === 'all' || syncType === 'workout') {
      const data = await fetchWhoopData(accessToken, '/v2/activity/workout', {
        start: startParam,
        limit: String(Math.min(days * 2, 25)),
      })
      results.workout = data

      if (data.records) {
        for (const record of data.records) {
          const date = record.start?.split('T')[0] || record.created_at?.split('T')[0]
          if (date) {
            await supabase.from('whoop_data').upsert({
              user_id: user.id,
              data_type: 'workout',
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
