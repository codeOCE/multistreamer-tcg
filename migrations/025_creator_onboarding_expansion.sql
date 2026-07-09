-- Migration: 025_creator_onboarding_expansion.sql
-- Description: Adds configuration fields for expanded creator onboarding

ALTER TABLE streamers ADD COLUMN IF NOT EXISTS tos_accepted BOOLEAN DEFAULT false;
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS binder_color TEXT DEFAULT '#00ffcc';
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS battles_enabled BOOLEAN DEFAULT true;
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS trading_enabled BOOLEAN DEFAULT true;
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS collection_methods JSONB DEFAULT '{"subs": true, "bits": true, "website": true, "channel_points": true}';
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1;
