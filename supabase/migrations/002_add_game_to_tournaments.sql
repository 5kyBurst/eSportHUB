-- Colonne game pour filtrer les tournois par esport (cdl, vct, vct-gc, rlcs...)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS game text;

-- Renseigne les tournois existants d'après leur slug
UPDATE tournaments SET game = 'cdl'    WHERE slug LIKE 'cdl-%';
UPDATE tournaments SET game = 'vct'    WHERE slug LIKE 'vct-%' AND slug NOT LIKE 'vct-gc-%';
UPDATE tournaments SET game = 'vct-gc' WHERE slug LIKE 'vct-gc-%';
UPDATE tournaments SET game = 'rlcs'   WHERE slug LIKE 'rlcs-%';
