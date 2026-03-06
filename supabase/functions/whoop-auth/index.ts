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
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (!code || !state) {
        return new Response('Missing code or state', { status: 400 })
      }

      // Decode state to get user token
      let userToken: string
      try {
        const stateData = JSON.parse(atob(state))
        userToken = stateData.token
      } catch {
        return new Response('Invalid state', { status: 400 })
      }

      // Exchange code for tokens
      const redirectUri = `${SUPABASE_URL}/functions/v1/whoop-auth/callback`
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
        console.error('Token exchange failed:', err)
        return Response.redirect(`${APP_URL}?whoop=error`, 302)
      }

      const tokens = await tokenResp.json()

      // Get user ID from Supabase token
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken)

      if (userError || !user) {
        console.error('Failed to get user:', userError)
        return Response.redirect(`${APP_URL}?whoop=error`, 302)
      }

      // Store tokens
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      const { error: upsertError } = await supabase
        .from('whoop_tokens')
        .upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scopes: SCOPES.split(' '),
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error('Failed to store tokens:', upsertError)
        return Response.redirect(`${APP_URL}?whoop=error`, 302)
      }

      // Redirect back to app with success
      return Response.redirect(`${APP_URL}?whoop=connected`, 302)
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
