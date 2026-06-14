-- ─────────────────────────────────────────────────────────────────────────────
-- CDL 2026 Stage 4 Minor — Bracket tournament
-- Résultats depuis le screenshot Liquipedia (Minor 2 = Stage 4 Minor)
-- Liquipedia URL: https://liquipedia.net/callofduty/Call_of_Duty_League/Season_7/Stage_4/Minor
-- ─────────────────────────────────────────────────────────────────────────────

-- Index unique sur match_key (si pas déjà fait)
CREATE UNIQUE INDEX IF NOT EXISTS matches_match_key_idx ON matches (match_key);
CREATE UNIQUE INDEX IF NOT EXISTS predictions_user_match_idx ON predictions (user_id, match_id);

-- 1. Tournoi
INSERT INTO tournaments (name, slug, format, start_date, end_date, status, game)
VALUES (
  'CDL 2026 Stage 4 Minor',
  'cdl-2026-s4-minor',
  'bracket',
  '2026-06-05',
  '2026-06-08',
  'finished',
  'cdl'
)
ON CONFLICT (slug) DO UPDATE SET
  format = 'bracket',
  status = 'finished';

-- 2. Matchs (11 au total : 4 Tour 1 + 4 QF + 2 SF + 1 Finale)
-- Heures approximatives (13:00 MDT = 19:00 UTC = 21:00 CEST)
INSERT INTO matches (
  tournament_id, match_key, team_a, team_b, format,
  score_a, score_b, status, scheduled_at, round_label
)
SELECT
  (SELECT id FROM tournaments WHERE slug = 'cdl-2026-s4-minor'),
  d.k, d.ta, d.tb, 'BO5',
  d.sa::integer, d.sb::integer, 'finished', d.ts::timestamptz, d.rl
FROM (VALUES
  -- ── Tour 1 (6 Juin) ────────────────────────────────────────────────────────
  ('cdl26s4min-r1m1','Riyadh Falcons',        'Carolina Royal Ravens', 3, 2, '2026-06-06T19:00:00Z','Tour 1'),
  ('cdl26s4min-r1m2','Toronto KOI',           'Cloud9 New York',       3, 0, '2026-06-06T20:30:00Z','Tour 1'),
  ('cdl26s4min-r1m3','Miami Heretics',        'Vancouver Surge',       0, 3, '2026-06-06T22:00:00Z','Tour 1'),
  ('cdl26s4min-r1m4','G2 Minnesota',          'Boston Breach',         3, 1, '2026-06-06T23:30:00Z','Tour 1'),
  -- ── Quarts de finale (7 Juin) ──────────────────────────────────────────────
  ('cdl26s4min-r2m1','OpTic Texas',           'Riyadh Falcons',        3, 0, '2026-06-07T17:00:00Z','Quarts de finale'),
  ('cdl26s4min-r2m2','Paris Gentle Mates',    'Toronto KOI',           3, 0, '2026-06-07T18:30:00Z','Quarts de finale'),
  ('cdl26s4min-r2m3','FaZe Vegas',            'Vancouver Surge',       3, 2, '2026-06-07T20:00:00Z','Quarts de finale'),
  ('cdl26s4min-r2m4','Los Angeles Thieves',   'G2 Minnesota',          3, 0, '2026-06-07T21:30:00Z','Quarts de finale'),
  -- ── Demi-finales (8 Juin) ──────────────────────────────────────────────────
  ('cdl26s4min-r3m1','OpTic Texas',           'Paris Gentle Mates',    3, 0, '2026-06-08T17:00:00Z','Demi-finales'),
  ('cdl26s4min-r3m2','FaZe Vegas',            'Los Angeles Thieves',   0, 3, '2026-06-08T19:00:00Z','Demi-finales'),
  -- ── Finale (8 Juin) ────────────────────────────────────────────────────────
  ('cdl26s4min-r4m1','OpTic Texas',           'Los Angeles Thieves',   2, 4, '2026-06-08T21:30:00Z','Finale')
) AS d(k, ta, tb, sa, sb, ts, rl)
ON CONFLICT (match_key) DO UPDATE SET
  score_a     = EXCLUDED.score_a,
  score_b     = EXCLUDED.score_b,
  status      = EXCLUDED.status,
  round_label = EXCLUDED.round_label;
