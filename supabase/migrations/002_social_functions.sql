-- Function to look up user ID by email (for friend requests)
-- SECURITY DEFINER so it can access auth.users
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input text)
RETURNS uuid AS $$
  SELECT id FROM auth.users WHERE email = email_input
$$ LANGUAGE sql SECURITY DEFINER;

-- Allow authenticated users to view friends' profiles (for leaderboard/social)
CREATE POLICY "Users can view friends profiles" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT user_b FROM public.friendships WHERE user_a = auth.uid() AND status = 'accepted'
      UNION
      SELECT user_a FROM public.friendships WHERE user_b = auth.uid() AND status = 'accepted'
    )
    OR auth.uid() = id
  );
