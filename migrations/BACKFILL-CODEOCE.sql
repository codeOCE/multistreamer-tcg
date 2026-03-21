
-- ============================================
-- BACKFILL CODEOCE DATA
-- Run this AFTER the Multi-Streamer Migration SQL
-- ============================================

DO $$
DECLARE
    v_streamer_id UUID;
    v_codeoce_twitch_id TEXT := '96085876';
BEGIN
    -- 1. Create the Streamer record if it doesn't exist
    INSERT INTO streamers (
        twitch_id, 
        username, 
        brand_name, 
        brand_emoji, 
        brand_color_primary,
        is_active,
        is_verified
    ) 
    VALUES (
        v_codeoce_twitch_id, 
        'codeOCE', 
        'codeOCE TCG', 
        '🎴', 
        '#10b981',
        true,
        true
    )
    ON CONFLICT (twitch_id) DO UPDATE SET is_active = true
    RETURNING id INTO v_streamer_id;

    -- 2. Link all existing Cards
    UPDATE cards SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;

    -- 3. Link all existing User Cards
    UPDATE user_cards SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;

    -- 4. Link everything else
    UPDATE battles SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;
    UPDATE notifications SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;
    UPDATE pending_rewards SET streamer_id = v_streamer_id WHERE streamer_id IS NULL;

    -- 5. Create a default set
    INSERT INTO streamer_sets (streamer_id, name, code, is_active)
    VALUES (v_streamer_id, 'Base Set', 'BASE', true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Backfill complete for streamer ID: %', v_streamer_id;
END $$;
