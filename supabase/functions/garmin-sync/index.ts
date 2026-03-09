import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const OAUTH_CONSUMER_KEY = 'fc3e99d2-118c-44b8-8ae3-03370dde24c0'
const OAUTH_CONSUMER_SECRET = 'E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF'

const GARMIN_CONNECT_API = 'https://connect.garmin.com'
const GARMIN_CONNECT_API_V2 = 'https://connectapi.garmin.com'
const USER_AGENT = 'com.garmin.android.apps.connectmobile'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── OAuth1 signing (same as garmin-auth) ──

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function generateNonce(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  const bytes = new Uint8Array(signature)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

async function buildOAuth1Header(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  tokenKey = '',
  tokenSecret = '',
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = generateNonce()

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
    ...(tokenKey ? { oauth_token: tokenKey } : {}),
  }

  const urlObj = new URL(url)
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`

  // Include query params in signature
  const queryParams: Record<string, string> = {}
  urlObj.searchParams.forEach((v, k) => { queryParams[k] = v })
  const allParams = { ...oauthParams, ...queryParams }
  const sortedKeys = Object.keys(allParams).sort()
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`).join('&')

  const signatureBaseString = `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(paramString)}`
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`
  const signature = await hmacSha1Base64(signingKey, signatureBaseString)

  oauthParams['oauth_signature'] = signature
  const headerParts = Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ')

  return `OAuth ${headerParts}`
}

// ── Refresh OAuth2 token using OAuth1 ──

async function refreshOAuth2(oauth1: any): Promise<any> {
  const exchangeUrl = `${GARMIN_CONNECT_API_V2}/oauth-service/oauth/exchange/user/2.0`
  const header = await buildOAuth1Header('POST', exchangeUrl, OAUTH_CONSUMER_KEY, OAUTH_CONSUMER_SECRET, oauth1.oauth_token, oauth1.oauth_token_secret)
  const resp = await fetch(exchangeUrl, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Authorization': header,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  if (!resp.ok) throw new Error('OAuth2 refresh failed')
  const token = await resp.json()
  const now = Math.floor(Date.now() / 1000)
  token.expires_at = now + (token.expires_in || 3600)
  token.refresh_token_expires_at = now + (token.refresh_token_expires_in || 7776000)
  return token
}

// ── Get valid OAuth2 access token, refreshing if needed ──

async function getAccessToken(supabase: any, userId: string, oauthTokens: any): Promise<string> {
  let { oauth1, oauth2 } = oauthTokens
  const now = Math.floor(Date.now() / 1000)

  // Refresh if expired or expiring within 5 minutes
  if (!oauth2?.access_token || (oauth2.expires_at && oauth2.expires_at - now < 300)) {
    console.log('[Garmin] OAuth2 token expired, refreshing...')
    oauth2 = await refreshOAuth2(oauth1)
    await supabase.from('garmin_tokens').update({
      oauth_tokens: { oauth1, oauth2 },
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    console.log('[Garmin] OAuth2 token refreshed')
  }

  return oauth2.access_token
}

// ── Fetch from Garmin Connect API using OAuth2 Bearer token ──

async function fetchGarmin(accessToken: string, endpoint: string): Promise<any> {
  const url = `${GARMIN_CONNECT_API}${endpoint}`
  console.log('[Garmin] Fetching:', url)

  const resp = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'DI-Backend': 'connectapi.garmin.com',
    },
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error('[Garmin] API error:', resp.status, text.substring(0, 300))
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('Garmin session expired. Please reconnect.')
    }
    throw new Error(`Garmin API error: ${resp.status}`)
  }

  return resp.json()
}

function extractActivityData(activity: any) {
  return {
    activityId: activity.activityId,
    activityName: activity.activityName,
    activityType: activity.activityType,
    startTimeLocal: activity.startTimeLocal,
    duration: activity.duration,
    distance: activity.distance,
    averageHR: activity.averageHR,
    maxHR: activity.maxHR,
    calories: activity.calories,
    averageSpeed: activity.averageSpeed,
    maxSpeed: activity.maxSpeed,
    elevationGain: activity.elevationGain,
    vO2MaxValue: activity.vO2MaxValue,
    trainingEffectLabel: activity.trainingEffectLabel,
    averageRunningCadenceInStepsPerMinute: activity.averageRunningCadenceInStepsPerMinute,
    avgStrideLength: activity.avgStrideLength,
    _raw: activity,
  }
}

// ── Fetch activity detail and splits ──

async function fetchActivityDetails(accessToken: string, activityId: number): Promise<{ detail: any; splits: any[] | null }> {
  let detail = null
  let splits = null

  // Fetch full activity detail
  try {
    detail = await fetchGarmin(accessToken, `/activity-service/activity/${activityId}`)
  } catch (err) {
    console.error(`[Garmin] Failed to fetch detail for activity ${activityId}:`, err.message)
  }

  // Fetch splits/laps (works for runs, swims, cycling — 404s gracefully for others)
  try {
    const splitsResp = await fetchGarmin(accessToken, `/activity-service/activity/${activityId}/splits`)
    if (splitsResp && Array.isArray(splitsResp.lapDTOs)) {
      splits = splitsResp.lapDTOs
    } else if (splitsResp && Array.isArray(splitsResp)) {
      splits = splitsResp
    }
  } catch (err) {
    // 404 is expected for activity types without splits
    if (!err.message?.includes('404')) {
      console.error(`[Garmin] Failed to fetch splits for activity ${activityId}:`, err.message)
    }
  }

  return { detail, splits }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!userToken) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const bodyPeek = await req.clone().json().catch(() => ({}))
    let userId: string

    if (bodyPeek.userId) {
      userId = bodyPeek.userId
    } else {
      const { data: { user } } = await supabase.auth.getUser(userToken)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid user' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      userId = user.id
    }

    // Get stored tokens
    const { data: tokens } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!tokens?.oauth_tokens?.oauth1) {
      return new Response(JSON.stringify({ error: 'Garmin not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get valid access token (auto-refreshes if expired)
    const accessToken = await getAccessToken(supabase, userId, tokens.oauth_tokens)

    const body = await req.json().catch(() => ({}))
    const days = body.days || 7
    const quickCheck = body.quickCheck || false
    const limit = Math.min(days * 3, 50)

    // Fetch activity list
    console.log('[Garmin] Syncing activities, limit:', limit, 'quickCheck:', quickCheck)
    const activities = await fetchGarmin(
      accessToken,
      `/activitylist-service/activities/search/activities?start=0&limit=${limit}`
    )

    if (!Array.isArray(activities)) {
      console.error('[Garmin] Unexpected response:', typeof activities)
      throw new Error('Unexpected response from Garmin API')
    }

    console.log('[Garmin] Fetched', activities.length, 'activities')

    // Quick check mode: only see if there are new activities since last sync
    const lastSyncedId = tokens.last_synced_activity_id
    if (quickCheck && lastSyncedId && activities.length > 0) {
      const latestId = String(activities[0].activityId)
      if (latestId === lastSyncedId) {
        console.log('[Garmin] Quick check: no new activities')
        return new Response(JSON.stringify({
          success: true,
          synced: 0,
          total: activities.length,
          days,
          quickCheck: true,
          noNewData: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log('[Garmin] Quick check: new activities found (latest:', latestId, 'vs last synced:', lastSyncedId, ')')
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]
    let synced = 0

    // Filter activities within date range first
    const rangeActivities = activities.filter((activity: any) => {
      const localTime = activity.startTimeLocal || ''
      const date = localTime.split(' ')[0]
      return date && date >= startStr
    })

    console.log('[Garmin] Activities in date range:', rangeActivities.length)

    for (const activity of rangeActivities) {
      const localTime = activity.startTimeLocal || ''
      const date = localTime.split(' ')[0]
      const activityData = extractActivityData(activity)
      const activityId = activity.activityId

      // Fetch detailed data (splits, HR zones, training load)
      try {
        const { detail, splits } = await fetchActivityDetails(accessToken, activityId)
        if (splits) {
          activityData.splits = splits
        }
        if (detail) {
          activityData.detail = {
            averageSwimCadenceInStrokesPerMinute: detail.averageSwimCadenceInStrokesPerMinute,
            averageSwolf: detail.averageSwolf,
            poolLength: detail.poolLength,
            totalNumberOfStrokes: detail.totalNumberOfStrokes,
            swimStrokeType: detail.swimStrokeType,
            aerobicTrainingEffect: detail.aerobicTrainingEffect,
            anaerobicTrainingEffect: detail.anaerobicTrainingEffect,
            trainingEffectLabel: detail.trainingEffectLabel,
            activityTrainingLoad: detail.activityTrainingLoad,
            hrZones: detail.hrZones,
            avgPower: detail.avgPower,
            maxPower: detail.maxPower,
            normPower: detail.normPower,
            avgRunCadence: detail.avgRunCadence,
            maxRunCadence: detail.maxRunCadence,
            strideLength: detail.strideLength,
            vO2MaxValue: detail.vO2MaxValue,
            lactateThreshold: detail.lactateThreshold,
            maxVerticalOscillation: detail.maxVerticalOscillation,
          }
        }
      } catch (err) {
        console.error(`[Garmin] Detail fetch failed for ${activityId}:`, err.message)
      }

      const { error } = await supabase.from('garmin_data').upsert({
        user_id: userId,
        data_type: `activity:${activityId}`,
        date,
        data: activityData,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,data_type,date' })

      if (error) {
        console.error('[Garmin] Upsert error:', activityId, error.message)
      } else {
        synced++
      }
    }

    // Store the latest activity ID for quick check optimization
    const latestActivityId = activities.length > 0 ? String(activities[0].activityId) : lastSyncedId
    await supabase.from('garmin_tokens')
      .update({
        updated_at: new Date().toISOString(),
        last_synced_activity_id: latestActivityId,
      })
      .eq('user_id', userId)

    return new Response(JSON.stringify({
      success: true,
      synced,
      total: activities.length,
      days,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[Garmin] Sync error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
