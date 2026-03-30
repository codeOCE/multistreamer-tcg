-- ============================================
-- 009_ENSURE_BINDER_TABLES.SQL
-- Creates user_binders and user_binder_cards if they are missing
-- ============================================

BEGIN;

-- 1. Create user_binders table
CREATE TABLE IF NOT EXISTS user_binders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create user_binder_cards join table
CREATE TABLE IF NOT EXISTS user_binder_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    binder_id UUID NOT NULL REFERENCES user_binders(id) ON DELETE CASCADE,
    user_card_id UUID NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(binder_id, user_card_id)
);

-- Index for foreign keys
CREATE INDEX IF NOT EXISTS idx_user_binders_user_id ON user_binders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_binder_cards_binder_id ON user_binder_cards(binder_id);
CREATE INDEX IF NOT EXISTS idx_user_binder_cards_user_card_id ON user_binder_cards(user_card_id);

COMMIT;
