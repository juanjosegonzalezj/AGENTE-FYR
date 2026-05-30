-- ============================================================================
-- Find Your Rival – Performance Indexes
-- Migration: 003_indexes.sql
-- ============================================================================

-- courts
CREATE INDEX IF NOT EXISTS idx_courts_complex_sport
  ON courts(complex_id, sport) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_courts_calendar
  ON courts(google_calendar_id) WHERE google_calendar_id IS NOT NULL;

-- players
CREATE INDEX IF NOT EXISTS idx_players_complex_sport_skill
  ON players(complex_id, sport, skill_score) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_players_matchmaking
  ON players(complex_id, sport, skill_score)
  WHERE is_active = true AND is_looking_for_match = true;

CREATE INDEX IF NOT EXISTS idx_players_whatsapp
  ON players(whatsapp_id) WHERE whatsapp_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_players_phone
  ON players(phone) WHERE phone IS NOT NULL;

-- reservations
CREATE INDEX IF NOT EXISTS idx_reservations_court_time
  ON reservations(court_id, starts_at, ends_at) WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_reservations_complex_date
  ON reservations(complex_id, starts_at) WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_reservations_player
  ON reservations(player_id, starts_at) WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_reminders
  ON reservations(starts_at)
  WHERE status = 'confirmed' AND reminder_sent = false;

-- availability cache
CREATE INDEX IF NOT EXISTS idx_availability_court_date
  ON availability(court_id, date);

-- conversations
CREATE INDEX IF NOT EXISTS idx_conversations_channel_user
  ON conversations(channel, channel_user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON conversations(last_message_at DESC);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id, created_at);

-- tenant_members
CREATE INDEX IF NOT EXISTS idx_tenant_members_user
  ON tenant_members(user_id);

-- matches
CREATE INDEX IF NOT EXISTS idx_matches_players
  ON matches(player1_id, player2_id, played_at);
