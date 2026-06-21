// Liquipedia CDL pages render match data client-side. The MediaWiki parse API
// returns server-rendered HTML with all match data embedded, bypassing JS rendering.
// Liquipedia requires Accept-Encoding: gzip for all API requests (per their ToS).

export interface ParsedResult {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function teamsMatch(dbName: string, scrapedName: string): boolean {
  const a = normalize(dbName);
  const b = normalize(scrapedName);
  return a === b || a.includes(b) || b.includes(a);
}

// Converts a Liquipedia page URL to the MediaWiki parse API endpoint.
// e.g. https://liquipedia.net/callofduty/Call_of_Duty_League/Season_7/Stage_4/Minor
//   → https://liquipedia.net/callofduty/api.php?action=parse&page=Call_of_Duty_League%2F...&prop=text&format=json
function toApiUrl(pageUrl: string): string {
  const m = pageUrl.match(/^(https?:\/\/liquipedia\.net\/[^/?#]+)\/(.+?)(?:\?.*)?$/);
  if (!m) throw new Error(`URL Liquipedia invalide : ${pageUrl}`);
  const [, base, rawPage] = m;
  const page = decodeURIComponent(rawPage); // normalise au cas où déjà encodée
  return `${base}/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&disablelimitreport=1`;
}

// ─── Stratégie principale : brkts (bracket Liquipedia) ───────────────────────
// Le HTML rendu par l'API contient des divs brkts-match avec :
//   - aria-label="Team Name" sur chaque opponent entry
//   - brkts-opponent-score-inner pour le score (parfois dans un <b> pour le gagnant)
function parseBrkts(html: string): ParsedResult[] {
  const results: ParsedResult[] = [];

  // Trouve toutes les positions des divs brkts-match
  const matchPositions: number[] = [];
  const divRe = /<div[^>]*class="[^"]*brkts-match[^"]*"/g;
  let dm: RegExpExecArray | null;
  while ((dm = divRe.exec(html)) !== null) {
    matchPositions.push(dm.index);
  }

  for (let i = 0; i < matchPositions.length; i++) {
    const start = matchPositions[i];
    // Délimite le bloc jusqu'au prochain brkts-match (ou +3KB)
    const end = i + 1 < matchPositions.length
      ? matchPositions[i + 1]
      : start + 3000;
    const block = html.slice(start, Math.min(end, start + 3000));

    // Noms d'équipes depuis aria-label
    const teams = [...block.matchAll(/aria-label="([^"]{2,80})"/g)].map(m => m[1]);
    // Scores depuis brkts-opponent-score-inner (avec ou sans <b> autour du nombre)
    const scores = [...block.matchAll(/brkts-opponent-score-inner[^>]*>(?:<b>)?(\d+)/g)].map(m => parseInt(m[1]));

    if (teams.length >= 2 && scores.length >= 2) {
      results.push({
        teamA: teams[0],
        teamB: teams[1],
        scoreA: scores[0],
        scoreB: scores[1],
      });
    }
  }

  return results;
}

// ─── Stratégie 2 : brkts-matchlist (format saison régulière CDL) ─────────────
// Structure : <div class="brkts-matchlist-match">
//   <div aria-label="Team A"> ... score A ... score B ... <div aria-label="Team B">
// Le score se trouve dans brkts-matchlist-score > brkts-matchlist-cell-content
function parseMatchlistBrkts(html: string): ParsedResult[] {
  const results: ParsedResult[] = [];

  const matchPositions: number[] = [];
  const divRe = /<div[^>]*class="[^"]*brkts-matchlist-match[^"]*"/g;
  let dm: RegExpExecArray | null;
  while ((dm = divRe.exec(html)) !== null) matchPositions.push(dm.index);

  for (let i = 0; i < matchPositions.length; i++) {
    const start = matchPositions[i];
    const end   = i + 1 < matchPositions.length ? matchPositions[i + 1] : start + 3000;
    const block = html.slice(start, Math.min(end, start + 3000));

    // aria-labels présents plusieurs fois (opponent + score div) → déduplique consécutifs
    const allLabels = [...block.matchAll(/aria-label="([^"]{2,80})"/g)].map(m => m[1]);
    const teams: string[] = [];
    for (const lbl of allLabels) {
      if (!teams.length || teams[teams.length - 1] !== lbl) teams.push(lbl);
    }

    // Scores dans les divs brkts-matchlist-score > brkts-matchlist-cell-content
    const scores = [...block.matchAll(
      /brkts-matchlist-score[^>]+>[\s\S]*?<div class="brkts-matchlist-cell-content">(\d+)/g
    )].map(m => parseInt(m[1]));

    if (teams.length >= 2 && scores.length >= 2) {
      results.push({
        teamA: teams[0],
        teamB: teams[teams.length - 1],
        scoreA: scores[0],
        scoreB: scores[scores.length - 1],
      });
    }
  }

  return results;
}

// ─── Stratégie 3 : matchlist HTML tabulaire (ancien format) ──────────────────
function parseMatchlist(html: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;

  while ((m = rowRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c =>
      c[1].replace(/<[^>]+>/g, "").trim()
    );
    if (cells.length < 3) continue;

    for (let i = 0; i < cells.length; i++) {
      const scoreMatch = cells[i].match(/^(\d):(\d)$/) || cells[i].match(/^(\d)-(\d)$/);
      if (!scoreMatch) continue;
      const scoreA = parseInt(scoreMatch[1]);
      const scoreB = parseInt(scoreMatch[2]);
      if (isNaN(scoreA) || isNaN(scoreB)) continue;
      const teamA = cells[i - 1];
      const teamB = cells[i + 1];
      if (teamA && teamB && /[a-zA-Z]/.test(teamA) && /[a-zA-Z]/.test(teamB)) {
        results.push({ teamA, teamB, scoreA, scoreB });
      }
      break;
    }
  }

  return results;
}

// ─── Stratégie 3 : regex générique sur le texte rendu ────────────────────────
function parseGeneric(html: string, knownTeams: string[]): ParsedResult[] {
  const results: ParsedResult[] = [];
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const scoreRe = /(\d)\s*[:\-–]\s*(\d)/g;
  let m: RegExpExecArray | null;

  while ((m = scoreRe.exec(text)) !== null) {
    const scoreA = parseInt(m[1]);
    const scoreB = parseInt(m[2]);
    if (!((scoreA === 3 && scoreB < 3) || (scoreB === 3 && scoreA < 3))) continue;

    const before = text.slice(Math.max(0, m.index - 80), m.index);
    const after  = text.slice(m.index + m[0].length, m.index + m[0].length + 80);

    let teamA = "", teamB = "";
    for (const t of knownTeams) {
      if (teamsMatch(t, before.slice(-t.length - 10))) teamA = t;
      if (teamsMatch(t, after.slice(0, t.length + 10)))  teamB = t;
    }
    if (teamA && teamB && teamA !== teamB) {
      results.push({ teamA, teamB, scoreA, scoreB });
    }
  }

  return results;
}

// ─── Extraction structure de bracket (wikitext) ───────────────────────────────

export interface BracketSlot {
  roundLabel: string;   // DB round_label
  slotIndex: number;    // 0-based dans le round
  teamA: string;
  teamB: string;
}

export interface RoundInfo {
  label: string;      // label d'affichage
  dbLabel: string;    // correspond au round_label en DB
  matchCount: number;
}

export interface BracketLayout {
  hasLowerBracket: boolean;
  isSingleElim: boolean;
  ubRounds: RoundInfo[];   // rounds Upper / Winners (sans GF si double élim)
  lbRounds: RoundInfo[];   // rounds Lower / Elimination (vide si single élim)
  grandFinalDbLabel: string | null;
}

export interface BracketData {
  layout: BracketLayout;
  slots: BracketSlot[];
}

// Labels CDL (double élim) → alignés avec liquipedia-import.ts
const UB_LABELS: Record<number, string> = {
  1: "Winners Round 1",
  2: "Winners Round 2",
  3: "Winners Final",
  4: "Grand Final",
};
const LB_LABELS: Record<number, string> = {
  1: "Elimination Round 1",
  2: "Elimination Round 2",
  3: "Elimination Round 3",
  4: "Elimination Finals",
};
// Labels single élim → alignés avec liquipedia-import.ts
const SINGLE_LABELS: Record<number, string> = {
  1: "Tour 1",
  2: "Quarts de finale",
  3: "Demi-finales",
  4: "Finale",
};

// Essaie de résoudre un shortcode d'équipe en nom complet
const TEAM_ABBR: Record<string, string> = {
  // CDL
  tx:   "OpTic Texas",     ryd:  "Riyadh Falcons",  bos:  "Boston Breach",
  g2m:  "G2 Minnesota",   lat:  "Los Angeles Thieves", pgm: "Paris Gentle Mates",
  car:  "Carolina Royal Ravens", fv: "FaZe Vegas",  tor:  "Toronto KOI",
  van:  "Vancouver Surge", mia:  "Miami Heretics",  c9ny: "Cloud9 New York",
  // VCT
  prx: "Paper Rex", vit: "Team Vitality", edg: "Edward Gaming",
  lev: "Leviatán",  fut: "FUT Esports",   xlg: "XLG",
  g2:  "G2 Esports", th: "Team Heretics", nrg: "NRG",
  ge:  "Gen.G",     drg: "DRG",           ful: "FULL SENSE",
};

function resolveTeam(abbr: string): string {
  return TEAM_ABBR[abbr.toLowerCase().trim()] ?? abbr.trim();
}

function parseBracketData(wikitext: string): BracketData {
  // 1. Compter les matchs par round (max M per R/L)
  const ubMatchCount: Record<number, number> = {};
  const lbMatchCount: Record<number, number> = {};

  for (const m of wikitext.matchAll(/\|R(\d+)M(\d+)\s*=/g)) {
    const r = parseInt(m[1]), n = parseInt(m[2]);
    ubMatchCount[r] = Math.max(ubMatchCount[r] ?? 0, n);
  }
  for (const m of wikitext.matchAll(/\|L(\d+)M(\d+)\s*=/g)) {
    const r = parseInt(m[1]), n = parseInt(m[2]);
    lbMatchCount[r] = Math.max(lbMatchCount[r] ?? 0, n);
  }

  const ubRoundNums = Object.keys(ubMatchCount).map(Number).sort((a, b) => a - b);
  const lbRoundNums = Object.keys(lbMatchCount).map(Number).sort((a, b) => a - b);
  const hasLB = lbRoundNums.length > 0;
  const isSingleElim = !hasLB;

  // 2. Identifier le Grand Final (double élim : dernier round UB avec 1 match)
  //    En single élim on n'a pas de GF séparé (dernière ronde = finale)
  let gfRound: number | null = null;
  let grandFinalDbLabel: string | null = null;
  if (hasLB) {
    // Double élim : le GF est le dernier R (généralement R avec 1 match après le WF)
    gfRound = ubRoundNums[ubRoundNums.length - 1];
    grandFinalDbLabel = UB_LABELS[gfRound] ?? `UB Round ${gfRound}`;
  }

  // 3. Construire ubRounds (hors GF pour double élim)
  const ubRoundsToShow = hasLB
    ? ubRoundNums.filter(r => r !== gfRound)
    : ubRoundNums;

  const ubRounds: RoundInfo[] = ubRoundsToShow.map(r => {
    const dbLabel = isSingleElim
      ? (SINGLE_LABELS[r] ?? `Round ${r}`)
      : (UB_LABELS[r] ?? `UB Round ${r}`);
    return { label: dbLabel, dbLabel, matchCount: ubMatchCount[r] };
  });

  // 4. LB rounds
  const lbRounds: RoundInfo[] = lbRoundNums.map(r => {
    const dbLabel = LB_LABELS[r] ?? `Elimination Round ${r}`;
    return { label: dbLabel, dbLabel, matchCount: lbMatchCount[r] };
  });

  // 5. Parser les slots (équipes dans chaque slot, y compris TBD)
  const slots: BracketSlot[] = [];
  const roundCounts: Record<string, number> = {};

  const lines = wikitext.split("\n");
  let charPos = 0;
  const positions: number[] = [];
  const ctxs: Array<{ dbLabel: string }> = [];

  for (const line of lines) {
    const ubM = line.match(/\|R(\d+)M(\d+)\s*=\s*\{\{Match/);
    if (ubM) {
      const r = parseInt(ubM[1]);
      const dbLabel = r === gfRound
        ? (grandFinalDbLabel ?? "Grand Final")
        : isSingleElim
          ? (SINGLE_LABELS[r] ?? `Round ${r}`)
          : (UB_LABELS[r] ?? `UB Round ${r}`);
      positions.push(charPos);
      ctxs.push({ dbLabel });
    }
    const lbM = line.match(/\|L(\d+)M(\d+)\s*=\s*\{\{Match/);
    if (lbM) {
      const r = parseInt(lbM[1]);
      const dbLabel = LB_LABELS[r] ?? `Elimination Round ${r}`;
      positions.push(charPos);
      ctxs.push({ dbLabel });
    }
    charPos += line.length + 1;
  }

  for (let pi = 0; pi < positions.length; pi++) {
    const start = positions[pi];
    const end   = pi + 1 < positions.length ? positions[pi + 1] : wikitext.length;
    const block = wikitext.slice(start, Math.min(end, start + 2000));
    const { dbLabel } = ctxs[pi];

    const t1 = block.match(/\|opponent1=\{\{TeamOpponent\|([^|}]+)/);
    const t2 = block.match(/\|opponent2=\{\{TeamOpponent\|([^|}]+)/);

    const idx = roundCounts[dbLabel] ?? 0;
    roundCounts[dbLabel] = idx + 1;

    slots.push({
      roundLabel: dbLabel,
      slotIndex: idx,
      teamA: t1 ? resolveTeam(t1[1]) : "TBD",
      teamB: t2 ? resolveTeam(t2[1]) : "TBD",
    });
  }

  return {
    layout: { hasLowerBracket: hasLB, isSingleElim, ubRounds, lbRounds, grandFinalDbLabel },
    slots,
  };
}

// Convertit une URL Liquipedia en URL API wikitext
function toWikitextApiUrl(pageUrl: string): string {
  const m = pageUrl.match(/^(https?:\/\/liquipedia\.net\/[^/?#]+)\/(.+?)(?:\?.*)?$/);
  if (!m) throw new Error(`URL Liquipedia invalide : ${pageUrl}`);
  const [, base, rawPage] = m;
  return `${base}/api.php?action=parse&page=${encodeURIComponent(decodeURIComponent(rawPage))}&prop=wikitext&format=json&disablelimitreport=1`;
}

export async function fetchBracketData(url: string): Promise<BracketData> {
  const apiUrl = toWikitextApiUrl(url);

  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": "eSportHUB-BracketSync/1.0 (contact: bmaxime77@sfr.fr)",
      "Accept-Encoding": "gzip",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`Liquipedia API ${res.status}`);

  const data = await res.json() as {
    parse?: { wikitext?: { "*": string } };
    error?: { code: string; info: string };
  };

  if (data.error) throw new Error(`Liquipedia API erreur (${data.error.code}): ${data.error.info}`);
  if (!data.parse?.wikitext?.["*"]) throw new Error("Liquipedia API: wikitext vide");

  return parseBracketData(data.parse.wikitext["*"]);
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────

export async function fetchLiquipediaResults(
  url: string,
  knownTeams: string[]
): Promise<ParsedResult[]> {
  const apiUrl = toApiUrl(url);

  const res = await fetch(apiUrl, {
    headers: {
      // Liquipedia ToS : identifier l'app, fournir un contact, et activer la compression gzip
      "User-Agent": "eSportHUB-ScoreSync/1.0 (contact: bmaxime77@sfr.fr)",
      "Accept-Encoding": "gzip",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Liquipedia API ${res.status}: ${await res.text().catch(() => "")}`);

  const data = await res.json() as {
    parse?: { text?: { "*": string } };
    error?: { code: string; info: string };
  };

  if (data.error) {
    throw new Error(`Liquipedia API erreur (${data.error.code}): ${data.error.info}`);
  }
  if (!data.parse?.text?.["*"]) {
    throw new Error("Liquipedia API: réponse vide (pas de contenu HTML)");
  }

  const html = data.parse.text["*"];

  const strategies = [
    () => parseBrkts(html),           // brackets (Minor, Major)
    () => parseMatchlistBrkts(html),  // matchlists (saison régulière Stage 4)
    () => parseMatchlist(html),       // tableaux HTML classiques
    () => parseGeneric(html, knownTeams),
  ];

  for (const strategy of strategies) {
    const results = strategy();
    if (results.length > 0) return results;
  }

  return [];
}

// Trouve le résultat correspondant à un match DB (par noms d'équipes).
export function findResult(
  parsed: ParsedResult[],
  teamA: string,
  teamB: string
): ParsedResult | null {
  for (const r of parsed) {
    const aMatchA = teamsMatch(teamA, r.teamA);
    const bMatchB = teamsMatch(teamB, r.teamB);
    const aMatchB = teamsMatch(teamA, r.teamB);
    const bMatchA = teamsMatch(teamB, r.teamA);

    if (aMatchA && bMatchB) return r;
    // Liquipedia peut avoir l'ordre inversé
    if (aMatchB && bMatchA) return { teamA: r.teamB, teamB: r.teamA, scoreA: r.scoreB, scoreB: r.scoreA };
  }
  return null;
}
