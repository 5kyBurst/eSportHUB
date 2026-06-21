import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncScores } from "@/lib/sync-scores";
import { isAdmin } from "@/lib/admin";

export async function POST() {
  const supabase = await createClient();
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await syncScores();
  return NextResponse.json(result);
}
