import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID') || ''
const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET') || ''
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const APP_URL = Deno.env.get('APP_URL') || 'https://bigbrotherclaw.github.io/trainingplan/'

// Custom URL scheme registered in iOS Info.plist
const NATIVE_SCHEME = 'com.bigbrother.trainingplan'

const SCOPES = 'read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Redirect helper: for native apps, use custom URL scheme (auto-closes SFSafariViewController).
 * For web, redirect to APP_URL.
 */
function appRedirect(params: Record<string, string>, isNative: boolean) {
  const qs = new URLSearchParams(params).toString()
  if (isNative) {
    // Custom URL scheme redirect - iOS/Android will intercept this and close the browser
    return Response.redirect(`${NATIVE_SCHEME}://whoop-callback?${qs}`, 302)
  }
  return Response.redirect(`${APP_URL}?${qs}`, 302)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  try {
    // ── Step 1: Initiate OAuth ──
    if (path === 'login' || path === 'whoop-auth') {
      const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!userToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Read platform hint from query or body
      const platform = url.searchParams.get('platform') || 'web'

      // Encode user token + platform in state
      const state = btoa(JSON.stringify({ token: userToken, platform, ts: Date.now() }))

      const redirectUri = `${SUPABASE_URL}/functions/v1/whoop-auth/callback`
      const authUrl = `${WHOOP_AUTH_URL}?` +
        `client_id=${WHOOP_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&state=${encodeURIComponent(state)}`

      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Step 2: OAuth Callback ──
    if (path === 'callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      // Default to native (most common case for this app)
      let isNative = true
      let userToken = ''

      // Whoop returned an error
      if (error) {
        const desc = url.searchParams.get('error_description') || 'Unknown error'
        console.error('Whoop OAuth error:', error, desc)
        // Try to decode state for platform info
        try {
          const stateData = JSON.parse(atob(decodeURIComponent(state || '')))
          isNative = stateData.platform !== 'web'
        } catch {}
        return appRedirect({ whoop: 'error', reason: desc }, isNative)
      }

      if (!code || !state) {
        console.error('Missing code or state in callback')
        return appRedirect({ whoop: 'error', reason: 'missing_params' }, isNative)
      }

      // Decode state
      let stateData: { token: string; platform: string; ts: number }
      try {
        stateData = JSON.parse(atob(decodeURIComponent(state)))
        userToken = stateData.token
        isNative = stateData.platform !== 'web'
        console.log('State decoded OK, platform:', stateData.platform, 'token length:', userToken?.length)
      } catch (e) {
        console.error('State decode failed:', e)
        return appRedirect({ whoop: 'error', reason: 'invalid_state' }, isNative)
      }

      // Exchange authorization code for tokens
      const redirectUri = `${SUPABASE_URL}/functions/v1/whoop-auth/callback`
      console.log('Exchanging code, redirect_uri:', redirectUri)

      const tokenResp = await fetch(WHOOP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: WHOOP_CLIENT_ID,
          client_secret: WHOOP_CLIENT_SECRET,
          redirect_uri: redirectUri,
        }),
      })

      if (!tokenResp.ok) {
        const err = await tokenResp.text()
        console.error('Token exchange failed:', tokenResp.status, err)
        return appRedirect({ whoop: 'error', reason: 'token_exchange_failed' }, isNative)
      }

      const tokens = await tokenResp.json()
      console.log('Token exchange OK, access_token:', !!tokens.access_token, 'refresh_token:', !!tokens.refresh_token, 'expires_in:', tokens.expires_in)

      // Verify Supabase user
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken)

      if (userError || !user) {
        console.error('Failed to verify user:', userError?.message)
        return appRedirect({ whoop: 'error', reason: 'user_auth_failed' }, isNative)
      }

      console.log('User verified:', user.id)

      // Store Whoop tokens
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      const { error: upsertError } = await supabase
        .from('whoop_tokens')
        .upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
          scopes: SCOPES.split(' '),
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error('DB upsert failed:', JSON.stringify(upsertError))
        return appRedirect({ whoop: 'error', reason: 'db_error' }, isNative)
      }

      console.log('Whoop tokens stored for user:', user.id)

      // Redirect back to app via custom URL scheme (native) or web URL
      return appRedirect({ whoop: 'connected' }, isNative)
    }

    // ── Step 3: Check connection status ──
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
        .from('whoop_tokens')
        .select('expires_at, scopes')
        .eq('user_id', user.id)
        .single()

      return new Response(JSON.stringify({
        connected: !!tokens,
        expires_at: tokens?.expires_at,
        scopes: tokens?.scopes,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Step 4: Disconnect ──
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
        await supabase.from('whoop_tokens').delete().eq('user_id', user.id)
        await supabase.from('whoop_data').delete().eq('user_id', user.id)
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
    console.error('Whoop auth error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
