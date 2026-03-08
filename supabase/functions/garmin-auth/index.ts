import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const GARMIN_SSO_URL = 'https://sso.garmin.com/sso/signin'
const GARMIN_SSO_PARAMS = {
  service: 'https://connect.garmin.com/modern',
  gauthHost: 'https://sso.garmin.com/sso/embed',
  consumeServiceTicket: 'false',
  id: 'gauth-widget',
  embedWidget: 'true',
  cssUrl: 'https://connect.garmin.com/gauth-custom-v1.2-min.css',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Parse Set-Cookie headers from a Response and return as a cookie string + cookie map.
 */
function parseCookies(resp: Response, existingCookies: Record<string, string> = {}): Record<string, string> {
  const cookies = { ...existingCookies }
  const setCookieHeaders = resp.headers.getSetCookie?.() || []
  // Fallback: try raw header
  if (setCookieHeaders.length === 0) {
    const raw = resp.headers.get('set-cookie')
    if (raw) {
      // Multiple Set-Cookie headers may be concatenated with comma + space
      // But cookie values can contain commas, so split carefully on pattern: ", NAME="
      const parts = raw.split(/,\s*(?=[A-Za-z_-]+=)/)
      for (const part of parts) {
        const nameVal = part.split(';')[0].trim()
        const eqIdx = nameVal.indexOf('=')
        if (eqIdx > 0) {
          cookies[nameVal.substring(0, eqIdx)] = nameVal.substring(eqIdx + 1)
        }
      }
    }
  } else {
    for (const sc of setCookieHeaders) {
      const nameVal = sc.split(';')[0].trim()
      const eqIdx = nameVal.indexOf('=')
      if (eqIdx > 0) {
        cookies[nameVal.substring(0, eqIdx)] = nameVal.substring(eqIdx + 1)
      }
    }
  }
  return cookies
}

/**
 * Build Cookie header string from cookie map.
 */
function cookieString(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

/**
 * Perform Garmin SSO login and return session cookies.
 */
async function garminSSOLogin(email: string, password: string): Promise<Record<string, string>> {
  // Step 1: GET the SSO signin page to extract CSRF token and initial cookies
  const ssoParams = new URLSearchParams(GARMIN_SSO_PARAMS)
  const signinUrl = `${GARMIN_SSO_URL}?${ssoParams.toString()}`

  console.log('[Garmin] Step 1: Fetching SSO signin page...')
  const step1Resp = await fetch(signinUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'manual',
  })

  let cookies = parseCookies(step1Resp)
  const html = await step1Resp.text()

  // Extract _csrf token from HTML
  const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/)
  if (!csrfMatch) {
    console.error('[Garmin] Could not find _csrf token in signin page')
    throw new Error('Failed to load Garmin login page - CSRF token not found')
  }
  const csrfToken = csrfMatch[1]
  console.log('[Garmin] Got CSRF token and', Object.keys(cookies).length, 'cookies')

  // Step 2: POST credentials to SSO signin
  console.log('[Garmin] Step 2: Posting credentials...')
  const step2Resp = await fetch(signinUrl, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieString(cookies),
      'Origin': 'https://sso.garmin.com',
      'Referer': signinUrl,
    },
    body: new URLSearchParams({
      username: email,
      password: password,
      _csrf: csrfToken,
      embed: 'false',
    }),
    redirect: 'manual',
  })

  cookies = parseCookies(step2Resp, cookies)
  const step2Html = await step2Resp.text()

  // Look for ticket URL in the response HTML
  const ticketMatch = step2Html.match(/ticket=(ST-[^"&\\]+)/)
  if (!ticketMatch) {
    // Check for error messages
    if (step2Html.includes('locked') || step2Html.includes('LOCKED')) {
      throw new Error('Garmin account is locked. Please try again later.')
    }
    if (step2Html.includes('credentials') || step2Html.includes('invalid')) {
      throw new Error('Invalid Garmin email or password.')
    }
    console.error('[Garmin] No ticket found in response. Response length:', step2Html.length)
    throw new Error('Garmin login failed - no service ticket received')
  }

  const ticket = ticketMatch[1]
  console.log('[Garmin] Got service ticket:', ticket.substring(0, 10) + '...')

  // Step 3: Exchange ticket for session cookies
  console.log('[Garmin] Step 3: Exchanging ticket for session...')
  const step3Url = `https://connect.garmin.com/modern/?ticket=${ticket}`
  const step3Resp = await fetch(step3Url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Cookie': cookieString(cookies),
    },
    redirect: 'manual',
  })

  cookies = parseCookies(step3Resp, cookies)

  // Follow any redirects manually to collect all cookies
  const location = step3Resp.headers.get('location')
  if (location) {
    console.log('[Garmin] Following redirect...')
    const step4Resp = await fetch(location, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Cookie': cookieString(cookies),
      },
      redirect: 'manual',
    })
    cookies = parseCookies(step4Resp, cookies)
  }

  console.log('[Garmin] Login complete. Session cookies:', Object.keys(cookies).length)
  return cookies
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  try {
    // ── Connect: SSO login with email/password ──
    if (path === 'connect') {
      const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!userToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      const { email, password } = body
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken)
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid user' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Perform Garmin SSO login
      const sessionCookies = await garminSSOLogin(email, password)

      // Store session in database (do NOT store password)
      const { error: upsertError } = await supabase
        .from('garmin_tokens')
        .upsert({
          user_id: user.id,
          email,
          session_cookies: sessionCookies,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error('[Garmin] DB upsert failed:', JSON.stringify(upsertError))
        return new Response(JSON.stringify({ error: 'Failed to store connection' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ connected: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Status: check if connected ──
    if (path === 'status') {
      const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!userToken) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user } } = await supabase.auth.getUser(userToken)
      if (!user) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: tokens } = await supabase
        .from('garmin_tokens')
        .select('email, connected_at')
        .eq('user_id', user.id)
        .single()

      return new Response(JSON.stringify({
        connected: !!tokens,
        email: tokens?.email,
        connected_at: tokens?.connected_at,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Disconnect: remove tokens and data ──
    if (path === 'disconnect') {
      const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!userToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user } } = await supabase.auth.getUser(userToken)

      if (user) {
        await supabase.from('garmin_tokens').delete().eq('user_id', user.id)
        await supabase.from('garmin_data').delete().eq('user_id', user.id)
      }

      return new Response(JSON.stringify({ disconnected: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown path' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[Garmin] Auth error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
