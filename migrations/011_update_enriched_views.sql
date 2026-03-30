-- ============================================
-- 011_update_enriched_views.sql
-- Refreshes enriched_user_cards to include battle stats and mechanics
-- Run in Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- ENRICHED_USER_CARDS: User collection with full context, stats, and mechanics
-- ============================================
DROP VIEW IF EXISTS enriched_user_cards CASCADE;

CREATE VIEW enriched_user_cards AS
SELECT 
    uc.id as user_card_id,
    uc.twitch_id,
    uc.card_id,
    uc.streamer_id,
    uc.attack,
    uc.defense,
    uc.max_hp,
    uc.current_hp,
    uc.mechanic_id,
    uc.is_dead,
    uc.revive_used,
    uc.granted_by_streamer,
    uc.is_obs_consumed,
    uc.granted_at,
    uc.created_at,
    
    c.name,
    c.rarity,
    c.image_url,
    c.type,
    c.description,
    c.card_number,
    
    s.username as streamer_username,
    s.brand_name,
    s.brand_emoji,
    s.brand_color_primary,
    s.brand_color_secondary,
    s.pack_image_url,
    
    ss.name as set_name,
    ss.code as set_code,
    
    m.name as mechanic_name,
    m.display_name as mechanic_display_name,
    m.icon as mechanic_icon,
    m.description as mechanic_description
    
FROM user_cards uc
JOIN cards c ON uc.card_id = c.id
JOIN streamers s ON uc.streamer_id = s.id
LEFT JOIN streamer_sets ss ON c.set_id = ss.id
LEFT JOIN mechanics m ON uc.mechanic_id = m.id
WHERE s.is_active = true OR s.is_active IS NULL;

-- Grant permissions again
GRANT SELECT ON enriched_user_cards TO anon, authenticated, service_role;

COMMIT;
