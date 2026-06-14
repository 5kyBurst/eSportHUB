import { createClient } from "@supabase/supabase-js";
import { fetchLiquipediaResults, findResult } from "@/lib/liquipedia";
import type { Database } from "@/types/database";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type TournamentResult = {
  slug: string;
  name: string;
  status: string;
  updated: number;
  skipped: number;
  error?: string;
};

export async function syncScores(): Promise<{
  synced: number;
  tournaments: TournamentResult[];
  message?: string;
}> {
  const supabase = adminClient();
  const now = new Date().toISOString();

  // Inclut tous les tournois ayant une URL Liquipedia dont la date a commencé,
  // peu importe le statut — un tournoi "finished" peut encore avoir des matchs à syncer.
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, slug, liquipedia_url, status, start_date")
    .not("liquipedia_url", "is", null)
    .lte("start_date", now.slice(0, 10));

  if (!tournaments?.length) {
    return { synced: 0, tournaments: [], message: "Aucun tournoi avec URL Liquipedia" };
  }

  let totalUpdated = 0;
  const results: TournamentResult[] = [];

  for (const tournament of tournaments) {
    if (!tournament.liquipedia_url) continue;

    const tr: TournamentResult = {
      slug: tournament.slug,
      name: tournament.name,
      status: tournament.status ?? "unknown",
      updated: 0,
      skipped: 0,
    };

    // Tous les matchs non encore terminés de ce tournoi
    const { data: matches } = await supabase
      .from("matches")
      .select("id, match_key, team_a, team_b, status")
      .eq("tournament_id", tournament.id)
      .neq("status", "finished");

    if (!matches?.length) {
      // Aucun match à syncer — marque le tournoi terminé si ce n'est pas déjà fait
      if (tournament.status !== "finished") {
        await supabase
          .from("tournaments")
          .update({ status: "finished" })
          .eq("id", tournament.id);
        tr.status = "finished";
      }
      results.push(tr);
      continue;
    }

    // Passe le tournoi en "live" s'il est encore "upcoming"
    if (tournament.status === "upcoming") {
      await supabase
        .from("tournaments")
        .update({ status: "live" })
        .eq("id", tournament.id);
      tr.status = "live";
    }

    const knownTeams = [...new Set(matches.flatMap(m => [m.team_a, m.team_b]))];

    let parsed;
    try {
      parsed = await fetchLiquipediaResults(tournament.liquipedia_url, knownTeams);
    } catch (err) {
      tr.error = err instanceof Error ? err.message : String(err);
      console.error(`[sync-scores] ${tournament.slug}: ${tr.error}`);
      results.push(tr);
      continue;
    }

    if (!parsed.length) {
      tr.error = "Aucun résultat extrait de Liquipedia (0 matchs trouvés sur la page)";
      results.push(tr);
      continue;
    }

    for (const match of matches) {
      const result = findResult(parsed, match.team_a, match.team_b);
      if (!result) {
        tr.skipped++;
        continue;
      }

      const { error } = await supabase
        .from("matches")
        .update({ score_a: result.scoreA, score_b: result.scoreB, status: "finished" })
        .eq("id", match.id);

      if (!error) {
        tr.updated++;
        totalUpdated++;
      }
    }

    // Si tous les matchs sont maintenant finished, marque le tournoi terminé
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament.id)
      .neq("status", "finished");

    if (count === 0) {
      await supabase
        .from("tournaments")
        .update({ status: "finished" })
        .eq("id", tournament.id);
      tr.status = "finished";
    }

    results.push(tr);
  }

  return { synced: totalUpdated, tournaments: results };
}
