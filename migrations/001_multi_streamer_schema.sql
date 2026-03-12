-- ============================================
-- 001_multi_streamer_schema.sql
-- Enables multi-tenant support for the TCG platform
-- ============================================

BEGIN;

-- 1. STREAMERS TABLE (The core tenant table)
CREATE TABLE IF NOT EXISTS streamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Twitch Identity
    twitch_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    
    -- Branding
    brand_name TEXT NOT NULL,
    brand_tagline TEXT,
    brand_emoji TEXT DEFAULT '🎴',
    brand_color_primary TEXT DEFAULT '#10b981',
    brand_color_secondary TEXT DEFAULT '#34d399',
    brand_font TEXT DEFAULT 'Outfit',
    
    -- Customization
    pack_image_url TEXT DEFAULT '/pack.png',
    card_back_url TEXT,
    pack_open_sound_url TEXT DEFAULT '/packopensound.wav',
    
    -- Integration (Encrypted in app layer)
    twitch_reward_id TEXT, -- For granting packs/cards
    twitch_battle_reward_id TEXT,
    webhook_secret TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    obs_overlay_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    
    -- Status
    is_active BOOLEAN DEFAULT false, -- Set to true during Phase 4 of onboarding
    is_verified BOOLEAN DEFAULT true, -- Auto-approved as requested
    
    -- Cached Stats
    total_cards INTEGER DEFAULT 0,
    total_collectors INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streamers_username ON streamers(username);
CREATE INDEX IF NOT EXISTS idx_streamers_twitch_id ON streamers(twitch_id);
CREATE INDEX IF NOT EXISTS idx_streamers_active ON streamers(is_active) WHERE is_active = true;

-- 2. UPDATE EXISTING TABLES
-- Add streamer_id column to track which stream data belongs to

-- CARDS
ALTER TABLE cards ADD COLUMN IF NOT EXISTS streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_cards_streamer ON cards(streamer_id);

-- USER_CARDS
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE;
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS granted_by_streamer UUID REFERENCES streamers(id);
CREATE INDEX IF NOT EXISTS idx_user_cards_streamer ON user_cards(streamer_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_twitch_streamer ON user_cards(twitch_id, streamer_id);

-- NOTIFICATIONS
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notifications_streamer ON notifications(streamer_id);

-- BATTLES
ALTER TABLE battles ADD COLUMN IF NOT EXISTS streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_battles_streamer ON battles(streamer_id);

-- PENDING_REWARDS
ALTER TABLE pending_rewards ADD COLUMN IF NOT EXISTS streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pending_rewards_streamer ON pending_rewards(streamer_id);

-- USER_ACHIEVEMENTS
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_user_achievements_streamer ON user_achievements(streamer_id);

COMMIT;
