import { createClient } from "@supabase/supabase-js";
import { fetchLiquipediaResults, findResult } from "@/lib/liquipedia";
import type { Database } from "@/types/database";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function syncScores(): Promise<{ synced: number; message?: string }> {
  const supabase = adminClient();

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, slug, liquipedia_url")
    .eq("status", "live")
    .not("liquipedia_url", "is", null);

  if (!tournaments?.length) {
    return { synced: 0, message: "Aucun tournoi live avec URL Liquipedia" };
  }

  let totalUpdated = 0;

  for (const tournament of tournaments) {
    if (!tournament.liquipedia_url) continue;

    const { data: matches } = await supabase
      .from("matches")
      .select("id, match_key, team_a, team_b")
      .eq("tournament_id", tournament.id)
      .eq("status", "upcoming");

    if (!matches?.length) continue;

    const knownTeams = [...new Set(matches.flatMap(m => [m.team_a, m.team_b]))];

    let parsed;
    try {
      parsed = await fetchLiquipediaResults(tournament.liquipedia_url, knownTeams);
    } catch (err) {
      console.error(`[sync-scores] Erreur fetch ${tournament.slug}:`, err);
      continue;
    }

    if (!parsed.length) continue;

    for (const match of matches) {
      const result = findResult(parsed, match.team_a, match.team_b);
      if (!result) continue;

      const { error } = await supabase
        .from("matches")
        .update({ score_a: result.scoreA, score_b: result.scoreB, status: "finished" })
        .eq("id", match.id);

      if (!error) totalUpdated++;
    }
  }

  return { synced: totalUpdated };
}
