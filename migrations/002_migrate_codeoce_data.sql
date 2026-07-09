-- ============================================
-- 002_migrate_codeoce_data.sql
-- Backfills codeOCE's existing data as the first streamer
-- ============================================

BEGIN;

-- 1. Create codeOCE streamer record
-- We use a fixed ID for consistency in this environment if possible, 
-- or simply grab the returned ID.
INSERT INTO streamers (
    twitch_id, 
    username, 
    display_name, 
    brand_name, 
    brand_tagline, 
    is_active, 
    is_verified
) VALUES (
    '96085876', 
    'codeoce', 
    'codeOCE', 
    'Nexus Repository', 
    'Into the Matrix...', 
    true, 
    true
) ON CONFLICT (twitch_id) DO UPDATE SET 
    brand_name = EXCLUDED.brand_name;

-- 2. Backfill existing data with codeOCE's ID
DO $$
DECLARE
    v_streamer_id UUID;
BEGIN
    SELECT id INTO v_streamer_id FROM streamers WHERE twitch_id = '96085876';

    -- Backfill cards
    UPDATE cards SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;

    -- Backfill user_cards
    UPDATE user_cards SET 
        streamer_id = v_streamer_id,
        granted_by_streamer = v_streamer_id 
    WHERE streamer_id IS NULL;

    -- Backfill notifications
    UPDATE notifications SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;

    -- Backfill battles
    UPDATE battles SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;
    
    -- Backfill pending rewards
    UPDATE pending_rewards SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;

    -- Backfill user_achievements
    UPDATE user_achievements SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;
END $$;

COMMIT;
