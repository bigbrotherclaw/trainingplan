-- Whoop OAuth tokens (server-side only access via Edge Functions)
CREATE TABLE IF NOT EXISTS whoop_tokens (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  whoop_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached Whoop data (avoid hitting API on every page load)
CREATE TABLE IF NOT EXISTS whoop_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('recovery', 'sleep', 'cycle', 'workout', 'body')),
  date DATE NOT NULL,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, data_type, date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_whoop_data_user_type ON whoop_data(user_id, data_type);
CREATE INDEX IF NOT EXISTS idx_whoop_data_user_date ON whoop_data(user_id, date DESC);

-- RLS
ALTER TABLE whoop_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoop_data ENABLE ROW LEVEL SECURITY;

-- Tokens: users can read their own (to check if connected), Edge Functions use service_role to write
CREATE POLICY "Users can check own whoop connection" ON whoop_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Data: users can read their own cached data
CREATE POLICY "Users can read own whoop data" ON whoop_data
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (Edge Functions) can do everything - handled by default service_role bypass
