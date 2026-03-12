-- ============================================
-- 010_battle_system.sql
-- Adds the 4-mechanic battle system tables and columns
-- Run in Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- 1. MECHANICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,           -- guard, vampire, reanimate, mimic
    display_name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '⚙️',     -- emoji icon for UI / arena overlay
    rarity_weight INTEGER DEFAULT 32,    -- Mimic=3, others split 97
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. SEED THE 4 CORE MECHANICS
-- ============================================
INSERT INTO mechanics (name, display_name, description, icon, rarity_weight) VALUES
    ('guard',     'Guard',     'Must be attacked first (Taunt)',                     '🛡️',  32),
    ('vampire',   'Vampire',   'Heals 30% of killed card''s Max HP on killing blow', '🩸',  32),
    ('reanimate', 'Reanimate', 'Revives with 1 HP once per battle (Reborn)',         '♻️',  33),
    ('mimic',     'Mimic',     'Gains ATK/DEF from Slot 1, Mechanic from Slot 3',   '🪄',   3)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. ENHANCE user_cards WITH BATTLE STATS
-- These are set at card-grant time, sourced from the cards table base stats
-- ============================================
ALTER TABLE user_cards
    ADD COLUMN IF NOT EXISTS attack             INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS defense            INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_hp         INTEGER,          -- populated at battle start
    ADD COLUMN IF NOT EXISTS max_hp             INTEGER,          -- snapshot of defense at grant time (used for Vampire calc)
    ADD COLUMN IF NOT EXISTS mechanic_id        UUID REFERENCES mechanics(id),
    ADD COLUMN IF NOT EXISTS genesis_mechanic_id UUID REFERENCES mechanics(id), -- locked Epic/Legendary mechanic
    ADD COLUMN IF NOT EXISTS is_dead            BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS revive_used        BOOLEAN DEFAULT false; -- tracks Reanimate usage

CREATE INDEX IF NOT EXISTS idx_user_cards_mechanic ON user_cards(mechanic_id);

-- ============================================
-- 4. BATTLE_DECKS TABLE
-- Each user has one active deck per streamer (3 card slots)
-- ============================================
CREATE TABLE IF NOT EXISTS battle_decks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id     TEXT NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
    streamer_id   UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    slot_1_card_id UUID REFERENCES user_cards(id) ON DELETE SET NULL,
    slot_2_card_id UUID REFERENCES user_cards(id) ON DELETE SET NULL,
    slot_3_card_id UUID REFERENCES user_cards(id) ON DELETE SET NULL,
    is_active      BOOLEAN DEFAULT true,
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(twitch_id, streamer_id)    -- one deck per user per streamer
);

CREATE INDEX IF NOT EXISTS idx_battle_decks_user    ON battle_decks(twitch_id);
CREATE INDEX IF NOT EXISTS idx_battle_decks_streamer ON battle_decks(streamer_id);

-- ============================================
-- 5. ENHANCE battles TABLE
-- Add battle_data JSONB (consumed by arena.js) and result columns
-- ============================================
ALTER TABLE battles
    ADD COLUMN IF NOT EXISTS target_id          TEXT REFERENCES users(twitch_id),
    ADD COLUMN IF NOT EXISTS winner_id          TEXT,              -- twitch_id of winner, NULL = draw
    ADD COLUMN IF NOT EXISTS challenger_wins    INTEGER DEFAULT 0, -- rounds won by challenger
    ADD COLUMN IF NOT EXISTS target_wins        INTEGER DEFAULT 0, -- rounds won by target
    ADD COLUMN IF NOT EXISTS battle_data        JSONB,             -- full replay data for arena.js
    ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ;

-- Index for the arena polling query (latest completed battle per streamer)
CREATE INDEX IF NOT EXISTS idx_battles_streamer_completed
    ON battles(streamer_id, completed_at DESC)
    WHERE completed_at IS NOT NULL;

-- ============================================
-- 6. PERMISSIONS (match existing setup)
-- ============================================
GRANT ALL ON TABLE mechanics     TO postgres, service_role, anon, authenticated;
GRANT ALL ON TABLE battle_decks  TO postgres, service_role, anon, authenticated;
ALTER TABLE mechanics    DISABLE ROW LEVEL SECURITY;
ALTER TABLE battle_decks DISABLE ROW LEVEL SECURITY;

COMMIT;
