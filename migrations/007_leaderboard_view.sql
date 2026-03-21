-- ============================================
-- 007_leaderboard_view.sql
-- Optimizes leaderboard calculation by using a database view
-- ============================================

BEGIN;

DROP VIEW IF EXISTS streamer_leaderboards CASCADE;

CREATE VIEW streamer_leaderboards AS
SELECT 
    uc.streamer_id,
    uc.twitch_id,
    u.username,
    u.avatar_url,
    count(*) as total_cards
FROM user_cards uc
JOIN users u ON uc.twitch_id = u.twitch_id
GROUP BY uc.streamer_id, uc.twitch_id, u.username, u.avatar_url;

-- Grant permissions
GRANT SELECT ON streamer_leaderboards TO anon, authenticated, service_role;

COMMIT;
