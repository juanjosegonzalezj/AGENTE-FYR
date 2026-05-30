-- ============================================================================
-- Find Your Rival – Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Sports Complexes (Tenants) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sports_complexes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  city            TEXT,
  country         TEXT NOT NULL DEFAULT 'ES',
  timezone        TEXT NOT NULL DEFAULT 'Europe/Madrid',
  plan            TEXT NOT NULL DEFAULT 'starter'
                  CHECK (plan IN ('starter', 'professional', 'enterprise')),
  plan_status     TEXT NOT NULL DEFAULT 'trial'
                  CHECK (plan_status IN ('trial', 'active', 'past_due', 'cancelled')),
  whatsapp_number TEXT UNIQUE,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sports Reference Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sports (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL UNIQUE,
  display_name             TEXT NOT NULL,
  min_players              INT NOT NULL DEFAULT 2,
  max_players              INT NOT NULL DEFAULT 4,
  default_duration_minutes INT NOT NULL DEFAULT 60,
  icon                     TEXT
);

INSERT INTO sports (name, display_name, min_players, max_players, default_duration_minutes, icon)
VALUES
  ('padel',      'Pádel',       2, 4, 90, '🎾'),
  ('tennis',     'Tenis',       2, 4, 60, '🎾'),
  ('soccer',     'Fútbol',      4, 22, 90, '⚽'),
  ('basketball', 'Baloncesto',  4, 10, 60, '🏀'),
  ('volleyball', 'Voleibol',    6, 12, 60, '🏐')
ON CONFLICT (name) DO NOTHING;

-- ── Courts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id         UUID NOT NULL REFERENCES sports_complexes(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  sport              TEXT NOT NULL,
  surface            TEXT,
  indoor             BOOLEAN NOT NULL DEFAULT false,
  capacity           SMALLINT NOT NULL DEFAULT 2,
  hourly_rate        DECIMAL(10,2),
  currency           TEXT NOT NULL DEFAULT 'EUR',
  google_calendar_id TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  amenities          JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Court Calendars (Google Calendar Integration) ─────────────────────────────
CREATE TABLE IF NOT EXISTS court_calendars (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id           UUID NOT NULL REFERENCES sports_complexes(id) ON DELETE CASCADE,
  court_id             UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  google_calendar_id   TEXT NOT NULL,
  google_account_email TEXT NOT NULL,
  access_token         TEXT,
  refresh_token        TEXT,
  token_expires_at     TIMESTAMPTZ,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(court_id)
);

-- ── Players ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id            UUID NOT NULL REFERENCES sports_complexes(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  whatsapp_id           TEXT UNIQUE,
  sport                 TEXT NOT NULL,
  skill_level           TEXT NOT NULL DEFAULT 'intermediate'
                        CHECK (skill_level IN ('beginner','intermediate','advanced','professional')),
  skill_score           INT NOT NULL DEFAULT 500
                        CHECK (skill_score BETWEEN 0 AND 1000),
  age                   SMALLINT,
  gender                TEXT CHECK (gender IN ('male','female','non_binary','any')),
  preferred_times       JSONB NOT NULL DEFAULT '[]',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  is_looking_for_match  BOOLEAN NOT NULL DEFAULT false,
  stats                 JSONB NOT NULL DEFAULT '{"wins":0,"losses":0,"matches":0}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Customers (walk-ins / non-registered) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id  UUID NOT NULL REFERENCES sports_complexes(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reservations ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id       UUID NOT NULL REFERENCES sports_complexes(id) ON DELETE CASCADE,
  court_id         UUID NOT NULL REFERENCES courts(id),
  player_id        UUID REFERENCES players(id) ON DELETE SET NULL,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  google_event_id  TEXT,
  title            TEXT,
  sport            TEXT NOT NULL,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  status           TEXT NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('pending','confirmed','cancelled','no_show')),
  player_count     SMALLINT NOT NULL DEFAULT 2,
  total_price      DECIMAL(10,2),
  currency         TEXT NOT NULL DEFAULT 'EUR',
  notes            TEXT,
  cancelled_at     TIMESTAMPTZ,
  reminder_sent    BOOLEAN NOT NULL DEFAULT false,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent double-booking at the DB level
  CONSTRAINT valid_time_range CHECK (ends_at > starts_at)
);

-- ── Availability Cache ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id     UUID NOT NULL REFERENCES sports_complexes(id) ON DELETE CASCADE,
  court_id       UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  slots          JSONB NOT NULL DEFAULT '[]',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(court_id, date)
);

-- ── Matches ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id     UUID NOT NULL REFERENCES sports_complexes(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  sport          TEXT NOT NULL,
  player1_id     UUID REFERENCES players(id) ON DELETE SET NULL,
  player2_id     UUID REFERENCES players(id) ON DELETE SET NULL,
  winner_id      UUID REFERENCES players(id) ON DELETE SET NULL,
  score          TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  played_at      TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Conversations (AI context store) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id      UUID REFERENCES sports_complexes(id) ON DELETE CASCADE,
  player_id       UUID REFERENCES players(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('whatsapp','web','api')),
  channel_user_id TEXT,
  messages        JSONB NOT NULL DEFAULT '[]',
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Messages Log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id      UUID REFERENCES sports_complexes(id) ON DELETE SET NULL,
  player_id       UUID REFERENCES players(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,
  channel_user_id TEXT,
  conversation_id TEXT,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  tool_calls      JSONB,
  tool_results    JSONB,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tenant Members (admin staff) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES sports_complexes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'staff'
             CHECK (role IN ('owner','admin','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(complex_id, user_id)
);

-- ── Updated_at auto-trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sports_complexes_updated
  BEFORE UPDATE ON sports_complexes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_courts_updated
  BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_players_updated
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_reservations_updated
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_conversations_updated
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
