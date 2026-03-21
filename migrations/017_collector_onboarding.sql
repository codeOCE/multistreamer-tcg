-- Migration: 017_collector_onboarding.sql
-- Description: Adds onboarding tracking for collectors/viewers

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_collector_step INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_onboarding_complete BOOLEAN DEFAULT false;
