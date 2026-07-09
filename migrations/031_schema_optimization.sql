-- Migration: 031_schema_optimization.sql
-- Description: Condenses database by merging redundant tables and removing unused ones.

BEGIN;

-- 1. DECK CONSOLIDATION
-- Add is_active flag to user_saved_decks to replace dedicated battle_decks table
ALTER TABLE user_saved_decks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Migrate active status from battle_decks to user_saved_decks
-- We create a "Current Deck" for any user who has an entry in battle_decks but not in saved_decks
INSERT INTO user_saved_decks (twitch_id, streamer_id, name, slot_1_card_id, slot_2_card_id, slot_3_card_id, is_active)
SELECT twitch_id, streamer_id, 'Current Deck', slot_1_card_id, slot_2_card_id, slot_3_card_id, true
FROM battle_decks
ON CONFLICT (twitch_id, streamer_id, name) DO UPDATE SET is_active = true;

-- Ensure only one active deck per user per streamer context
-- Using a partial unique index for "one active per scope" enforcement
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_decks_active_only_one 
ON user_saved_decks (twitch_id, streamer_id) 
WHERE (is_active = true);

-- Drop the now redundant table
DROP TABLE IF EXISTS battle_decks CASCADE;


-- 2. ADMIN CONSOLIDATION
-- Add role to users table to support administrative roles directly
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Set 'admin' role for known administrators if identifiable, otherwise let platform owners manage via SQL/Auth
-- Example: UPDATE users SET role = 'admin' WHERE username = 'codeoce';


-- 3. REMOVE REDUNDANT/UNUSED TABLES
-- system_logs can be monitored via Supabase native logging or external tools
DROP TABLE IF EXISTS system_logs CASCADE;

-- platform_admins is redundant with the new role column in users
DROP TABLE IF EXISTS platform_admins CASCADE;

COMMIT;
