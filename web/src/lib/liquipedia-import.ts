// Import de matchs depuis les wikitexts Liquipedia.
// Gère deux formats : Matchlist (saison régulière) et Bracket (Minor/Major).

export interface ImportedMatch {
  scheduledAt: string;   // ISO UTC
  teamA: string;         // nom complet
  teamB: string;
  roundLabel: string;    // "Semaine 1 · Jour 1" ou "Quarts de finale"
  matchKey: string;      // clé unique stable (CDL game ID ou généré)
}

// Décalages UTC des fuseaux horaires Liquipedia les plus courants
const TZ_OFFSETS: Record<string, number> = {
  EDT: -4, EST: -5,
  CDT: -5, CST: -6,
  MDT: -6, MST: -7,
  PDT: -7, PST: -8,
  UTC: 0,  GMT: 0,
  CET: 1,  CEST: 2,
  BST: 1,
};

// Table des abréviations CDL 2026 → nom complet
const CDL_ABBR: Record<string, string> = {
  tx:   "OpTic Texas",
  ryd:  "Riyadh Falcons",
  bos:  "Boston Breach",
  g2m:  "G2 Minnesota",
  lat:  "Los Angeles Thieves",
  pgm:  "Paris Gentle Mates",
  car:  "Carolina Royal Ravens",
  fv:   "FaZe Vegas",
  tor:  "Toronto KOI",
  van:  "Vancouver Surge",
  mia:  "Miami Heretics",
  c9ny: "Cloud9 New York",
};

// Libellés de rounds pour bracket simple élimination
const SINGLE_ROUND_LABELS: Record<number, string> = {
  1: "Tour 1",
  2: "Quarts de finale",
  3: "Demi-finales",
  4: "Finale",
};

// Libellés Upper/Winners Bracket pour double élimination (CDL Playoffs)
const UB_ROUND_LABELS: Record<number, string> = {
  1: "Winners Round 1",
  2: "Winners Round 2",
  3: "Winners Final",
  4: "Grand Final",
};

// Libellés Lower/Elimination Bracket pour double élimination
const LB_ROUND_LABELS: Record<number, string> = {
  1: "Elimination Round 1",
  2: "Elimination Round 2",
  3: "Elimination Round 3",
  4: "Elimination Finals",
};

function toISO(dateStr: string, timeStr: string, tz: string): string {
  const offH = TZ_OFFSETS[tz.toUpperCase()] ?? 0;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  // Soustrait l'offset pour convertir en UTC
  return new Date(Date.UTC(y, mo - 1, d, h - offH, mi || 0)).toISOString();
}

function resolveTeam(abbr: string): string {
  return CDL_ABBR[abbr.toLowerCase().trim()] ?? abbr.trim();
}

export function parseWikitextMatches(
  wikitext: string,
  tournamentSlug: string
): ImportedMatch[] {
  const results: ImportedMatch[] = [];
  const isBracket    = /\{\{Bracket/.test(wikitext);
  // Double élimination détectée si on trouve des matchs Lower Bracket (|L{n}M{m}=)
  const isDoubleElim = isBracket && /\|L\d+M\d+\s*=\s*\{\{Match/.test(wikitext);

  // Parcourt le wikitext ligne par ligne en maintenant le contexte
  const lines = wikitext.split("\n");
  let charPos = 0;
  let weekNum = 0, dayNum = 0, matchInDay = 0;

  // Positions des débuts de blocs {{Match et leur contexte
  const positions: number[] = [];
  const contexts: Array<{
    weekNum: number; dayNum: number; matchInDay: number; roundNum: number;
    isLower?: boolean;   // true pour les rounds Lower Bracket (|L{n}M{m}=)
  }> = [];

  for (const line of lines) {
    // ── Contexte semaine (format matchlist) ─────────────────────────────────
    const wm = line.match(/\{\{HiddenSort\|Week\s+(\d+)\}\}/);
    if (wm) { weekNum = parseInt(wm[1]); dayNum = 0; matchInDay = 0; }

    // ── Contexte jour (format matchlist) ────────────────────────────────────
    const dm = line.match(/\|M\d+header\s*=\s*Day\s+(\d+)/i);
    if (dm) { dayNum = parseInt(dm[1]); matchInDay = 0; }

    // ── Début de match : format matchlist  |M12={{Match ────────────────────
    if (/\|M\d+\s*=\s*\{\{Match/.test(line)) {
      matchInDay++;
      positions.push(charPos);
      contexts.push({ weekNum, dayNum, matchInDay, roundNum: 0 });
    }

    // ── Début de match : bracket Upper  |R2M3={{Match ───────────────────────
    const bm = line.match(/\|R(\d+)M(\d+)\s*=\s*\{\{Match/);
    if (bm) {
      positions.push(charPos);
      contexts.push({
        weekNum: 0, dayNum: 0,
        matchInDay: parseInt(bm[2]),
        roundNum: parseInt(bm[1]),
      });
    }

    // ── Début de match : bracket Lower  |L2M1={{Match ───────────────────────
    const lm = line.match(/\|L(\d+)M(\d+)\s*=\s*\{\{Match/);
    if (lm) {
      positions.push(charPos);
      contexts.push({
        weekNum: 0, dayNum: 0,
        matchInDay: parseInt(lm[2]),
        roundNum: parseInt(lm[1]),
        isLower: true,
      });
    }

    charPos += line.length + 1;
  }

  // Extrait chaque bloc Match et parse son contenu
  for (let pi = 0; pi < positions.length; pi++) {
    const start = positions[pi];
    const end = pi + 1 < positions.length ? positions[pi + 1] : wikitext.length;
    const block = wikitext.slice(start, Math.min(end, start + 2000));
    const ctx   = contexts[pi];

    // Date/heure : "2026-06-14 - 15:00 {{Abbr/EDT}}" ou "2026-06-14 13:00 {{abbr/MDT}}"
    const dateM = block.match(
      /\|date=(\d{4}-\d{2}-\d{2})\s*-?\s*(\d{1,2}:\d{2})\s*\{\{[Aa]bbr\/(\w+)\}\}/
    );

    // Équipes
    const t1M = block.match(/\|opponent1=\{\{TeamOpponent\|([^|}]+)/);
    const t2M = block.match(/\|opponent2=\{\{TeamOpponent\|([^|}]+)/);

    if (!dateM || !t1M || !t2M) continue;

    const teamA = resolveTeam(t1M[1]);
    const teamB = resolveTeam(t2M[1]);

    // Ignore les matchs TBD
    if (/^tbd$/i.test(teamA) || /^tbd$/i.test(teamB)) continue;

    // Clé unique : CDL game ID > Breakingpoint ID > généré
    const cdlId = block.match(/\|cdl=(\d+)/)?.[1];
    const bpId  = block.match(/\|breakingpoint=(\d+)/)?.[1];
    const prefix = ctx.isLower ? "l" : "r";
    const matchKey = cdlId  ? `lp-cdl-${cdlId}`
                   : bpId   ? `lp-bp-${bpId}`
                   : isBracket
                   ? `${tournamentSlug}-${prefix}${ctx.roundNum}m${ctx.matchInDay}`
                   : `${tournamentSlug}-w${ctx.weekNum}d${ctx.dayNum}-${ctx.matchInDay}`;

    let roundLabel: string;
    if (!isBracket) {
      roundLabel = `Semaine ${ctx.weekNum} · Jour ${ctx.dayNum}`;
    } else if (ctx.isLower) {
      roundLabel = LB_ROUND_LABELS[ctx.roundNum] ?? `LB Round ${ctx.roundNum}`;
    } else if (isDoubleElim) {
      roundLabel = UB_ROUND_LABELS[ctx.roundNum] ?? `UB Round ${ctx.roundNum}`;
    } else {
      roundLabel = SINGLE_ROUND_LABELS[ctx.roundNum] ?? `Round ${ctx.roundNum}`;
    }

    results.push({
      scheduledAt: toISO(dateM[1], dateM[2], dateM[3]),
      teamA,
      teamB,
      roundLabel,
      matchKey,
    });
  }

  return results;
}
