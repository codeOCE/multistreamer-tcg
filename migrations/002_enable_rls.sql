-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all multi-tenant tables
ALTER TABLE streamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE streamer_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_rewards ENABLE ROW LEVEL SECURITY;

-- Establish baseline policies (defense in depth for Anon access)
-- Note: The backend worker uses the service_role key, bridging auth internally, 
-- but these policies secure the tables against direct Anon key exploits.

-- Streamers: Public can read active streamers
CREATE POLICY "Public read active streamers" ON streamers 
    FOR SELECT USING (is_active = true);

-- Streamer Sets: Public can read active sets
CREATE POLICY "Public read active sets" ON streamer_sets 
    FOR SELECT USING (is_active = true);

-- Cards: Public can read approved cards
CREATE POLICY "Public read approved cards" ON cards 
    FOR SELECT USING (is_approved = true);

-- User Cards: Public can read all, allowing global binder
CREATE POLICY "Public read user cards" ON user_cards 
    FOR SELECT USING (true);

-- Battles: Public can read
CREATE POLICY "Public read battles" ON battles 
    FOR SELECT USING (true);

-- Notifications: Only service_role can access (Anon cannot)
-- Policy intentionally omitted to deny Anon access

-- User Achievements: Public can read
CREATE POLICY "Public read achievements" ON user_achievements 
    FOR SELECT USING (true);

-- Pending Rewards: Only service_role
-- Policy intentionally omitted to deny Anon access

-- To ensure service_role continues untouched, no further action is needed,
-- as service_role automatically bypasses RLS.
