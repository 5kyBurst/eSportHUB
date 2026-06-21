import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseWikitextMatches } from "@/lib/liquipedia-import";
import { fetchBracketData } from "@/lib/liquipedia";
import { isAdmin } from "@/lib/admin";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Construit l'URL API Liquipedia wikitext pour n'importe quel wiki (CDL, VCT, RLCS…)
function toWikitextApiUrl(pageUrl: string): string {
  const m = pageUrl.match(/^(https?:\/\/liquipedia\.net\/[^/?#]+)\/(.+?)(?:\?.*)?$/);
  if (!m) throw new Error(`URL Liquipedia invalide : ${pageUrl}`);
  const [, base, rawPage] = m;
  return `${base}/api.php?action=parse&page=${encodeURIComponent(decodeURIComponent(rawPage))}&prop=wikitext&format=json&disablelimitreport=1`;
}

const LP_HEADERS = {
  "User-Agent": "eSportHUB-ScoreSync/1.0 (contact: bmaxime77@sfr.fr)",
  "Accept-Encoding": "gzip",
};

// POST /api/admin/import-matches
// Body: { tournamentId, liquipediaUrl, dryRun? }
export async function POST(req: Request) {
  await createServerClient();
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tournamentId, liquipediaUrl, dryRun = true } = await req.json() as {
    tournamentId: string;
    liquipediaUrl: string;
    dryRun?: boolean;
  };

  if (!liquipediaUrl?.includes("liquipedia.net")) {
    return NextResponse.json({ error: "URL Liquipedia invalide" }, { status: 400 });
  }

  const db = adminClient();
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, slug, name, start_date")
    .eq("id", tournamentId)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable" }, { status: 404 });
  }

  // ── 1. Essai wikitext (ancien format {{Match}} — Swiss stages, anciens brackets) ──
  let parsed = await (async () => {
    try {
      const res = await fetch(toWikitextApiUrl(liquipediaUrl), {
        headers: LP_HEADERS,
        next: { revalidate: 0 },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error) return null;
      const wikitext: string = data.parse?.wikitext?.["*"] ?? "";
      if (!wikitext) return null;
      const result = parseWikitextMatches(wikitext, tournament.slug);
      return result.length > 0 ? result : null;
    } catch {
      return null;
    }
  })();

  // ── 2. Fallback HTML (nouveau format brkts — Bracket/8L4DSS, Bracket/8UBL2DSL1D…) ──
  if (!parsed) {
    try {
      const bracketData = await fetchBracketData(liquipediaUrl);

      // Importe TOUS les slots, même TBD — la structure du bracket doit apparaître en DB
      // pour que la page predict puisse afficher les cases et accepter des prédictions.
      if (bracketData.slots.length > 0) {
        parsed = bracketData.slots.map(slot => ({
          matchKey: `${tournament.slug}-${slot.roundLabel.toLowerCase().replace(/\s+/g, "-")}-${slot.slotIndex}`,
          teamA: slot.teamA === "TBD" ? "TBD" : slot.teamA,
          teamB: slot.teamB === "TBD" ? "TBD" : slot.teamB,
          roundLabel: slot.roundLabel,
          scheduledAt: null,
        }));
      } else if (bracketData.layout.ubRounds.length > 0) {
        // Bracket connu structurellement mais 0 équipes → créer des slots vides
        const rounds = [...bracketData.layout.ubRounds, ...bracketData.layout.lbRounds];
        if (bracketData.layout.grandFinalDbLabel) {
          rounds.push({ label: "Grand Final", dbLabel: bracketData.layout.grandFinalDbLabel, matchCount: 1 });
        }
        parsed = rounds.flatMap(r =>
          Array.from({ length: r.matchCount }, (_, i) => ({
            matchKey: `${tournament.slug}-${r.dbLabel.toLowerCase().replace(/\s+/g, "-")}-${i}`,
            teamA: "TBD",
            teamB: "TBD",
            roundLabel: r.dbLabel,
            scheduledAt: null,
          }))
        );
      }
    } catch (e) {
      return NextResponse.json({
        error: `Impossible de récupérer le bracket: ${String(e)}`,
      }, { status: 502 });
    }
  }

  if (!parsed || parsed.length === 0) {
    return NextResponse.json({
      error: "Aucun match trouvé. Vérifier l'URL Liquipedia et que la page contient un bracket ou une matchlist.",
    }, { status: 422 });
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, matches: parsed, count: parsed.length });
  }

  const fallbackDate = tournament.start_date
    ? new Date(tournament.start_date).toISOString()
    : new Date().toISOString();

  const rows = parsed.map(m => ({
    tournament_id: tournament.id,
    match_key:     m.matchKey,
    team_a:        m.teamA,
    team_b:        m.teamB,
    format:        "BO5",
    score_a:       null as number | null,
    score_b:       null as number | null,
    status:        "upcoming",
    scheduled_at:  m.scheduledAt ?? fallbackDate,
    round_label:   m.roundLabel,
  }));

  const { data: inserted, error } = await db
    .from("matches")
    .upsert(rows, { onConflict: "match_key", ignoreDuplicates: false })
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    dryRun: false,
    inserted: inserted?.length ?? 0,
    matches: parsed,
  });
}
