import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GARMIN_CONNECT_API = 'https://connect.garmin.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Build Cookie header string from cookie map.
 */
function cookieString(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

/**
 * Fetch data from Garmin Connect API using stored session cookies.
 */
async function fetchGarminData(cookies: Record<string, string>, endpoint: string): Promise<any> {
  const url = `${GARMIN_CONNECT_API}${endpoint}`
  console.log('[Garmin] Fetching:', url)

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Cookie': cookieString(cookies),
      'Accept': 'application/json',
      'NK': 'NT',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error('[Garmin] API error:', resp.status, text.substring(0, 200))
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('Garmin session expired. Please reconnect.')
    }
    throw new Error(`Garmin API error: ${resp.status}`)
  }

  return resp.json()
}

/**
 * Extract key fields from a Garmin activity for storage.
 */
function extractActivityData(activity: any) {
  return {
    activityId: activity.activityId,
    activityName: activity.activityName,
    activityType: activity.activityType,
    startTimeLocal: activity.startTimeLocal,
    duration: activity.duration, // seconds
    distance: activity.distance, // meters
    averageHR: activity.averageHR,
    maxHR: activity.maxHR,
    calories: activity.calories,
    averageSpeed: activity.averageSpeed, // m/s
    maxSpeed: activity.maxSpeed,
    elevationGain: activity.elevationGain,
    vO2MaxValue: activity.vO2MaxValue,
    trainingEffectLabel: activity.trainingEffectLabel,
    averageRunningCadenceInStepsPerMinute: activity.averageRunningCadenceInStepsPerMinute,
    avgStrideLength: activity.avgStrideLength,
    // Keep raw for future use
    _raw: activity,
  }
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

    // Support admin calls with userId param
    const bodyPeek = await req.clone().json().catch(() => ({}))
    let userId: string

    if (bodyPeek.userId) {
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

    // Get stored cookies
    const { data: tokens } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!tokens || !tokens.session_cookies) {
      return new Response(JSON.stringify({ error: 'Garmin not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cookies = tokens.session_cookies as Record<string, string>
    const body = await req.json().catch(() => ({}))
    const days = body.days || 7
    const limit = Math.min(days * 3, 50)

    // Fetch recent activities
    console.log('[Garmin] Syncing activities, limit:', limit)
    const activities = await fetchGarminData(
      cookies,
      `/activitylist-service/activities/search/activities?start=0&limit=${limit}`
    )

    if (!Array.isArray(activities)) {
      console.error('[Garmin] Unexpected response format:', typeof activities)
      throw new Error('Unexpected response from Garmin API')
    }

    console.log('[Garmin] Fetched', activities.length, 'activities')

    // Filter to requested date range and cache
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]
    let synced = 0

    for (const activity of activities) {
      // startTimeLocal is like "2026-03-07 14:30:00"
      const localTime = activity.startTimeLocal || ''
      const date = localTime.split(' ')[0]

      if (!date || date < startStr) continue

      const activityData = extractActivityData(activity)
      const activityId = activity.activityId

      const { error } = await supabase.from('garmin_data').upsert({
        user_id: userId,
        data_type: `activity:${activityId}`,
        date,
        data: activityData,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,data_type,date' })

      if (error) {
        console.error('[Garmin] Upsert error for activity', activityId, ':', error.message)
      } else {
        synced++
      }
    }

    // Update last sync time
    await supabase
      .from('garmin_tokens')
      .update({ updated_at: new Date().toISOString() })
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
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
