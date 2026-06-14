-- Ajoute 'bracket' aux valeurs autorisées pour tournaments.format
ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_format_check;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_format_check
  CHECK (format IN ('swiss', 'roundrobin', 'bracket', 'single_elim', 'double_elim'));
