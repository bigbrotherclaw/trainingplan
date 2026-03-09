import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WHOOP_API = 'https://api.prod.whoop.com/developer'
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID') || ''
const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

async function refreshToken(supabase: any, userId: string, tokens: any): Promise<string> {
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
    console.error('[Webhook] Token refresh failed:', resp.status, errText)
    await supabase
      .from('whoop_tokens')
      .update({ token_error: errText, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    throw new Error(`Token refresh failed: ${errText}`)
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
      token_error: null,
    })
    .eq('user_id', userId)

  return newTokens.access_token
}

async function getAccessToken(supabase: any, userId: string, tokens: any): Promise<string> {
  const expiresAt = new Date(tokens.expires_at)
  const now = new Date()
  const timeLeft = expiresAt.getTime() - now.getTime()

  // Refresh if less than 5 minutes left
  if (timeLeft < 5 * 60 * 1000) {
    return refreshToken(supabase, userId, tokens)
  }

  return tokens.access_token
}

async function fetchWhoopData(accessToken: string, endpoint: string): Promise<any> {
  const resp = await fetch(`${WHOOP_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!resp.ok) {
    throw new Error(`Whoop API error: ${resp.status} ${await resp.text()}`)
  }

  return resp.json()
}

// Map webhook event types to API endpoints and data_type keys
const EVENT_CONFIG: Record<string, { endpoint: (id: string) => string; dataType: string; dateField: string }> = {
  'recovery.updated': {
    endpoint: (id) => `/v2/recovery/${id}`,
    dataType: 'recovery',
    dateField: 'created_at',
  },
  'workout.updated': {
    endpoint: (id) => `/v2/activity/workout/${id}`,
    dataType: 'workout',
    dateField: 'start',
  },
  'sleep.updated': {
    endpoint: (id) => `/v2/activity/sleep/${id}`,
    dataType: 'sleep',
    dateField: 'start',
  },
  'cycle.updated': {
    endpoint: (id) => `/v2/cycle/${id}`,
    dataType: 'cycle',
    dateField: 'start',
  },
}

serve(async (req: Request) => {
  // Handle Whoop webhook verification (GET request)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const challenge = url.searchParams.get('challenge')
    if (challenge) {
      console.log('[Webhook] Verification challenge received')
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
    return new Response('OK', { status: 200 })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload = await req.json()
    console.log('[Webhook] Received:', JSON.stringify(payload))

    const { user_id: whoopUserId, id: recordId, type: eventType } = payload

    if (!whoopUserId || !recordId || !eventType) {
      console.error('[Webhook] Invalid payload:', payload)
      return new Response('OK', { status: 200 }) // Still return 200 to acknowledge
    }

    const config = EVENT_CONFIG[eventType]
    if (!config) {
      console.log('[Webhook] Unknown event type:', eventType)
      return new Response('OK', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Look up the Supabase user from whoop_user_id
    const { data: tokenRow, error: lookupError } = await supabase
      .from('whoop_tokens')
      .select('*')
      .eq('whoop_user_id', String(whoopUserId))
      .single()

    if (lookupError || !tokenRow) {
      console.error('[Webhook] No user found for whoop_user_id:', whoopUserId, lookupError?.message)
      return new Response('OK', { status: 200 })
    }

    const userId = tokenRow.user_id
    console.log('[Webhook] Matched user:', userId, 'event:', eventType)

    // Get a valid access token
    const accessToken = await getAccessToken(supabase, userId, tokenRow)

    // Fetch the updated record from Whoop API
    const record = await fetchWhoopData(accessToken, config.endpoint(String(recordId)))

    // Determine the date key
    const dateValue = record[config.dateField] || record.created_at
    const date = dateValue?.split('T')[0]
    if (!date) {
      console.error('[Webhook] Could not determine date for record:', recordId)
      return new Response('OK', { status: 200 })
    }

    // For workouts, use unique data_type to support multiple per day
    const dataType = eventType === 'workout.updated'
      ? `workout:${record.id || recordId}`
      : config.dataType

    // Upsert into whoop_data
    const { error: upsertError } = await supabase.from('whoop_data').upsert({
      user_id: userId,
      data_type: dataType,
      date,
      data: record,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id,data_type,date' })

    if (upsertError) {
      console.error('[Webhook] Upsert error:', upsertError.message)
    } else {
      console.log('[Webhook] Upserted:', dataType, date)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[Webhook] Error:', error.message)
    // Always return 200 to prevent Whoop from retrying
    return new Response('OK', { status: 200 })
  }
})
