import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseWikitextMatches } from "@/lib/liquipedia-import";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toApiUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  const page = url.pathname.replace(/^\/callofduty\//, "");
  return `https://liquipedia.net/callofduty/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json`;
}

// POST /api/admin/import-matches
// Body: { tournamentId, liquipediaUrl, dryRun? }
// - dryRun=true  → retourne la liste parsée sans insérer
// - dryRun=false → insère (upsert par match_key) dans la DB
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
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

  // Récupère le slug du tournoi
  const db = adminClient();
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, slug, name")
    .eq("id", tournamentId)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: "Tournoi introuvable" }, { status: 404 });
  }

  // Fetch le wikitext depuis Liquipedia
  const apiUrl = toApiUrl(liquipediaUrl);
  let wikitext: string;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "eSportHUB-ScoreSync/1.0 (contact: bmaxime77@sfr.fr)",
        "Accept-Encoding": "gzip",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Liquipedia API erreur ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: `Liquipedia: ${data.error.info ?? data.error.code}` }, { status: 502 });
    }
    wikitext = data.parse?.wikitext?.["*"] ?? "";
  } catch (e) {
    return NextResponse.json({ error: `Fetch Liquipedia échoué: ${String(e)}` }, { status: 502 });
  }

  if (!wikitext) {
    return NextResponse.json({ error: "Wikitext vide — vérifier l'URL" }, { status: 502 });
  }

  // Parse les matchs
  const parsed = parseWikitextMatches(wikitext, tournament.slug);

  if (parsed.length === 0) {
    return NextResponse.json({
      error: "Aucun match trouvé dans le wikitext. Vérifier l'URL et le format de la page.",
      wikitextSnippet: wikitext.slice(0, 500),
    }, { status: 422 });
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, matches: parsed, count: parsed.length });
  }

  // Upsert dans la DB
  const rows = parsed.map(m => ({
    tournament_id: tournament.id,
    match_key:     m.matchKey,
    team_a:        m.teamA,
    team_b:        m.teamB,
    format:        "BO5",
    score_a:       null as number | null,
    score_b:       null as number | null,
    status:        "upcoming",
    scheduled_at:  m.scheduledAt,
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
