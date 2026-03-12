-- Migration: 034_streamer_events.sql
-- Description: Adds a table to store per-streamer special events like rarity boosts

CREATE TABLE IF NOT EXISTS streamer_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'rarity_boost'
    name TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb, -- e.g., { "common": 60, "rare": 25, "epic": 12, "legendary": 3 }
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup of active events
CREATE INDEX IF NOT EXISTS idx_streamer_events_active ON streamer_events (streamer_id, starts_at, ends_at) WHERE is_active = true;
