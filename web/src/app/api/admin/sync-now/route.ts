import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncScores } from "@/lib/sync-scores";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await syncScores();
  return NextResponse.json(result);
}
