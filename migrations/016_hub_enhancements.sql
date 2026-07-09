-- ============================================
-- 016_HUB_ENHANCEMENTS.SQL
-- Enhances user tracking for favorites and Twitch follows
-- ============================================

BEGIN;

-- 1. Add token storage to users for all roles (to support background discovery)
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitch_access_token_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitch_refresh_token_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitch_token_scope TEXT;

-- 2. Create user_favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(twitch_id) ON DELETE CASCADE,
    streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, streamer_id)
);

-- 3. Enable RLS
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites" ON user_favorites
    FOR ALL USING (user_id = auth.jwt() ->> 'sub');

-- 4. Indices
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_streamer ON user_favorites(streamer_id);

COMMIT;
