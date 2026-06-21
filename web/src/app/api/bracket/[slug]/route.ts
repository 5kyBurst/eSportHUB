import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchBracketData } from "@/lib/liquipedia";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("liquipedia_url")
    .eq("slug", slug)
    .single();

  if (error || !tournament) {
    return NextResponse.json({ error: "Tournoi introuvable" }, { status: 404 });
  }

  const { liquipedia_url } = tournament;
  if (!liquipedia_url) {
    return NextResponse.json({ layout: null, slots: [] });
  }

  try {
    const data = await fetchBracketData(liquipedia_url);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[bracket] fetchBracketData error:", err);
    return NextResponse.json({ layout: null, slots: [], error: String(err) }, { status: 200 });
  }
}
