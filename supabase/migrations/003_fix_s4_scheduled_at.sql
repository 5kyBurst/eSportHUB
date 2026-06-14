-- Correction des scheduled_at pour CDL Stage 4
-- Les dates Semaine 2 et 3 étaient décalées d'1 jour trop tôt
-- Et les heures d'1h trop tôt (18:00Z au lieu de 19:00Z = 21:00 CEST)
--
-- Avant : Semaine 2 Jour 3 → 2026-06-13T18:00Z  (June 13, 20h CEST → DÉJÀ PASSÉ)
-- Après : Semaine 2 Jour 3 → 2026-06-14T19:00Z  (June 14, 21h CEST ✓)

UPDATE matches
SET scheduled_at = scheduled_at + INTERVAL '1 day 1 hour'
WHERE tournament_id = (SELECT id FROM tournaments WHERE slug = 'cdl-2026-s4')
  AND (round_label LIKE 'Semaine 2%' OR round_label LIKE 'Semaine 3%');
