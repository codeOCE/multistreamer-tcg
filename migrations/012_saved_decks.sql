-- ============================================
-- 012_saved_decks.sql
-- Creates the user_saved_decks table for storing multiple decks per streamer
-- Run in Supabase SQL Editor
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS user_saved_decks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id     TEXT NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
    streamer_id   UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    slot_1_card_id UUID REFERENCES user_cards(id) ON DELETE SET NULL,
    slot_2_card_id UUID REFERENCES user_cards(id) ON DELETE SET NULL,
    slot_3_card_id UUID REFERENCES user_cards(id) ON DELETE SET NULL,
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(twitch_id, streamer_id, name) -- Prevent duplicate names per streamer context
);

CREATE INDEX IF NOT EXISTS idx_user_saved_decks_owner ON user_saved_decks(twitch_id, streamer_id);

GRANT ALL ON TABLE user_saved_decks TO postgres, service_role, anon, authenticated;
ALTER TABLE user_saved_decks DISABLE ROW LEVEL SECURITY;

COMMIT;
