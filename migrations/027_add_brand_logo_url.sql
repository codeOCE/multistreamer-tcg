-- Add brand_logo_url to streamers (optional; app falls back to avatar_url if missing)
ALTER TABLE streamers ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;
