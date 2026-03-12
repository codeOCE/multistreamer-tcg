-- Migration: 032_add_pack_animation_style.sql
-- Description: Adds pack_animation_style column to streamers table

ALTER TABLE streamers ADD COLUMN IF NOT EXISTS pack_animation_style TEXT DEFAULT 'style1';
