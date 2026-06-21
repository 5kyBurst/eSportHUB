import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isAdmin } from "@/lib/admin";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/admin/fix-schedules
// Corrige les scheduled_at décalés d'1 jour+1h pour Semaine 2 et 3 du CDL S4
export async function POST(req: Request) {
  const supabase = await createServerClient();
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tournamentSlug, roundLabels, shiftMs } = await req.json() as {
    tournamentSlug: string;
    roundLabels: string[];   // e.g. ["Semaine 2 · Jour 3", "Semaine 3 · Jour 1", ...]
    shiftMs: number;         // millisecondes à ajouter (e.g. 3600000*25 = +25h)
  };

  const db = adminClient();

  // Récupère le tournoi
  const { data: tournament } = await db
    .from("tournaments")
    .select("id")
    .eq("slug", tournamentSlug)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: `Tournoi '${tournamentSlug}' introuvable` }, { status: 404 });
  }

  // Récupère les matchs concernés
  const { data: matches } = await db
    .from("matches")
    .select("id, scheduled_at, round_label")
    .eq("tournament_id", tournament.id)
    .in("round_label", roundLabels);

  if (!matches?.length) {
    return NextResponse.json({ error: "Aucun match trouvé pour ces round_labels" }, { status: 404 });
  }

  // Met à jour chaque match
  let updated = 0;
  const details: string[] = [];
  for (const m of matches) {
    const oldDate = new Date(m.scheduled_at);
    const newDate = new Date(oldDate.getTime() + shiftMs);
    const { error } = await db
      .from("matches")
      .update({ scheduled_at: newDate.toISOString() })
      .eq("id", m.id);
    if (!error) {
      updated++;
      details.push(`${m.round_label}: ${oldDate.toISOString()} → ${newDate.toISOString()}`);
    }
  }

  return NextResponse.json({ updated, details });
}
