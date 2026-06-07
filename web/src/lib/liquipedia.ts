// Scraper Liquipedia — extrait les scores des matchs depuis une page HTML.
// Liquipedia utilise plusieurs formats selon le type de tournoi ; on essaie
// plusieurs sélecteurs CSS dans l'ordre jusqu'à trouver des résultats.

export interface ParsedResult {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
}

// Normalise un nom d'équipe pour la comparaison (casse, espaces, ponctuation).
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Retourne true si les deux noms d'équipe se correspondent (correspondance partielle tolérée).
function teamsMatch(dbName: string, scrapedName: string): boolean {
  const a = normalize(dbName);
  const b = normalize(scrapedName);
  return a === b || a.includes(b) || b.includes(a);
}

// ─── Stratégie 1 : format brkts (bracket Liquipedia moderne) ─────────────────
// <div class="brkts-match"> ... <div class="brkts-opponent"> ... </div> ... </div>
function parseBrkts(html: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  const matchRe = /<div[^>]*class="[^"]*brkts-match[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let m: RegExpExecArray | null;

  while ((m = matchRe.exec(html)) !== null) {
    const block = m[1];
    const opponents = [...block.matchAll(/<div[^>]*class="[^"]*brkts-opponent[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
    if (opponents.length < 2) continue;

    const extractName = (s: string) => {
      const nm = s.match(/class="[^"]*name[^"]*"[^>]*>([^<]+)</);
      return nm ? nm[1].trim() : "";
    };
    const extractScore = (s: string) => {
      const sc = s.match(/class="[^"]*score[^"]*"[^>]*>(\d+)</);
      return sc ? parseInt(sc[1]) : NaN;
    };

    const teamA = extractName(opponents[0][1]);
    const teamB = extractName(opponents[1][1]);
    const scoreA = extractScore(opponents[0][1]);
    const scoreB = extractScore(opponents[1][1]);

    if (teamA && teamB && !isNaN(scoreA) && !isNaN(scoreB)) {
      results.push({ teamA, teamB, scoreA, scoreB });
    }
  }

  return results;
}

// ─── Stratégie 2 : matchlist (tableaux de matchs Liquipedia) ─────────────────
// <table class="matchlist"> <tr> <td>Team A</td> <td>3</td> <td>:</td> <td>2</td> <td>Team B</td> </tr>
function parseMatchlist(html: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  // Cherche les patterns "NomEquipe ... SCORE:SCORE ... NomEquipe" dans les cellules de table
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;

  while ((m = rowRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c =>
      c[1].replace(/<[^>]+>/g, "").trim()
    );
    if (cells.length < 3) continue;

    // Cherche un pattern score "3:2" ou "3-2" dans les cellules
    for (let i = 0; i < cells.length; i++) {
      const scoreMatch = cells[i].match(/^(\d):(\d)$/) || cells[i].match(/^(\d)-(\d)$/);
      if (!scoreMatch) continue;
      const scoreA = parseInt(scoreMatch[1]);
      const scoreB = parseInt(scoreMatch[2]);
      if (isNaN(scoreA) || isNaN(scoreB)) continue;
      // L'équipe A est à gauche du score, B à droite
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

// ─── Stratégie 3 : regex générique sur le HTML brut ──────────────────────────
// Cherche les patterns "3 – 2" ou "3:2" entourés de noms d'équipes connus.
function parseGeneric(html: string, knownTeams: string[]): ParsedResult[] {
  const results: ParsedResult[] = [];
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const scoreRe = /(\d)\s*[:\-–]\s*(\d)/g;
  let m: RegExpExecArray | null;

  while ((m = scoreRe.exec(text)) !== null) {
    const scoreA = parseInt(m[1]);
    const scoreB = parseInt(m[2]);
    // Scores BO5 valides : l'un des deux doit être 3, l'autre entre 0 et 2
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

// ─── Point d'entrée ──────────────────────────────────────────────────────────

export async function fetchLiquipediaResults(
  url: string,
  knownTeams: string[]
): Promise<ParsedResult[]> {
  const res = await fetch(url, {
    headers: {
      // Liquipedia ToS : identifier l'app et fournir un contact
      "User-Agent": "eSportHUB-ScoreSync/1.0 (contact: bmaxime77@sfr.fr)",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Liquipedia fetch error: ${res.status}`);
  const html = await res.text();

  // Essaie les stratégies dans l'ordre, prend la première qui donne des résultats
  const strategies = [
    () => parseBrkts(html),
    () => parseMatchlist(html),
    () => parseGeneric(html, knownTeams),
  ];

  for (const strategy of strategies) {
    const results = strategy();
    if (results.length > 0) return results;
  }

  return [];
}

// Trouve le résultat parsé correspondant à un match DB (par noms d'équipes).
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
    // Liquipedia peut inverser l'ordre équipe A/B
    if (aMatchB && bMatchA) return { teamA: r.teamB, teamB: r.teamA, scoreA: r.scoreB, scoreB: r.scoreA };
  }
  return null;
}
