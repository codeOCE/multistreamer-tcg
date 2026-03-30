-- ============================================
-- CREATE ENRICHED VIEWS
-- Creates the enriched_user_cards and enriched_cards views
-- ============================================

BEGIN;

-- ============================================
-- ENRICHED_CARDS: Cards with full streamer context
-- ============================================
DROP VIEW IF EXISTS enriched_cards CASCADE;
CREATE VIEW enriched_cards AS
SELECT 
    c.id,
    c.name,
    c.image_url,
    c.rarity,
    c.type,
    c.attack,
    c.defense,
    c.description,
    c.card_number,
    c.streamer_id,
    c.set_id,
    c.is_approved,
    c.created_at,
    
    s.username as streamer_username,
    s.brand_name as streamer_brand_name,
    s.brand_emoji as streamer_emoji,
    s.brand_color_primary as streamer_color,
    s.pack_image_url as streamer_pack_image,
    
    ss.name as set_name,
    ss.code as set_code,
    ss.icon_url as set_icon
    
FROM cards c
LEFT JOIN streamers s ON c.streamer_id = s.id
LEFT JOIN streamer_sets ss ON c.set_id = ss.id
WHERE c.is_approved = true AND (s.is_active = true OR s.is_active IS NULL);

-- ============================================
-- ENRICHED_USER_CARDS: User collection with full context
-- ============================================
DROP VIEW IF EXISTS enriched_user_cards CASCADE;
CREATE VIEW enriched_user_cards AS
SELECT 
    uc.id as user_card_id,
    uc.twitch_id,
    uc.card_id,
    uc.streamer_id,
    uc.granted_by_streamer,
    uc.is_obs_consumed,
    uc.granted_at,
    uc.created_at,
    
    c.name,
    c.rarity,
    c.image_url,
    c.attack,
    c.defense,
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
    ss.code as set_code
    
FROM user_cards uc
JOIN cards c ON uc.card_id = c.id
JOIN streamers s ON uc.streamer_id = s.id
LEFT JOIN streamer_sets ss ON c.set_id = ss.id
WHERE s.is_active = true;

-- Grant permissions on views
GRANT SELECT ON enriched_cards TO anon, authenticated, service_role;
GRANT SELECT ON enriched_user_cards TO anon, authenticated, service_role;

COMMIT;

