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

// POST /api/admin/close-season  { tournamentId: string }
// 1. Agrège points_earned → profiles.points pour chaque user
// 2. Supprime toutes les prédictions du tournoi
// 3. Marque le tournoi comme finished
export async function POST(req: Request) {
  const serverClient = await createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tournamentId } = await req.json() as { tournamentId: string };
  const supabase = adminClient();

  // 1. Agréger les points par utilisateur
  const { data: matchIds } = await supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (!matchIds?.length) {
    return NextResponse.json({ error: "Tournoi introuvable ou sans matchs" }, { status: 400 });
  }

  const ids = matchIds.map(m => m.id);

  const { data: preds } = await supabase
    .from("predictions")
    .select("user_id, points_earned")
    .in("match_id", ids)
    .not("points_earned", "is", null);

  // Somme des points par user
  const pointsByUser: Record<string, number> = {};
  for (const p of preds ?? []) {
    pointsByUser[p.user_id] = (pointsByUser[p.user_id] ?? 0) + (p.points_earned ?? 0);
  }

  // 2. Créditer les profils
  let credited = 0;
  for (const [userId, pts] of Object.entries(pointsByUser)) {
    if (pts === 0) continue;
    const { data: profile } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .single();

    if (!profile) continue;

    await supabase
      .from("profiles")
      .update({ points: profile.points + pts })
      .eq("id", userId);

    credited++;
  }

  // 3. Supprimer les prédictions du tournoi
  await supabase
    .from("predictions")
    .delete()
    .in("match_id", ids);

  // 4. Marquer le tournoi comme terminé
  await supabase
    .from("tournaments")
    .update({ status: "finished" })
    .eq("id", tournamentId);

  return NextResponse.json({ credited, message: "Saison clôturée" });
}
