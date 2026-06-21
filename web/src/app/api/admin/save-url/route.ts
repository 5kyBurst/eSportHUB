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

// POST /api/admin/save-url  { tournamentId, url }
export async function POST(req: Request) {
  const supabase = await createServerClient();
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tournamentId, url } = await req.json() as { tournamentId: string; url: string };

  const { error } = await adminClient()
    .from("tournaments")
    .update({ liquipedia_url: url || null })
    .eq("id", tournamentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
