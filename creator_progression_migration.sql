-- Creator Progression Tier System
-- Run this in Supabase SQL editor

-- ── users: unified role field ────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'collector'
    CHECK (role IN ('collector', 'creator', 'affiliate', 'partner'));

-- Backfill: anyone with a streamer record becomes 'creator' (minimum creator role)
UPDATE users
  SET role = 'creator'
  WHERE role = 'collector'
    AND twitch_id IN (SELECT twitch_id FROM streamers);

-- ── streamers: tier tracking ─────────────────────────────────────────────────
ALTER TABLE streamers
  ADD COLUMN IF NOT EXISTS creator_tier TEXT DEFAULT 'base'
    CHECK (creator_tier IN ('base', 'affiliate', 'partner'));

ALTER TABLE streamers
  ADD COLUMN IF NOT EXISTS creator_tier_updated_at TIMESTAMPTZ;

ALTER TABLE streamers
  ADD COLUMN IF NOT EXISTS creator_affiliate_achieved_at TIMESTAMPTZ;

ALTER TABLE streamers
  ADD COLUMN IF NOT EXISTS creator_partner_achieved_at TIMESTAMPTZ;

-- Backfill existing streamers to 'base' tier
UPDATE streamers SET creator_tier = 'base' WHERE creator_tier IS NULL;
