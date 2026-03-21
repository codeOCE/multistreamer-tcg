-- Migration: 026_remove_deprecated_streamer_fields.sql
-- Description: Removes unused branding and identity fields from the streamers table

BEGIN;

-- Drop deprecated columns
ALTER TABLE streamers DROP COLUMN IF EXISTS email;
ALTER TABLE streamers DROP COLUMN IF EXISTS brand_emoji;
ALTER TABLE streamers DROP COLUMN IF EXISTS brand_color_primary;
ALTER TABLE streamers DROP COLUMN IF EXISTS brand_color_secondary;
ALTER TABLE streamers DROP COLUMN IF EXISTS brand_font;
ALTER TABLE streamers DROP COLUMN IF EXISTS allow_cross_streamer_battles;

COMMIT;
