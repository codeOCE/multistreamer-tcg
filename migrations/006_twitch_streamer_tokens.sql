BEGIN;

ALTER TABLE streamers
    ADD COLUMN IF NOT EXISTS twitch_access_token_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS twitch_refresh_token_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS twitch_token_scope TEXT;

COMMIT;


