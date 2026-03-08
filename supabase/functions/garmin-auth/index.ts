import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// OAuth consumer credentials (same as Garmin Connect mobile app, via garth)
const OAUTH_CONSUMER_KEY = 'fc3e99d2-118c-44b8-8ae3-03370dde24c0'
const OAUTH_CONSUMER_SECRET = 'E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF'

const GARMIN_DOMAIN = 'garmin.com'
const SSO = `https://sso.${GARMIN_DOMAIN}/sso`
const SSO_EMBED = `${SSO}/embed`
const CONNECT_API = `https://connectapi.${GARMIN_DOMAIN}`

const SSO_EMBED_PARAMS = {
  id: 'gauth-widget',
  embedWidget: 'true',
  gauthHost: SSO,
}

const SIGNIN_PARAMS = {
  ...SSO_EMBED_PARAMS,
  gauthHost: SSO_EMBED,
  service: SSO_EMBED,
  source: SSO_EMBED,
  redirectAfterAccountLoginUrl: SSO_EMBED,
  redirectAfterAccountCreationUrl: SSO_EMBED,
}

const USER_AGENT = 'com.garmin.android.apps.connectmobile'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Cookie helpers ──

function parseCookies(resp: Response, existing: Record<string, string> = {}): Record<string, string> {
  const cookies = { ...existing }
  const setCookies = resp.headers.getSetCookie?.() || []
  if (setCookies.length === 0) {
    const raw = resp.headers.get('set-cookie')
    if (raw) {
      for (const part of raw.split(/,\s*(?=[A-Za-z_-]+=)/)) {
        const nv = part.split(';')[0].trim()
        const eq = nv.indexOf('=')
        if (eq > 0) cookies[nv.substring(0, eq)] = nv.substring(eq + 1)
      }
    }
  } else {
    for (const sc of setCookies) {
      const nv = sc.split(';')[0].trim()
      const eq = nv.indexOf('=')
      if (eq > 0) cookies[nv.substring(0, eq)] = nv.substring(eq + 1)
    }
  }
  return cookies
}

function cookieStr(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

// ── OAuth1 signing ──

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
  extraParams: Record<string, string> = {},
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

  // Merge all params for signature base string
  const allParams = { ...oauthParams, ...extraParams }
  const sortedKeys = Object.keys(allParams).sort()
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`).join('&')

  // Parse URL to separate base URL and query params
  const urlObj = new URL(url)
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`

  // Include query params in signature
  const queryParams: Record<string, string> = {}
  urlObj.searchParams.forEach((v, k) => { queryParams[k] = v })
  const allSignParams = { ...allParams, ...queryParams }
  const sortedSignKeys = Object.keys(allSignParams).sort()
  const signParamString = sortedSignKeys.map(k => `${percentEncode(k)}=${percentEncode(allSignParams[k])}`).join('&')

  const signatureBaseString = `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(signParamString)}`
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`

  const signature = await hmacSha1Base64(signingKey, signatureBaseString)
  oauthParams['oauth_signature'] = signature

  const headerParts = Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ')

  return `OAuth ${headerParts}`
}

// ── Garmin SSO + OAuth login ──

async function garminLogin(email: string, password: string): Promise<{ oauth1: any; oauth2: any } | { needsMfa: true; cookies: Record<string, string>; mfaCsrf: string }> {
  let cookies: Record<string, string> = {}

  // Step 1: Set cookies via SSO embed
  console.log('[Garmin] Step 1: Loading SSO embed...')
  const embedUrl = `${SSO}/embed?${new URLSearchParams(SSO_EMBED_PARAMS)}`
  const embedResp = await fetch(embedUrl, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'manual',
  })
  cookies = parseCookies(embedResp, cookies)
  await embedResp.text() // consume body

  // Step 2: GET signin page for CSRF token
  console.log('[Garmin] Step 2: Getting CSRF token...')
  const signinUrl = `${SSO}/signin?${new URLSearchParams(SIGNIN_PARAMS)}`
  const csrfResp = await fetch(signinUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': cookieStr(cookies),
      'Referer': embedUrl,
    },
    redirect: 'manual',
  })
  cookies = parseCookies(csrfResp, cookies)
  const csrfHtml = await csrfResp.text()

  const csrfMatch = csrfHtml.match(/name="_csrf"\s+value="([^"]+)"/)
  if (!csrfMatch) {
    console.error('[Garmin] CSRF not found. HTML length:', csrfHtml.length, 'Status:', csrfResp.status)
    throw new Error('Failed to load Garmin login page')
  }
  const csrfToken = csrfMatch[1]
  console.log('[Garmin] Got CSRF token, cookies:', Object.keys(cookies).length)

  // Step 3: POST credentials
  console.log('[Garmin] Step 3: Submitting credentials...')
  console.log('[Garmin] Sending cookies:', Object.keys(cookies).join(', '))
  const loginResp = await fetch(signinUrl, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr(cookies),
      'Referer': signinUrl,
      'Origin': `https://sso.${GARMIN_DOMAIN}`,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    body: new URLSearchParams({
      username: email,
      password: password,
      embed: 'true',
      _csrf: csrfToken,
    }),
    redirect: 'manual',
  })
  cookies = parseCookies(loginResp, cookies)
  
  // Follow redirects if any (some SSO flows redirect before the final response)
  let loginHtml = ''
  if (loginResp.status >= 300 && loginResp.status < 400) {
    const redirectUrl = loginResp.headers.get('location')
    console.log('[Garmin] Login redirected to:', redirectUrl)
    if (redirectUrl) {
      const redirectResp = await fetch(redirectUrl.startsWith('http') ? redirectUrl : `https://sso.${GARMIN_DOMAIN}${redirectUrl}`, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': cookieStr(cookies) },
        redirect: 'manual',
      })
      cookies = parseCookies(redirectResp, cookies)
      loginHtml = await redirectResp.text()
    }
  } else {
    loginHtml = await loginResp.text()
  }
  console.log('[Garmin] Login response status:', loginResp.status, 'HTML length:', loginHtml.length)

  // Check for MFA
  const titleMatch = loginHtml.match(/<title>(.+?)<\/title>/)
  const title = titleMatch?.[1] || ''
  if (title.includes('MFA') || loginHtml.includes('verifyMFA') || loginHtml.includes('mfa-code')) {
    console.log('[Garmin] MFA required, returning cookies for second step')
    // Extract new CSRF token from MFA page
    const mfaCsrfMatch = loginHtml.match(/name="_csrf"\s+value="([^"]+)"/)
    const mfaCsrf = mfaCsrfMatch?.[1] || ''
    // Return cookies + csrf so the client can call /verify-mfa
    return {
      needsMfa: true,
      cookies,
      mfaCsrf,
    }
  }

  if (title !== 'Success') {
    if (loginHtml.includes('locked') || loginHtml.includes('LOCKED')) {
      throw new Error('Garmin account is locked. Try again later.')
    }
    // Extract the actual error message from the page
    const errorMsgMatch = loginHtml.match(/class="error"[^>]*>([^<]+)</)
    const errorMsg = errorMsgMatch?.[1]?.trim()
    if (errorMsg) {
      console.error('[Garmin] Login error message:', errorMsg)
      throw new Error(errorMsg)
    }
    if (loginHtml.includes('Invalid sign in') || loginHtml.includes('credentials') || loginHtml.includes('invalid')) {
      throw new Error('Invalid Garmin email or password.')
    }
    console.error('[Garmin] Unexpected title:', title, 'HTML length:', loginHtml.length)
    // Log a snippet of the response for debugging
    console.error('[Garmin] Response snippet:', loginHtml.substring(0, 500))
    throw new Error(`Garmin login failed: ${title || 'unknown error'}`)
  }

  // Step 4: Extract ticket and get OAuth tokens
  return completeLogin(loginHtml, cookies)
}

// ── Verify MFA code and complete login ──

async function verifyMfaAndLogin(
  mfaCode: string,
  mfaCsrf: string,
  cookies: Record<string, string>,
): Promise<{ oauth1: any; oauth2: any }> {
  const signinUrl = `${SSO}/signin?${new URLSearchParams(SIGNIN_PARAMS)}`

  console.log('[Garmin] Verifying MFA code...')
  const mfaResp = await fetch(`${SSO}/verifyMFA/loginEnterMfaCode?${new URLSearchParams(SIGNIN_PARAMS)}`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr(cookies),
      'Referer': signinUrl,
      'Origin': `https://sso.${GARMIN_DOMAIN}`,
    },
    body: new URLSearchParams({
      'mfa-code': mfaCode,
      embed: 'true',
      _csrf: mfaCsrf,
      fromPage: 'setupEnterMfaCode',
    }),
    redirect: 'manual',
  })
  cookies = parseCookies(mfaResp, cookies)

  let mfaHtml = ''
  if (mfaResp.status >= 300 && mfaResp.status < 400) {
    const loc = mfaResp.headers.get('location')
    if (loc) {
      const rResp = await fetch(loc.startsWith('http') ? loc : `https://sso.${GARMIN_DOMAIN}${loc}`, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': cookieStr(cookies) },
        redirect: 'manual',
      })
      cookies = parseCookies(rResp, cookies)
      mfaHtml = await rResp.text()
    }
  } else {
    mfaHtml = await mfaResp.text()
  }

  const titleMatch = mfaHtml.match(/<title>(.+?)<\/title>/)
  const title = titleMatch?.[1] || ''
  console.log('[Garmin] MFA response title:', title)

  if (title !== 'Success') {
    if (mfaHtml.includes('invalid') || mfaHtml.includes('incorrect') || mfaHtml.includes('error')) {
      throw new Error('Invalid MFA code. Please try again.')
    }
    throw new Error(`MFA verification failed: ${title || 'unknown'}`)
  }

  return completeLogin(mfaHtml, cookies)
}

// ── Extract ticket and get OAuth tokens ──

async function completeLogin(html: string, cookies: Record<string, string>): Promise<{ oauth1: any; oauth2: any }> {
  const ticketMatch = html.match(/embed\?ticket=([^"]+)"/)
  if (!ticketMatch) {
    console.error('[Garmin] No ticket in success response')
    throw new Error('Login succeeded but no ticket received')
  }
  const ticket = ticketMatch[1]
  console.log('[Garmin] Got ticket:', ticket.substring(0, 15) + '...')

  // Get OAuth1 token
  console.log('[Garmin] Getting OAuth1 token...')
  const preAuthUrl = `${CONNECT_API}/oauth-service/oauth/preauthorized?ticket=${ticket}&login-url=${encodeURIComponent(SSO_EMBED)}&accepts-mfa-tokens=true`
  const oauth1Header = await buildOAuth1Header('GET', preAuthUrl, OAUTH_CONSUMER_KEY, OAUTH_CONSUMER_SECRET)
  const oauth1Resp = await fetch(preAuthUrl, {
    headers: { 'User-Agent': USER_AGENT, 'Authorization': oauth1Header, 'Cookie': cookieStr(cookies) },
  })
  if (!oauth1Resp.ok) {
    const err = await oauth1Resp.text()
    console.error('[Garmin] OAuth1 preauthorized failed:', oauth1Resp.status, err)
    throw new Error('Failed to obtain OAuth1 token')
  }
  const oauth1Text = await oauth1Resp.text()
  const oauth1Parsed = Object.fromEntries(new URLSearchParams(oauth1Text))
  console.log('[Garmin] Got OAuth1 token:', !!oauth1Parsed.oauth_token)

  // Exchange for OAuth2
  console.log('[Garmin] Exchanging for OAuth2 token...')
  const exchangeUrl = `${CONNECT_API}/oauth-service/oauth/exchange/user/2.0`
  const oauth2Header = await buildOAuth1Header('POST', exchangeUrl, OAUTH_CONSUMER_KEY, OAUTH_CONSUMER_SECRET, oauth1Parsed.oauth_token, oauth1Parsed.oauth_token_secret)
  const oauth2Resp = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Authorization': oauth2Header, 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!oauth2Resp.ok) {
    const err = await oauth2Resp.text()
    console.error('[Garmin] OAuth2 exchange failed:', oauth2Resp.status, err)
    throw new Error('Failed to obtain OAuth2 token')
  }
  const oauth2Token = await oauth2Resp.json()
  const now = Math.floor(Date.now() / 1000)
  oauth2Token.expires_at = now + (oauth2Token.expires_in || 3600)
  oauth2Token.refresh_token_expires_at = now + (oauth2Token.refresh_token_expires_in || 7776000)

  return {
    oauth1: { oauth_token: oauth1Parsed.oauth_token, oauth_token_secret: oauth1Parsed.oauth_token_secret, mfa_token: oauth1Parsed.mfa_token || null },
    oauth2: oauth2Token,
  }
}

// ── Refresh OAuth2 using OAuth1 token ──

async function refreshOAuth2(oauth1: any): Promise<any> {
  const exchangeUrl = `${CONNECT_API}/oauth-service/oauth/exchange/user/2.0`
  const header = buildOAuth1Header(
    'POST',
    exchangeUrl,
    OAUTH_CONSUMER_KEY,
    OAUTH_CONSUMER_SECRET,
    oauth1.oauth_token,
    oauth1.oauth_token_secret,
  )
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
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      const { email, password } = body
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken)
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid user' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Perform full Garmin login
      const result = await garminLogin(email, password)

      // Check if MFA is required
      if ('needsMfa' in result && result.needsMfa) {
        // Store the MFA state temporarily so verify-mfa can continue
        await supabase
          .from('garmin_tokens')
          .upsert({
            user_id: user.id,
            email,
            session_cookies: result.cookies, // temp: store SSO cookies for MFA step
            oauth_tokens: { mfaPending: true, mfaCsrf: result.mfaCsrf },
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        return new Response(JSON.stringify({ needsMfa: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // No MFA — store OAuth tokens
      const { oauth1, oauth2 } = result
      const { error: upsertError } = await supabase
        .from('garmin_tokens')
        .upsert({
          user_id: user.id,
          email,
          oauth_tokens: { oauth1, oauth2 },
          session_cookies: {},
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error('[Garmin] DB upsert failed:', JSON.stringify(upsertError))
        return new Response(JSON.stringify({ error: 'Failed to store connection' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ connected: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Verify MFA code ──
    if (path === 'verify-mfa') {
      const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!userToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      const { code } = body
      if (!code) {
        return new Response(JSON.stringify({ error: 'MFA code is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken)
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid user' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Load the pending MFA state
      const { data: tokens } = await supabase
        .from('garmin_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!tokens?.oauth_tokens?.mfaPending) {
        return new Response(JSON.stringify({ error: 'No pending MFA verification' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const cookies = tokens.session_cookies as Record<string, string>
      const mfaCsrf = tokens.oauth_tokens.mfaCsrf

      // Complete MFA verification
      const { oauth1, oauth2 } = await verifyMfaAndLogin(code, mfaCsrf, cookies)

      // Store final OAuth tokens
      await supabase.from('garmin_tokens').update({
        oauth_tokens: { oauth1, oauth2 },
        session_cookies: {},
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      return new Response(JSON.stringify({ connected: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Status ──
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

    // ── Disconnect ──
    if (path === 'disconnect') {
      const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!userToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // ── Refresh: get fresh OAuth2 token ──
    if (path === 'refresh') {
      const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!userToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user } } = await supabase.auth.getUser(userToken)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid user' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: tokens } = await supabase
        .from('garmin_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (!tokens?.oauth_tokens?.oauth1) {
        return new Response(JSON.stringify({ error: 'Not connected' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const newOAuth2 = await refreshOAuth2(tokens.oauth_tokens.oauth1)
      await supabase.from('garmin_tokens').update({
        oauth_tokens: { ...tokens.oauth_tokens, oauth2: newOAuth2 },
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      return new Response(JSON.stringify({ refreshed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown path' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[Garmin] Auth error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
