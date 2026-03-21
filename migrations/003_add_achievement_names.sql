-- ============================================
-- 003_add_achievement_names.sql
-- Adds customizable achievement names for streamers
-- ============================================

BEGIN;

ALTER TABLE streamers ADD COLUMN IF NOT EXISTS achievement_names JSONB DEFAULT '{
    "beginner": "Beginner Collector",
    "hoarder": "Card Hoarder",
    "rare": "Rare Find",
    "epic": "Epic Moment",
    "legendary": "Legendary Luck",
    "completionist": "Completionist",
    "traveler": "World Traveler",
    "streak": "Hot Streak",
    "trader": "Trader Debut"
}'::jsonb;

COMMENT ON COLUMN streamers.achievement_names IS 'Custom names for all game achievements (beginner, hoarder, rare, epic, legendary, completionist, traveler, streak, trader)';

COMMIT;
