ALTER TABLE whoop_tokens ADD COLUMN IF NOT EXISTS whoop_user_id text DEFAULT NULL;
ALTER TABLE garmin_tokens ADD COLUMN IF NOT EXISTS last_synced_activity_id text DEFAULT NULL;

-- Enable realtime on whoop_data and garmin_data
ALTER PUBLICATION supabase_realtime ADD TABLE whoop_data;
ALTER PUBLICATION supabase_realtime ADD TABLE garmin_data;
