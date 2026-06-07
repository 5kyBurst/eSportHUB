-- Ajouter l'URL Liquipedia par tournoi (pour le scraper auto)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS liquipedia_url text;
