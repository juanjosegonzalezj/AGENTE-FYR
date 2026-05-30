-- ============================================================================
-- Find Your Rival – Database Functions & Stored Procedures
-- Migration: 004_functions.sql
-- ============================================================================

-- ── Analytics: Occupancy Rate ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_occupancy_rate(
  p_complex_id UUID,
  p_date_from  DATE,
  p_date_to    DATE
)
RETURNS TABLE(
  court_id       UUID,
  court_name     TEXT,
  sport          TEXT,
  total_slots    INT,
  booked_slots   INT,
  occupancy_pct  NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id                                        AS court_id,
    c.name                                      AS court_name,
    c.sport,
    -- Assume 12 operating hours / day × days in range
    (EXTRACT(DAY FROM (p_date_to::TIMESTAMPTZ - p_date_from::TIMESTAMPTZ)) + 1)::INT * 12
                                               AS total_slots,
    COUNT(r.id)::INT                           AS booked_slots,
    ROUND(
      COUNT(r.id)::NUMERIC /
      NULLIF(
        ((EXTRACT(DAY FROM (p_date_to::TIMESTAMPTZ - p_date_from::TIMESTAMPTZ)) + 1) * 12),
        0
      ) * 100, 2
    )                                          AS occupancy_pct
  FROM courts c
  LEFT JOIN reservations r
    ON r.court_id = c.id
    AND r.status = 'confirmed'
    AND r.starts_at::DATE BETWEEN p_date_from AND p_date_to
  WHERE c.complex_id = p_complex_id
    AND c.is_active = true
  GROUP BY c.id, c.name, c.sport
  ORDER BY occupancy_pct DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Analytics: Revenue Summary ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_revenue_summary(
  p_complex_id UUID,
  p_date_from  DATE,
  p_date_to    DATE
)
RETURNS TABLE(
  period        TEXT,
  total_revenue NUMERIC,
  total_bookings BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(r.starts_at, 'YYYY-MM-DD')  AS period,
    COALESCE(SUM(r.total_price), 0)      AS total_revenue,
    COUNT(r.id)                          AS total_bookings
  FROM reservations r
  WHERE r.complex_id = p_complex_id
    AND r.status = 'confirmed'
    AND r.starts_at::DATE BETWEEN p_date_from AND p_date_to
  GROUP BY TO_CHAR(r.starts_at, 'YYYY-MM-DD')
  ORDER BY period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Matchmaking Score Function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_match_score(
  p_requester_skill  INT,
  p_candidate_skill  INT,
  p_requester_wins   INT,
  p_candidate_wins   INT
)
RETURNS NUMERIC AS $$
DECLARE
  skill_diff   NUMERIC;
  skill_score  NUMERIC;
  win_balance  NUMERIC;
  final_score  NUMERIC;
BEGIN
  -- Skill proximity (0-60 pts): closer skill = higher score
  skill_diff  := ABS(p_requester_skill - p_candidate_skill);
  skill_score := GREATEST(0, 60 - (skill_diff / 10.0));

  -- Win balance (0-40 pts): similar win rates preferred
  win_balance := 40 - LEAST(40, ABS(p_requester_wins - p_candidate_wins) * 2);

  final_score := skill_score + win_balance;
  RETURN ROUND(final_score, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Check Double-Booking ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_court_available(
  p_court_id  UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at   TIMESTAMPTZ,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM reservations
    WHERE court_id = p_court_id
      AND status != 'cancelled'
      AND (p_exclude_id IS NULL OR id != p_exclude_id)
      AND starts_at < p_ends_at
      AND ends_at   > p_starts_at
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
