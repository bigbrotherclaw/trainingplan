import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID') || ''
const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET') || ''
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const APP_URL = Deno.env.get('APP_URL') || 'https://bigbrotherclaw.github.io/trainingplan/'

const SCOPES = 'read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  try {
    // Step 1: Initiate OAuth - redirect user to Whoop
    if (path === 'login' || path === 'whoop-auth') {
      const userToken = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!userToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Generate state with user token embedded (encrypted in production)
      const state = btoa(JSON.stringify({ token: userToken, ts: Date.now() }))

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

    // Step 2: OAuth callback - exchange code for tokens
    if (path === 'callback') {
      const errorPage = (title: string, detail: string) => new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
        .card{padding:2rem;max-width:400px}.icon{font-size:3rem;margin-bottom:1rem}h2{color:#ef4444}pre{color:#888;font-size:0.75rem;text-align:left;background:#1a1a1a;padding:1rem;border-radius:8px;overflow-x:auto;margin-top:1rem;white-space:pre-wrap}</style></head>
        <body><div class="card"><div class="icon">❌</div><h2>${title}</h2><pre>${detail}</pre></div></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      // Whoop may redirect back with an error param
      if (error) {
        const desc = url.searchParams.get('error_description') || 'Unknown'
        console.error('Whoop OAuth error:', error, desc)
        return errorPage('Whoop Authorization Failed', `Error: ${error}\n${desc}`)
      }

      if (!code || !state) {
        return errorPage('Missing Parameters', `code: ${!!code}, state: ${!!state}\nURL: ${url.pathname}${url.search}`)
      }

      // Decode state to get user token
      let userToken: string
      try {
        const stateData = JSON.parse(atob(decodeURIComponent(state)))
        userToken = stateData.token
        console.log('State decoded, token length:', userToken?.length, 'timestamp:', stateData.ts)
      } catch (e) {
        console.error('State decode failed:', e)
        return errorPage('Invalid State', `Could not decode state parameter.\n${e.message}`)
      }

      // Exchange code for tokens
      const redirectUri = `${SUPABASE_URL}/functions/v1/whoop-auth/callback`
      console.log('Exchanging code for tokens, redirect_uri:', redirectUri)
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
        return errorPage('Token Exchange Failed', `Whoop API returned ${tokenResp.status}\n\n${err}`)
      }

      const tokens = await tokenResp.json()
      console.log('Token exchange success, has access_token:', !!tokens.access_token, 'has refresh_token:', !!tokens.refresh_token, 'expires_in:', tokens.expires_in)

      // Get user ID from Supabase token
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken)

      if (userError || !user) {
        console.error('Failed to get user:', userError)
        return errorPage('User Authentication Failed', `Could not verify Supabase user token.\n\nError: ${userError?.message || 'User not found'}\n\nThis can happen if:\n- Your session expired\n- You logged out\n\nTry going back to the app and reconnecting.`)
      }

      console.log('User verified:', user.id)

      // Store tokens
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
        console.error('Failed to store tokens:', upsertError)
        return errorPage('Database Error', `Failed to store Whoop tokens.\n\n${JSON.stringify(upsertError, null, 2)}`)
      }

      console.log('Whoop tokens stored successfully for user:', user.id)

      // Success page - closes in-app browser, falls back to redirect
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
        .card{padding:2rem}.check{font-size:3rem;margin-bottom:1rem}p{color:#888;font-size:0.9rem;margin-top:0.5rem}</style></head>
        <body><div class="card"><div class="check">✅</div><h2>Whoop Connected!</h2><p>Returning to your app...</p></div>
        <script>
          setTimeout(function() { try { window.close(); } catch(e) {} }, 1500);
          setTimeout(function() { window.location.href = '${APP_URL}?whoop=connected'; }, 3000);
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    // Step 3: Check connection status
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

    // Step 4: Disconnect Whoop
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
