-- Stocke la structure du bracket (nombre de matchs par round, labels)
-- détectée automatiquement depuis le wikitext Liquipedia lors de l'import.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bracket_config JSONB;
