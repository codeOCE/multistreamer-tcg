
-- ============================================
-- AGGRESSIVE PERMISSION & OWNERSHIP FIX
-- Run this in your NEW Supabase SQL Editor
-- ============================================

-- 1. Grant everything on the schema itself
GRANT ALL ON SCHEMA public TO postgres, service_role, anon, authenticated;
ALTER SCHEMA public OWNER TO postgres;

-- 2. Re-grant everything on all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO postgres';
        EXECUTE 'GRANT ALL ON TABLE public.' || quote_ident(r.tablename) || ' TO postgres, service_role, anon, authenticated';
    END LOOP;
END $$;

-- 3. Re-grant everything on all sequences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'S') LOOP
        EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.relname) || ' OWNER TO postgres';
        EXECUTE 'GRANT ALL ON SEQUENCE public.' || quote_ident(r.relname) || ' TO postgres, service_role, anon, authenticated';
    END LOOP;
END $$;

-- 4. Final safety check
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role, anon, authenticated;

-- 5. Disable RLS for the clone
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
