-- ============================================
-- CARD BACKS SYSTEM
-- Adds support for multiple card backs per streamer
-- ============================================

BEGIN;

-- Create streamer_card_backs table for multiple card backs
CREATE TABLE IF NOT EXISTS streamer_card_backs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    
    -- Card Back Info
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT,
    
    -- Settings
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_name CHECK (LENGTH(name) > 0 AND LENGTH(name) <= 100)
);

-- Add card_back_id to streamer_sets for set-specific card backs
ALTER TABLE streamer_sets 
    ADD COLUMN IF NOT EXISTS card_back_id UUID REFERENCES streamer_card_backs(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_streamer_card_backs_streamer ON streamer_card_backs(streamer_id);
CREATE INDEX IF NOT EXISTS idx_streamer_card_backs_default ON streamer_card_backs(streamer_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_streamer_card_backs_active ON streamer_card_backs(streamer_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_streamer_sets_card_back ON streamer_sets(card_back_id);

-- Function to ensure only one default card back per streamer
CREATE OR REPLACE FUNCTION ensure_single_default_card_back()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Unset all other default card backs for this streamer
        UPDATE streamer_card_backs
        SET is_default = false
        WHERE streamer_id = NEW.streamer_id
        AND id != NEW.id
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single default
CREATE TRIGGER trigger_ensure_single_default_card_back
    BEFORE INSERT OR UPDATE ON streamer_card_backs
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_card_back();

-- Migrate existing card_back_url to streamer_card_backs if it exists
DO $$
DECLARE
    streamer_record RECORD;
    card_back_id UUID;
BEGIN
    FOR streamer_record IN 
        SELECT id, card_back_url 
        FROM streamers 
        WHERE card_back_url IS NOT NULL 
        AND card_back_url != ''
    LOOP
        -- Create a card back entry from existing card_back_url
        INSERT INTO streamer_card_backs (streamer_id, name, image_url, is_default, is_active)
        VALUES (
            streamer_record.id,
            'Default Card Back',
            streamer_record.card_back_url,
            true,
            true
        )
        RETURNING id INTO card_back_id;
        
        -- Update sets that might reference this (if we had set-specific backs)
        -- This is a placeholder for future migration if needed
    END LOOP;
END $$;

COMMIT;

