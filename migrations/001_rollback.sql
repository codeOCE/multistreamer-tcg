-- ============================================
-- 001_rollback.sql
-- Removes multi-tenant support (Use with caution!)
-- ============================================

BEGIN;

-- Remove columns from existing tables
ALTER TABLE pending_rewards DROP COLUMN IF EXISTS streamer_id;
ALTER TABLE user_achievements DROP COLUMN IF EXISTS streamer_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS streamer_id;
ALTER TABLE battles DROP COLUMN IF EXISTS streamer_id;
ALTER TABLE user_cards DROP COLUMN IF EXISTS granted_at;
ALTER TABLE user_cards DROP COLUMN IF EXISTS granted_by_streamer;
ALTER TABLE user_cards DROP COLUMN IF EXISTS streamer_id;
ALTER TABLE cards DROP COLUMN IF EXISTS streamer_id;

-- Drop new tables
DROP TABLE IF EXISTS streamer_analytics;
DROP TABLE IF EXISTS streamer_followers;
DROP TABLE IF EXISTS streamer_sets;
DROP TABLE IF EXISTS streamers;

COMMIT;
