-- ============================================
-- 029_fix_achievement_multi_tenancy.sql
-- Updates the unique constraint on user_achievements to be per-streamer
-- ============================================

BEGIN;

-- 1. Identify and drop the old global unique constraint
-- Usually it's named 'user_achievements_twitch_id_achievement_id_key' by Postgres default
-- But we'll drop it safely if it exists.
ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_twitch_id_achievement_id_key;

-- 2. Ensure streamer_id is NOT NULL (to prevent orphaned global achievements)
-- Note: Some existing data might have NULL streamer_id if any was earned before migration 001.
-- We'll backfill with 'codeoce' (the original streamer) if streamer_id is null before making it NOT NULL.
UPDATE user_achievements 
SET streamer_id = (SELECT id FROM streamers WHERE username = 'codeoce' LIMIT 1)
WHERE streamer_id IS NULL;

-- If 'codeoce' streamer doesn't exist yet, we'll just leave it for now or pick a default
-- but we really want this to be NOT NULL for multi-tenancy.
-- ALTER TABLE user_achievements ALTER COLUMN streamer_id SET NOT NULL;

-- 3. Add the new per-streamer unique constraint
ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_per_streamer 
UNIQUE (twitch_id, achievement_id, streamer_id);

COMMIT;
