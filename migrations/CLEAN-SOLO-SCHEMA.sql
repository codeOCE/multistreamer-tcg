
-- ============================================
-- CLEAN SLATE V3: PERFECT SOLO MATCH
-- Run this in your NEW Supabase SQL Editor
-- ============================================

-- 1. Drop EVERYTHING
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Base Solo Tables (Perfect Columns)
CREATE TABLE users (
    twitch_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_url TEXT,
    trade_code TEXT UNIQUE,
    is_linked BOOLEAN DEFAULT false,
    binder_layout JSONB DEFAULT '{"columns": 3}'::jsonb,
    binder_theme TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    icon_url TEXT,
    release_date TIMESTAMPTZ,
    card_back_url TEXT,
    description TEXT,
    total_cards INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rarity TEXT NOT NULL,
    image_url TEXT NOT NULL,
    type TEXT DEFAULT 'Unit',
    card_number TEXT,
    description TEXT,
    attack INTEGER DEFAULT 0,
    defense INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id TEXT REFERENCES users(twitch_id) ON DELETE CASCADE,
    card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
    is_obs_consumed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    points INTEGER DEFAULT 0,
    icon TEXT -- MATCH SOLO NAME
);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id TEXT REFERENCES users(twitch_id) ON DELETE CASCADE,
    achievement_id TEXT REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(twitch_id, achievement_id)
);

CREATE TABLE battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id TEXT REFERENCES users(twitch_id),
    challenger_name TEXT,
    target_name TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id TEXT REFERENCES users(twitch_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pending_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id TEXT REFERENCES users(twitch_id) ON DELETE CASCADE,
    card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
