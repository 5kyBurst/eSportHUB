import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/admin/calculate-points  { tournamentId: string }
// Calcule points_earned pour toutes les prédictions des matchs terminés.
export async function POST(req: Request) {
  const serverClient = await createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tournamentId } = await req.json() as { tournamentId: string };
  const supabase = adminClient();

  // Récupère tous les matchs terminés du tournoi avec les prédictions associées
  const { data: matches } = await supabase
    .from("matches")
    .select("id, score_a, score_b")
    .eq("tournament_id", tournamentId)
    .eq("status", "finished")
    .not("score_a", "is", null);

  if (!matches?.length) {
    return NextResponse.json({ updated: 0, message: "Aucun match terminé" });
  }

  let updated = 0;

  for (const match of matches) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("id, score_a, score_b")
      .eq("match_id", match.id);

    if (!preds?.length) continue;

    for (const pred of preds) {
      let pts = 0;
      if (pred.score_a === match.score_a && pred.score_b === match.score_b) {
        pts = 5; // Score exact
      } else {
        const realWinner  = match.score_a! > match.score_b! ? "a" : "b";
        const predWinner  = pred.score_a  > pred.score_b   ? "a" : "b";
        if (realWinner === predWinner) pts = 3; // Bon vainqueur
      }

      const { error } = await supabase
        .from("predictions")
        .update({ points_earned: pts })
        .eq("id", pred.id);

      if (!error) updated++;
    }
  }

  return NextResponse.json({ updated });
}
