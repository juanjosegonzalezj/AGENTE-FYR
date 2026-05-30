-- ============================================================================
-- Find Your Rival – Row-Level Security Policies
-- Migration: 002_rls_policies.sql
-- ============================================================================

-- Enable RLS on every tenant-scoped table
ALTER TABLE sports_complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Helper function: returns the complex_id the calling user belongs to
CREATE OR REPLACE FUNCTION current_complex_id()
RETURNS UUID AS $$
  SELECT complex_id
  FROM tenant_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if calling user is a member of a given complex
CREATE OR REPLACE FUNCTION is_member_of(p_complex_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
      AND complex_id = p_complex_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── sports_complexes ──────────────────────────────────────────────────────────
CREATE POLICY "complex_select_own" ON sports_complexes
  FOR SELECT USING (is_member_of(id));

CREATE POLICY "complex_update_admin" ON sports_complexes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = auth.uid()
        AND complex_id = sports_complexes.id
        AND role IN ('owner','admin')
    )
  );

-- ── courts ────────────────────────────────────────────────────────────────────
CREATE POLICY "courts_select_member" ON courts
  FOR SELECT USING (is_member_of(complex_id));

CREATE POLICY "courts_insert_admin" ON courts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = auth.uid()
        AND complex_id = courts.complex_id
        AND role IN ('owner','admin')
    )
  );

CREATE POLICY "courts_update_admin" ON courts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = auth.uid()
        AND complex_id = courts.complex_id
        AND role IN ('owner','admin')
    )
  );

-- ── court_calendars ───────────────────────────────────────────────────────────
CREATE POLICY "calendars_select_member" ON court_calendars
  FOR SELECT USING (is_member_of(complex_id));

CREATE POLICY "calendars_manage_admin" ON court_calendars
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = auth.uid()
        AND complex_id = court_calendars.complex_id
        AND role IN ('owner','admin')
    )
  );

-- ── players ───────────────────────────────────────────────────────────────────
CREATE POLICY "players_select_member" ON players
  FOR SELECT USING (is_member_of(complex_id));

CREATE POLICY "players_insert_staff" ON players
  FOR INSERT WITH CHECK (is_member_of(complex_id));

CREATE POLICY "players_update_staff" ON players
  FOR UPDATE USING (is_member_of(complex_id));

-- ── customers ─────────────────────────────────────────────────────────────────
CREATE POLICY "customers_member" ON customers
  FOR ALL USING (is_member_of(complex_id));

-- ── reservations ──────────────────────────────────────────────────────────────
CREATE POLICY "reservations_select_member" ON reservations
  FOR SELECT USING (is_member_of(complex_id));

CREATE POLICY "reservations_insert_staff" ON reservations
  FOR INSERT WITH CHECK (is_member_of(complex_id));

CREATE POLICY "reservations_update_staff" ON reservations
  FOR UPDATE USING (is_member_of(complex_id));

-- ── availability ──────────────────────────────────────────────────────────────
CREATE POLICY "availability_select_member" ON availability
  FOR SELECT USING (is_member_of(complex_id));

CREATE POLICY "availability_manage_admin" ON availability
  FOR ALL USING (is_member_of(complex_id));

-- ── matches ───────────────────────────────────────────────────────────────────
CREATE POLICY "matches_member" ON matches
  FOR ALL USING (is_member_of(complex_id));

-- ── conversations ─────────────────────────────────────────────────────────────
CREATE POLICY "conversations_member" ON conversations
  FOR ALL USING (
    complex_id IS NULL OR is_member_of(complex_id)
  );

-- ── messages ──────────────────────────────────────────────────────────────────
CREATE POLICY "messages_member" ON messages
  FOR ALL USING (
    complex_id IS NULL OR is_member_of(complex_id)
  );

-- ── tenant_members ────────────────────────────────────────────────────────────
CREATE POLICY "members_select_own" ON tenant_members
  FOR SELECT USING (user_id = auth.uid() OR is_member_of(complex_id));

CREATE POLICY "members_manage_owner" ON tenant_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.complex_id = tenant_members.complex_id
        AND tm.role = 'owner'
    )
  );
