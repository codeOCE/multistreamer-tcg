-- Migration: 033_card_eligibility_toggles.sql
-- Description: Adds granular control for Battle and Trading eligibility to individual cards

ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_battle_eligible BOOLEAN DEFAULT true;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_trading_eligible BOOLEAN DEFAULT true;

-- Update existing cards to be eligible by default
UPDATE cards SET is_battle_eligible = true, is_trading_eligible = true;
