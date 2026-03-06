-- Training App Schema
-- Users get auto-created by Supabase Auth, we extend with profiles

-- User profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings (1RMs, preferences)
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bench_1rm INTEGER DEFAULT 245,
  squat_1rm INTEGER DEFAULT 325,
  pullup_1rm INTEGER DEFAULT 115,
  start_date DATE DEFAULT CURRENT_DATE,
  preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout history
CREATE TABLE public.workout_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'strength', 'tri', 'long', 'rest', 'recovery'
  week INTEGER,
  day TEXT,
  energy_level TEXT, -- 'ready', 'good', 'low', 'recovery'
  duration_min INTEGER,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Week swaps (calendar drag-and-drop)
CREATE TABLE public.week_swaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_key TEXT NOT NULL, -- e.g., '2026-W10'
  swaps JSONB DEFAULT '{}', -- {0: 3, 3: 0} meaning Sun↔Wed
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_key)
);

-- Shared plans (Phase 4)
CREATE TABLE public.shared_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  plan_data JSONB NOT NULL, -- full plan config
  share_code TEXT UNIQUE, -- short code for sharing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friendships (Phase 4)
CREATE TABLE public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_b UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a, user_b)
);

-- Indexes
CREATE INDEX idx_workout_history_user_date ON public.workout_history(user_id, date DESC);
CREATE INDEX idx_week_swaps_user ON public.week_swaps(user_id);
CREATE INDEX idx_shared_plans_code ON public.shared_plans(share_code);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Settings: users can read/update their own
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = id);

-- Workout history: users can CRUD their own
CREATE POLICY "Users can view own workouts" ON public.workout_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON public.workout_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON public.workout_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON public.workout_history FOR DELETE USING (auth.uid() = user_id);

-- Week swaps: users can CRUD their own
CREATE POLICY "Users can view own swaps" ON public.week_swaps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own swaps" ON public.week_swaps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own swaps" ON public.week_swaps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own swaps" ON public.week_swaps FOR DELETE USING (auth.uid() = user_id);

-- Shared plans: owner can CRUD, anyone with code can read
CREATE POLICY "Owners can manage own plans" ON public.shared_plans FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can view shared plans by code" ON public.shared_plans FOR SELECT USING (share_code IS NOT NULL);

-- Friendships: involved users can view
CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Users can create friendships" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_a);
CREATE POLICY "Users can update friendships they received" ON public.friendships FOR UPDATE USING (auth.uid() = user_b);

-- Auto-create profile + settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.user_settings (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
