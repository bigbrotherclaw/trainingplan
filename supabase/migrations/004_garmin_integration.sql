-- Garmin Connect tokens & session cookies (server-side only access via Edge Functions)
CREATE TABLE IF NOT EXISTS garmin_tokens (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  session_cookies JSONB DEFAULT '{}',
  oauth_tokens JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached Garmin data (avoid hitting API on every page load)
CREATE TABLE IF NOT EXISTS garmin_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL,
  date DATE NOT NULL,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, data_type, date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_garmin_data_user_type ON garmin_data(user_id, data_type);
CREATE INDEX IF NOT EXISTS idx_garmin_data_user_date ON garmin_data(user_id, date DESC);

-- RLS
ALTER TABLE garmin_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_data ENABLE ROW LEVEL SECURITY;

-- Tokens: users can read their own (to check if connected), Edge Functions use service_role to write
CREATE POLICY "Users can check own garmin connection" ON garmin_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Data: users can read their own cached data
CREATE POLICY "Users can read own garmin data" ON garmin_data
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (Edge Functions) can do everything - handled by default service_role bypass
