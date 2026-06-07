-- ─────────────────────────────────────────────────────────────────────────────
-- Politiques RLS — à exécuter dans Supabase Dashboard > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- matches : lecture publique (les matchs ne sont pas confidentiels)
CREATE POLICY "matches_public_read"
  ON matches FOR SELECT
  TO anon, authenticated
  USING (true);

-- tournaments : lecture publique
CREATE POLICY "tournaments_public_read"
  ON tournaments FOR SELECT
  TO anon, authenticated
  USING (true);

-- predictions : un utilisateur ne voit et ne modifie que ses propres prédictions
CREATE POLICY "predictions_own_read"
  ON predictions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "predictions_own_insert"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "predictions_own_update"
  ON predictions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
