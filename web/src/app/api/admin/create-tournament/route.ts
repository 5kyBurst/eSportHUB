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

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, slug, format, game, startDate, endDate, liquipediaUrl } = await req.json() as {
    name: string; slug: string; format: string; game: string;
    startDate: string; endDate: string; liquipediaUrl?: string;
  };

  if (!name || !slug || !format || !game || !startDate || !endDate) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const db = adminClient();
  const { data, error } = await db
    .from("tournaments")
    .insert({
      name,
      slug,
      format,
      game,
      start_date: startDate,
      end_date: endDate,
      status: "upcoming",
      liquipedia_url: liquipediaUrl || null,
    })
    .select("id, slug")
    .single();

  if (error) {
    const msg = error.code === "23505"
      ? `Le slug "${slug}" existe déjà`
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ id: data.id, slug: data.slug });
}
