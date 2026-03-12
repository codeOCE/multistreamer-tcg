
-- ============================================
-- THE GREAT RESET: COMPLETE MULTI-STREAMER SETUP
-- This script resets your database and builds the NEW architecture.
-- Run this in your NEW Supabase SQL Editor.
-- ============================================

-- 1. NUKE EVERYTHING (Start fresh)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. CREATE TENANT TABLES
CREATE TABLE streamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    brand_name TEXT NOT NULL,
    brand_tagline TEXT,
    brand_emoji TEXT DEFAULT '🎴',
    brand_color_primary TEXT DEFAULT '#10b981',
    brand_color_secondary TEXT DEFAULT '#34d399',
    brand_font TEXT DEFAULT 'Outfit',
    pack_image_url TEXT DEFAULT '/pack.png',
    card_back_url TEXT,
    pack_open_sound_url TEXT DEFAULT '/packopensound.wav',
    twitch_client_id TEXT,
    twitch_client_secret_encrypted TEXT,
    twitch_reward_id TEXT,
    twitch_battle_reward_id TEXT,
    webhook_secret TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    streamelements_jwt_encrypted TEXT,
    streamelements_channel_id TEXT,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    requires_approval BOOLEAN DEFAULT false,
    allow_cross_streamer_battles BOOLEAN DEFAULT false,
    total_cards INTEGER DEFAULT 0,
    total_collectors INTEGER DEFAULT 0,
    total_packs_opened INTEGER DEFAULT 0,
    subscription_tier TEXT DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
    CONSTRAINT valid_username CHECK (username ~ '^[a-zA-Z0-9_]{3,25}$')
);

CREATE TABLE streamer_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    release_date DATE,
    end_date DATE,
    total_cards INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(streamer_id, code)
);

-- 3. CREATE CORE TABLES (Modernized Solo Tables)
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

-- NOTE: IDs in Solo were TEXT, we keep them TEXT for now to match data, 
-- but in a real multi-tenant we'd want UUID. 
-- However, we MUST match solo data for the clone to work.
CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE,
    set_id UUID REFERENCES streamer_sets(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    rarity TEXT NOT NULL,
    image_url TEXT NOT NULL,
    type TEXT DEFAULT 'Unit',
    card_number TEXT,
    description TEXT,
    attack INTEGER DEFAULT 0,
    defense INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT true,
    submitted_by TEXT,
    submission_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id TEXT REFERENCES users(twitch_id) ON DELETE CASCADE,
    card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
    streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE,
    granted_by_streamer UUID REFERENCES streamers(id),
    is_obs_consumed BOOLEAN DEFAULT false,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    points INTEGER DEFAULT 0,
    icon TEXT
);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id TEXT REFERENCES users(twitch_id) ON DELETE CASCADE,
    achievement_id TEXT REFERENCES achievements(id) ON DELETE CASCADE,
    streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(twitch_id, achievement_id)
);

CREATE TABLE battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE,
    challenger_id TEXT REFERENCES users(twitch_id),
    challenger_name TEXT,
    target_name TEXT,
    status TEXT DEFAULT 'pending',
    is_cross_streamer BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE,
    twitch_id TEXT REFERENCES users(twitch_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pending_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE,
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

-- 4. ADDITIONAL SYSTEM TABLES
CREATE TABLE platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'moderator',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES platform_admins(id),
    CONSTRAINT valid_role CHECK (role IN ('super_admin', 'admin', 'moderator')),
    CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE TABLE streamer_rarity_configs (
    streamer_id UUID PRIMARY KEY REFERENCES streamers(id) ON DELETE CASCADE,
    common_weight INTEGER DEFAULT 70,
    rare_weight INTEGER DEFAULT 20,
    epic_weight INTEGER DEFAULT 8,
    legendary_weight INTEGER DEFAULT 2,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_weights CHECK (common_weight >= 0 AND rare_weight >= 0 AND epic_weight >= 0 AND legendary_weight >= 0 AND (common_weight + rare_weight + epic_weight + legendary_weight) = 100)
);

CREATE TABLE platform_config (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES platform_admins(id)
);

CREATE TABLE streamer_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    cards_granted INTEGER DEFAULT 0,
    packs_opened INTEGER DEFAULT 0,
    unique_collectors INTEGER DEFAULT 0,
    new_collectors INTEGER DEFAULT 0,
    battles_initiated INTEGER DEFAULT 0,
    battles_completed INTEGER DEFAULT 0,
    trades_completed INTEGER DEFAULT 0,
    achievements_unlocked INTEGER DEFAULT 0,
    daily_active_users INTEGER DEFAULT 0,
    returning_users INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(streamer_id, date)
);

CREATE TABLE streamer_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    user_twitch_id TEXT NOT NULL,
    is_following BOOLEAN DEFAULT false,
    is_subscribed BOOLEAN DEFAULT false,
    subscription_tier INTEGER DEFAULT 0,
    total_cards_collected INTEGER DEFAULT 0,
    first_followed_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(streamer_id, user_twitch_id)
);

-- 5. VIEWS & FUNCTIONS
CREATE OR REPLACE VIEW enriched_cards AS
SELECT c.*, s.username as streamer_username, s.brand_name as streamer_brand_name, s.brand_emoji as streamer_emoji, s.brand_color_primary as streamer_color, ss.name as set_name, ss.code as set_code
FROM cards c
LEFT JOIN streamers s ON c.streamer_id = s.id
LEFT JOIN streamer_sets ss ON c.set_id = ss.id
WHERE c.is_approved = true;

-- 6. PERMISSIONS & RLS (Disable for clone)
ALTER TABLE streamers DISABLE ROW LEVEL SECURITY;
ALTER TABLE streamer_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE battles DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, anon, authenticated;

-- 7. INITIAL DATA (codeOCE Streamer)
INSERT INTO streamers (twitch_id, username, brand_name, brand_emoji, brand_color_primary, is_active, is_verified)
VALUES ('96085876', 'codeOCE', 'codeOCE TCG', '🎴', '#10b981', true, true);
