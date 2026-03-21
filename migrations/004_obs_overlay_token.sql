-- ============================================
-- OBS OVERLAY TOKEN
-- Adds secure token for OBS overlay access
-- ============================================

BEGIN;

-- Add obs_overlay_token column to streamers table
ALTER TABLE streamers 
    ADD COLUMN IF NOT EXISTS obs_overlay_token TEXT;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_streamers_obs_token ON streamers(obs_overlay_token) WHERE obs_overlay_token IS NOT NULL;

-- Generate tokens for existing streamers (optional - can be done on-demand)
-- UPDATE streamers 
-- SET obs_overlay_token = encode(gen_random_bytes(32), 'hex')
-- WHERE obs_overlay_token IS NULL;

COMMIT;

