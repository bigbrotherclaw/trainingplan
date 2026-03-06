# Whoop Integration Plan

## Research Summary

### Whoop API (Official - developer.whoop.com)
- **OAuth 2.0** Authorization Code flow
- **Auth URL**: `https://api.prod.whoop.com/oauth/oauth2/auth`
- **Token URL**: `https://api.prod.whoop.com/oauth/oauth2/token`
- **Base URL**: `https://api.prod.whoop.com/developer`
- **Scopes**: read:recovery, read:cycles, read:workout, read:sleep, read:profile, read:body_measurement
- **Rate Limits**: Unknown exact numbers, standard OAuth patterns

### Available Data Endpoints
| Endpoint | Data |
|----------|------|
| GET /v1/recovery | Recovery score (0-100%), HRV (rmssd_milli), RHR, SpO2, skin temp |
| GET /v1/cycle | Day strain (0-21), avg HR, start/end times |
| GET /v1/sleep | Sleep score, sleep stages (wake/light/REM/SWS), duration, efficiency |
| GET /v1/workout | Activity strain, avg HR, max HR, sport ID, duration |
| GET /v1/user/body | Height, weight, max HR |
| GET /v1/user/profile | Name, email |

### Key Data Points for Visualization
- **Recovery**: 0-100% score, HRV (ms), RHR (bpm), SpO2 (%), skin temp (°C)
- **Strain**: 0-21 scale, avg HR, max HR
- **Sleep**: Performance %, stages (wake/light/REM/SWS durations), total duration
- **Trends**: All data available historically, can build 7/30/90-day views

## Architecture

### Server-Side Proxy (Required)
Whoop OAuth requires a **client_secret** which MUST be server-side only.
Options:
1. **Supabase Edge Function** — keeps everything in our existing stack
2. **Standalone Express proxy** on Mac mini — simpler for dev

**Decision: Supabase Edge Function** (production-ready, no extra server)

### OAuth Flow
1. User taps "Connect Whoop" in Settings
2. App opens browser to Supabase Edge Function `/whoop/auth`
3. Edge Function redirects to Whoop OAuth with client_id, scopes, state
4. User logs in to Whoop, authorizes
5. Whoop redirects back to Edge Function with auth code
6. Edge Function exchanges code for access_token + refresh_token
7. Edge Function stores tokens in Supabase `whoop_tokens` table (encrypted)
8. Edge Function redirects back to app with success
9. App fetches Whoop data via Edge Function proxy endpoints

### Database Schema
```sql
-- New table for Whoop tokens
CREATE TABLE whoop_tokens (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached Whoop data (avoid hitting API every page load)
CREATE TABLE whoop_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  data_type TEXT NOT NULL, -- 'recovery', 'sleep', 'cycle', 'workout'
  date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, data_type, date)
);

ALTER TABLE whoop_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoop_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own tokens" ON whoop_tokens
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access own data" ON whoop_data
  FOR ALL USING (auth.uid() = user_id);
```

### Edge Functions Needed
1. `whoop-auth` — Initiates OAuth, handles callback, stores tokens
2. `whoop-sync` — Fetches latest data from Whoop API, caches in DB
3. `whoop-data` — Returns cached data to frontend

## Setup Steps
1. Register app at developer.whoop.com → get client_id + client_secret
2. Set redirect URI to Edge Function URL
3. Create Edge Functions in Supabase
4. Add DB migration for whoop_tokens + whoop_data
5. Build Settings UI: "Connect Whoop" button
6. Build data fetching hook: useWhoop()
7. Build visualizations on Stats page

## Visualization Plan (See DESIGN-SPEC-V2.md)
