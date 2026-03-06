-- Whoop API v2 does not always return a refresh_token
ALTER TABLE whoop_tokens ALTER COLUMN refresh_token DROP NOT NULL;
