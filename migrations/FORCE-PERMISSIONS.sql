
-- ============================================
-- FORCE PERMISSIONS FOR SERVICE_ROLE
-- Run this in your NEW Supabase SQL Editor
-- ============================================

-- Grant everything to service_role and postgres
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role, postgres;

-- Ensure ownership is correct
ALTER TABLE users OWNER TO postgres;
ALTER TABLE sets OWNER TO postgres;
ALTER TABLE cards OWNER TO postgres;
ALTER TABLE user_cards OWNER TO postgres;
ALTER TABLE achievements OWNER TO postgres;
ALTER TABLE user_achievements OWNER TO postgres;
ALTER TABLE battles OWNER TO postgres;
ALTER TABLE notifications OWNER TO postgres;
ALTER TABLE pending_rewards OWNER TO postgres;
ALTER TABLE system_logs OWNER TO postgres;

-- Disable RLS everywhere just to be 100% sure for the clone
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE battles DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY;
