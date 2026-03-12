-- ============================================
-- 028_seed_achievements.sql
-- Seeds the database with default achievements
-- ============================================

BEGIN;

INSERT INTO achievements (id, name, description, points, icon) VALUES
('first_card', 'Fresh Spawn', 'Linked your identity and got your first card', 10, '🥚'),
('collector_10', 'Novice Collector', 'Collected 10 unique cards', 50, '📦'),
('collector_50', 'Master Collector', 'Collected 50 unique cards', 200, '⭐'),
('rare_finder', 'Rare Find', 'Discovered a Rare card', 100, '💎'),
('epic_moment', 'Epic Moment', 'Discovered an Epic card', 250, '🔥'),
('legendary_luck', 'Legendary Luck', 'Discovered a Legendary card', 1000, '👑'),
('completionist', 'The Completionist', 'Collected every card in a set', 5000, '🏆'),
('set_collector', 'World Traveler', 'Collected cards from 2+ different sets', 200, '🗺️'),
('rarity_streak_3', 'Hot Streak', 'Last 3 cards pulled were Rare or higher', 500, '⚡'),
('trader_debut', 'Trader Debut', 'Completed your first trading transaction', 100, '🤝')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    points = EXCLUDED.points,
    icon = EXCLUDED.icon;

COMMIT;
