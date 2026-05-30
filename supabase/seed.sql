-- ============================================================================
-- Find Your Rival – Development Seed Data
-- ============================================================================

-- Demo sports complex
INSERT INTO sports_complexes (id, name, slug, email, phone, address, city, timezone, plan, plan_status)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Centro Deportivo Demo',
  'centro-deportivo-demo',
  'demo@findyourrival.com',
  '+34600000000',
  'Calle Deportiva 1',
  'Madrid',
  'Europe/Madrid',
  'professional',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Demo courts
INSERT INTO courts (id, complex_id, name, sport, surface, indoor, capacity, hourly_rate)
VALUES
  ('c1000001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pista Pádel 1', 'padel', 'crystal', true, 4, 18.00),
  ('c1000001-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pista Pádel 2', 'padel', 'crystal', false, 4, 15.00),
  ('c1000001-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pista Pádel 3', 'padel', 'synthetic', false, 4, 15.00),
  ('c1000001-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pista Tenis 1', 'tennis', 'clay', false, 4, 20.00),
  ('c1000001-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pista Tenis 2', 'tennis', 'hard', true, 4, 22.00),
  ('c1000001-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Campo Fútbol 7', 'soccer', 'synthetic', false, 14, 60.00)
ON CONFLICT DO NOTHING;

-- Demo players
INSERT INTO players (id, complex_id, full_name, email, phone, sport, skill_level, skill_score, age, gender, is_looking_for_match)
VALUES
  ('p1000001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Carlos García', 'carlos@demo.com', '+34611000001', 'padel', 'intermediate', 520, 28, 'male', true),
  ('p1000001-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'María López', 'maria@demo.com', '+34611000002', 'padel', 'advanced', 680, 32, 'female', true),
  ('p1000001-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Antonio Ruiz', 'antonio@demo.com', '+34611000003', 'padel', 'beginner', 320, 45, 'male', false),
  ('p1000001-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Elena Martín', 'elena@demo.com', '+34611000004', 'tennis', 'advanced', 720, 25, 'female', true),
  ('p1000001-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pedro Sánchez', 'pedro@demo.com', '+34611000005', 'tennis', 'intermediate', 490, 38, 'male', true),
  ('p1000001-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Laura Fernández', 'laura@demo.com', '+34611000006', 'padel', 'intermediate', 550, 30, 'female', true)
ON CONFLICT DO NOTHING;
