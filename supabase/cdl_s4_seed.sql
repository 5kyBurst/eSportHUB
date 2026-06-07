-- ─────────────────────────────────────────────────────────────────────────────
-- CDL 2026 Stage 4 Major Qualifiers — seed
-- Coller dans Supabase Dashboard > SQL Editor et exécuter
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Contrainte unique sur predictions(user_id, match_id) pour l'upsert
CREATE UNIQUE INDEX IF NOT EXISTS predictions_user_match_idx
  ON predictions (user_id, match_id);

-- 2. Tournament
INSERT INTO tournaments (name, slug, format, start_date, end_date, status)
VALUES (
  'CDL 2026 Stage 4 Major Qualifiers',
  'cdl-2026-s4',
  'swiss',
  '2026-05-29',
  '2026-06-21',
  'live'
)
ON CONFLICT (slug) DO NOTHING;

-- 2b. Contrainte unique sur match_key pour l'upsert
CREATE UNIQUE INDEX IF NOT EXISTS matches_match_key_idx ON matches (match_key);

-- 3. Matches (30 matchs)
-- match_key : cdl26s4-NNN (NNN = numéro 001-030)
INSERT INTO matches (
  tournament_id, match_key, team_a, team_b, format,
  score_a, score_b, status, scheduled_at, round_label
)
SELECT
  (SELECT id FROM tournaments WHERE slug = 'cdl-2026-s4'),
  d.k, d.ta, d.tb, 'BO5', d.sa::integer, d.sb::integer, d.st, d.ts::timestamptz, d.rl
FROM (VALUES
  -- Semaine 1 - Jour 1 (29 Mai) — terminés
  ('cdl26s4-001','Toronto KOI',         'Carolina Royal Ravens', 0,    3,    'finished','2026-05-29T18:00:00Z','Semaine 1 · Jour 1'),
  ('cdl26s4-002','G2 Minnesota',        'Cloud9 New York',       3,    1,    'finished','2026-05-29T19:30:00Z','Semaine 1 · Jour 1'),
  ('cdl26s4-003','Vancouver Surge',     'OpTic Texas',           0,    3,    'finished','2026-05-29T21:00:00Z','Semaine 1 · Jour 1'),
  -- Semaine 1 - Jour 2 (30 Mai) — terminés
  ('cdl26s4-004','Los Angeles Thieves', 'FaZe Vegas',            3,    2,    'finished','2026-05-30T18:00:00Z','Semaine 1 · Jour 2'),
  ('cdl26s4-005','Paris Gentle Mates',  'Carolina Royal Ravens', 3,    0,    'finished','2026-05-30T19:30:00Z','Semaine 1 · Jour 2'),
  ('cdl26s4-006','Vancouver Surge',     'Boston Breach',         2,    3,    'finished','2026-05-30T21:00:00Z','Semaine 1 · Jour 2'),
  ('cdl26s4-007','Riyadh Falcons',      'Miami Heretics',        3,    2,    'finished','2026-05-30T22:30:00Z','Semaine 1 · Jour 2'),
  -- Semaine 1 - Jour 3 (31 Mai) — terminés
  ('cdl26s4-008','Riyadh Falcons',      'Paris Gentle Mates',    3,    0,    'finished','2026-05-31T18:00:00Z','Semaine 1 · Jour 3'),
  ('cdl26s4-009','OpTic Texas',         'Miami Heretics',        3,    0,    'finished','2026-05-31T19:30:00Z','Semaine 1 · Jour 3'),
  ('cdl26s4-010','Cloud9 New York',     'Boston Breach',         1,    3,    'finished','2026-05-31T21:00:00Z','Semaine 1 · Jour 3'),
  -- Semaine 2 - Jour 1 (11 Juin)
  ('cdl26s4-011','OpTic Texas',         'G2 Minnesota',          NULL, NULL, 'upcoming','2026-06-11T18:00:00Z','Semaine 2 · Jour 1'),
  ('cdl26s4-012','Paris Gentle Mates',  'FaZe Vegas',            NULL, NULL, 'upcoming','2026-06-11T19:30:00Z','Semaine 2 · Jour 1'),
  ('cdl26s4-013','Los Angeles Thieves', 'Boston Breach',         NULL, NULL, 'upcoming','2026-06-11T21:00:00Z','Semaine 2 · Jour 1'),
  -- Semaine 2 - Jour 2 (12 Juin)
  ('cdl26s4-014','Toronto KOI',         'Boston Breach',         NULL, NULL, 'upcoming','2026-06-12T18:00:00Z','Semaine 2 · Jour 2'),
  ('cdl26s4-015','OpTic Texas',         'Carolina Royal Ravens', NULL, NULL, 'upcoming','2026-06-12T19:30:00Z','Semaine 2 · Jour 2'),
  ('cdl26s4-016','Miami Heretics',      'FaZe Vegas',            NULL, NULL, 'upcoming','2026-06-12T21:00:00Z','Semaine 2 · Jour 2'),
  ('cdl26s4-017','Los Angeles Thieves', 'G2 Minnesota',          NULL, NULL, 'upcoming','2026-06-12T22:30:00Z','Semaine 2 · Jour 2'),
  -- Semaine 2 - Jour 3 (13 Juin)
  ('cdl26s4-018','Toronto KOI',         'Cloud9 New York',       NULL, NULL, 'upcoming','2026-06-13T18:00:00Z','Semaine 2 · Jour 3'),
  ('cdl26s4-019','Vancouver Surge',     'Paris Gentle Mates',    NULL, NULL, 'upcoming','2026-06-13T19:30:00Z','Semaine 2 · Jour 3'),
  ('cdl26s4-020','Riyadh Falcons',      'Carolina Royal Ravens', NULL, NULL, 'upcoming','2026-06-13T21:00:00Z','Semaine 2 · Jour 3'),
  -- Semaine 3 - Jour 1 (18 Juin)
  ('cdl26s4-021','Riyadh Falcons',      'FaZe Vegas',            NULL, NULL, 'upcoming','2026-06-18T18:00:00Z','Semaine 3 · Jour 1'),
  ('cdl26s4-022','Los Angeles Thieves', 'Cloud9 New York',       NULL, NULL, 'upcoming','2026-06-18T19:30:00Z','Semaine 3 · Jour 1'),
  ('cdl26s4-023','Paris Gentle Mates',  'Boston Breach',         NULL, NULL, 'upcoming','2026-06-18T21:00:00Z','Semaine 3 · Jour 1'),
  -- Semaine 3 - Jour 2 (19 Juin)
  ('cdl26s4-024','Miami Heretics',      'Cloud9 New York',       NULL, NULL, 'upcoming','2026-06-19T18:00:00Z','Semaine 3 · Jour 2'),
  ('cdl26s4-025','Vancouver Surge',     'Los Angeles Thieves',   NULL, NULL, 'upcoming','2026-06-19T19:30:00Z','Semaine 3 · Jour 2'),
  ('cdl26s4-026','Toronto KOI',         'OpTic Texas',           NULL, NULL, 'upcoming','2026-06-19T21:00:00Z','Semaine 3 · Jour 2'),
  ('cdl26s4-027','Riyadh Falcons',      'G2 Minnesota',          NULL, NULL, 'upcoming','2026-06-19T22:30:00Z','Semaine 3 · Jour 2'),
  -- Semaine 3 - Jour 3 (20 Juin)
  ('cdl26s4-028','Vancouver Surge',     'Miami Heretics',        NULL, NULL, 'upcoming','2026-06-20T18:00:00Z','Semaine 3 · Jour 3'),
  ('cdl26s4-029','Toronto KOI',         'G2 Minnesota',          NULL, NULL, 'upcoming','2026-06-20T19:30:00Z','Semaine 3 · Jour 3'),
  ('cdl26s4-030','FaZe Vegas',          'Carolina Royal Ravens', NULL, NULL, 'upcoming','2026-06-20T21:00:00Z','Semaine 3 · Jour 3')
) AS d(k, ta, tb, sa, sb, st, ts, rl)
ON CONFLICT (match_key) DO UPDATE SET
  score_a = EXCLUDED.score_a,
  score_b = EXCLUDED.score_b,
  status  = EXCLUDED.status;
