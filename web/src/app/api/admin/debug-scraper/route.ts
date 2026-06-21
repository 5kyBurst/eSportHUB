import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// GET /api/admin/debug-scraper?url=https://liquipedia.net/callofduty/Call_of_Duty_League/Season_7/Stage_4/Minor
export async function GET(req: Request) {
  const supabase = await createServerClient();
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url requis" }, { status: 400 });

  const m = url.match(/^(https?:\/\/liquipedia\.net\/[^/?#]+)\/(.+?)(?:\?.*)?$/);
  if (!m) return NextResponse.json({ error: "URL Liquipedia invalide" }, { status: 400 });
  const [, base, rawPage] = m;
  const page = decodeURIComponent(rawPage);

  const headers = {
    "User-Agent": "eSportHUB-ScoreSync/1.0 (contact: bmaxime77@sfr.fr)",
    "Accept-Encoding": "gzip",
  };

  // Fetch rendered HTML via MediaWiki API
  const apiUrl = `${base}/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&disablelimitreport=1`;
  const res = await fetch(apiUrl, { headers, next: { revalidate: 0 } });
  const raw = await res.json() as {
    parse?: { text?: { "*": string }; title?: string };
    error?: { code: string; info: string };
  };

  const html = raw.parse?.text?.["*"] ?? "";
  const pageTitle = raw.parse?.title ?? null;
  const apiError = raw.error ?? null;

  // ── Stratégie brkts-match (bracket : Minor/Major) ──────────────────────────
  const bracketPositions = [...html.matchAll(/<div[^>]*class="[^"]*brkts-match[^"]*"/g)].map(m => m.index!);
  const bracketMatches: Array<{ teamA: string; scoreA: number; teamB: string; scoreB: number }> = [];
  for (let i = 0; i < bracketPositions.length; i++) {
    const start = bracketPositions[i];
    const end   = i + 1 < bracketPositions.length ? bracketPositions[i + 1] : start + 3000;
    const block = html.slice(start, Math.min(end, start + 3000));
    const teams  = [...block.matchAll(/aria-label="([^"]{2,80})"/g)].map(m => m[1]);
    const scores = [...block.matchAll(/brkts-opponent-score-inner[^>]*>(?:<b>)?(\d+)/g)].map(m => parseInt(m[1]));
    if (teams.length >= 2 && scores.length >= 2)
      bracketMatches.push({ teamA: teams[0], scoreA: scores[0], teamB: teams[1], scoreB: scores[1] });
  }

  // ── Stratégie brkts-matchlist (saison régulière : Week 1/2/3) ───────────────
  const listPositions = [...html.matchAll(/<div[^>]*class="[^"]*brkts-matchlist-match[^"]*"/g)].map(m => m.index!);
  const listMatches: Array<{ teamA: string; scoreA: number; teamB: string; scoreB: number }> = [];
  for (let i = 0; i < listPositions.length; i++) {
    const start = listPositions[i];
    const end   = i + 1 < listPositions.length ? listPositions[i + 1] : start + 3000;
    const block = html.slice(start, Math.min(end, start + 3000));
    const allLabels = [...block.matchAll(/aria-label="([^"]{2,80})"/g)].map(m => m[1]);
    const teams: string[] = [];
    for (const lbl of allLabels) { if (!teams.length || teams[teams.length-1] !== lbl) teams.push(lbl); }
    const scores = [...block.matchAll(/brkts-matchlist-score[^>]+>[\s\S]*?<div class="brkts-matchlist-cell-content">(\d+)/g)].map(m => parseInt(m[1]));
    if (teams.length >= 2 && scores.length >= 2)
      listMatches.push({ teamA: teams[0], scoreA: scores[0], teamB: teams[teams.length-1], scoreB: scores[scores.length-1] });
  }

  const matches = bracketMatches.length > 0 ? bracketMatches : listMatches;

  // Also fetch wikitext for reference
  const wikiUrl = `${base}/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json`;
  const wikiRes = await fetch(wikiUrl, { headers, next: { revalidate: 0 } });
  const wikiData = await wikiRes.json() as { parse?: { wikitext?: { "*": string } } };
  const wikitext = wikiData.parse?.wikitext?.["*"] ?? "";

  return NextResponse.json({
    apiUrl,
    apiStatus: res.status,
    pageTitle,
    apiError,
    htmlLength: html.length,
    strategy: bracketMatches.length > 0 ? "brkts-bracket" : listMatches.length > 0 ? "brkts-matchlist" : "none",
    bracketMatchesFound: bracketMatches,
    listMatchesFound: listMatches,
    wikitextSnippet: wikitext.slice(0, 2000),
  });
}
