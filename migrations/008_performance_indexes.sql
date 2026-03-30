-- ============================================
-- 008_PERFORMANCE_INDEXES.SQL
-- Optimizes collection sorting, leaderboards, and achievement queries
-- ============================================

BEGIN;

-- 1. Index for Collection Sorting & Filtering
-- Crucial for `enriched_user_cards` view and collection tab
CREATE INDEX IF NOT EXISTS idx_user_cards_twitch_streamer_created 
ON user_cards (twitch_id, streamer_id, created_at DESC);

-- 2. Index for Binder List & Navigation
CREATE INDEX IF NOT EXISTS idx_user_binders_user_sort 
ON user_binders (user_id, sort_order ASC);

-- 2b. Index for Binder Cards
CREATE INDEX IF NOT EXISTS idx_user_binder_cards_binder 
ON user_binder_cards (binder_id, sort_order ASC);

-- 3. Index for Achievement Checks
CREATE INDEX IF NOT EXISTS idx_user_achievements_twitch 
ON user_achievements (twitch_id);

-- 4. Index for Card Sets lookup (used in views)
CREATE INDEX IF NOT EXISTS idx_streamer_sets_streamer 
ON streamer_sets (streamer_id);

-- 5. Index for Cards by Streamer (Main collection pools)
CREATE INDEX IF NOT EXISTS idx_cards_streamer_created 
ON cards (streamer_id, created_at DESC);

-- Analyze tables to update statistics
ANALYZE user_cards;
ANALYZE user_binders;
ANALYZE user_binder_cards;
ANALYZE user_achievements;
ANALYZE cards;

COMMIT;
