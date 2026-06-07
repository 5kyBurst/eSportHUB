"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
type Team = { color: string; abbr: string };
type ScoreInput = { score1: string; score2: string };
type CompletedMatch = { id: number; team1: string; team2: string; winner: string; score: string };
type UpcomingMatch  = { id: number; team1: string; team2: string };
type AnyMatch = CompletedMatch | UpcomingMatch;

const isCompleted = (m: AnyMatch): m is CompletedMatch => "winner" in m;

function getResult(p?: ScoreInput): { winner: "team1" | "team2"; label: string } | null {
  if (!p) return null;
  const n1 = parseInt(p.score1), n2 = parseInt(p.score2);
  if (isNaN(n1) || isNaN(n2)) return null;
  if (n1 === 3 && n2 >= 0 && n2 <= 2) return { winner: "team1", label: `${n1} – ${n2}` };
  if (n2 === 3 && n1 >= 0 && n1 <= 2) return { winner: "team2", label: `${n1} – ${n2}` };
  return null;
}

function getPoints(match: CompletedMatch, p: ScoreInput): 0 | 3 | 5 {
  const [os1, os2] = match.score.split("-").map(Number);
  const ps1 = parseInt(p.score1), ps2 = parseInt(p.score2);
  if (isNaN(ps1) || isNaN(ps2)) return 0;
  if (ps1 === os1 && ps2 === os2) return 5;
  const oWin = os1 > os2 ? "t1" : "t2";
  const pWin = ps1 > ps2 ? "t1" : ps2 > ps1 ? "t2" : null;
  if (pWin === oWin) return 3;
  return 0;
}

// Prédictions simulées pour la Semaine 1 (pour démonstration)
// +5 = score exact · +3 = vainqueur correct score différent
const WEEK1_PREDICTIONS: Record<number, ScoreInput> = {
  1:  { score1: "0", score2: "3" }, // TOR 0-3 CAR  → prédit 0-3  → exact       +5
  2:  { score1: "3", score2: "2" }, // G2  3-1 C9   → prédit 3-2  → winner +3
  3:  { score1: "1", score2: "3" }, // VAN 0-3 TX   → prédit 1-3  → winner +3
  4:  { score1: "3", score2: "2" }, // LAT 3-2 VGS  → prédit 3-2  → exact       +5
  5:  { score1: "3", score2: "0" }, // PAR 3-0 CAR  → prédit 3-0  → exact       +5
  6:  { score1: "0", score2: "3" }, // VAN 2-3 BOS  → prédit 0-3  → winner +3
  7:  { score1: "3", score2: "1" }, // RYD 3-2 MIA  → prédit 3-1  → winner +3
  8:  { score1: "3", score2: "0" }, // RYD 3-0 PAR  → prédit 3-0  → exact       +5
  9:  { score1: "3", score2: "0" }, // TX  3-0 MIA  → prédit 3-0  → exact       +5
  10: { score1: "2", score2: "3" }, // C9  1-3 BOS  → prédit 2-3  → winner +3
}; // total = 5×5 + 5×3 = 40 pts

// ─── Teams ────────────────────────────────────────────────────────────────────
const TEAMS: Record<string, Team> = {
  "OpTic Texas":           { color: "#4FAF47", abbr: "TX"  },
  "Riyadh Falcons":        { color: "#00A550", abbr: "RYD" },
  "Boston Breach":         { color: "#C8102E", abbr: "BOS" },
  "G2 Minnesota":          { color: "#F6C31C", abbr: "MIN" },
  "Los Angeles Thieves":   { color: "#EF3726", abbr: "LAT" },
  "Paris Gentle Mates":    { color: "#E60045", abbr: "PAR" },
  "Carolina Royal Ravens": { color: "#7B2FBE", abbr: "CAR" },
  "FaZe Vegas":            { color: "#FF3333", abbr: "VGS" },
  "Toronto KOI":           { color: "#00BDB1", abbr: "TOR" },
  "Vancouver Surge":       { color: "#0077B5", abbr: "VAN" },
  "Miami Heretics":        { color: "#009FE3", abbr: "MIA" },
  "Cloud9 New York":       { color: "#1B8DC4", abbr: "NY"  },
};

// ─── Standings ────────────────────────────────────────────────────────────────
const STANDINGS = [
  { rank: 1,  team: "OpTic Texas",           w: 2, l: 0, mw: 6, ml: 0, diff: +6, pts: 20 },
  { rank: 2,  team: "Riyadh Falcons",        w: 2, l: 0, mw: 6, ml: 2, diff: +4, pts: 20 },
  { rank: 3,  team: "Boston Breach",         w: 2, l: 0, mw: 6, ml: 3, diff: +3, pts: 20 },
  { rank: 4,  team: "G2 Minnesota",          w: 1, l: 0, mw: 3, ml: 1, diff: +2, pts: 10 },
  { rank: 5,  team: "Los Angeles Thieves",   w: 1, l: 0, mw: 3, ml: 2, diff: +1, pts: 10 },
  { rank: 6,  team: "Paris Gentle Mates",    w: 1, l: 1, mw: 3, ml: 3, diff:  0, pts: 10 },
  { rank: 7,  team: "Carolina Royal Ravens", w: 1, l: 1, mw: 3, ml: 3, diff:  0, pts: 10 },
  { rank: 8,  team: "FaZe Vegas",            w: 0, l: 1, mw: 2, ml: 3, diff: -1, pts:  0 },
  { rank: 9,  team: "Toronto KOI",           w: 0, l: 1, mw: 0, ml: 3, diff: -3, pts:  0 },
  { rank: 10, team: "Cloud9 New York",       w: 0, l: 2, mw: 2, ml: 6, diff: -4, pts:  0 },
  { rank: 10, team: "Miami Heretics",        w: 0, l: 2, mw: 2, ml: 6, diff: -4, pts:  0 },
  { rank: 10, team: "Vancouver Surge",       w: 0, l: 2, mw: 2, ml: 6, diff: -4, pts:  0 },
];

// ─── Schedule ─────────────────────────────────────────────────────────────────
const WEEKS = [
  {
    label: "Semaine 1", done: true,
    days: [
      {
        label: "Jour 1 — 29 Mai", lockTime: "2026-05-29T17:00:00Z",
        matches: [
          { id: 1,  team1: "Toronto KOI",        team2: "Carolina Royal Ravens", winner: "Carolina Royal Ravens", score: "0-3" },
          { id: 2,  team1: "G2 Minnesota",        team2: "Cloud9 New York",       winner: "G2 Minnesota",          score: "3-1" },
          { id: 3,  team1: "Vancouver Surge",     team2: "OpTic Texas",           winner: "OpTic Texas",           score: "0-3" },
        ] as AnyMatch[],
      },
      {
        label: "Jour 2 — 30 Mai", lockTime: "2026-05-30T17:00:00Z",
        matches: [
          { id: 4,  team1: "Los Angeles Thieves", team2: "FaZe Vegas",            winner: "Los Angeles Thieves",   score: "3-2" },
          { id: 5,  team1: "Paris Gentle Mates",  team2: "Carolina Royal Ravens", winner: "Paris Gentle Mates",    score: "3-0" },
          { id: 6,  team1: "Vancouver Surge",     team2: "Boston Breach",         winner: "Boston Breach",         score: "2-3" },
          { id: 7,  team1: "Riyadh Falcons",      team2: "Miami Heretics",        winner: "Riyadh Falcons",        score: "3-2" },
        ] as AnyMatch[],
      },
      {
        label: "Jour 3 — 31 Mai", lockTime: "2026-05-31T17:00:00Z",
        matches: [
          { id: 8,  team1: "Riyadh Falcons",      team2: "Paris Gentle Mates",   winner: "Riyadh Falcons",        score: "3-0" },
          { id: 9,  team1: "OpTic Texas",         team2: "Miami Heretics",       winner: "OpTic Texas",           score: "3-0" },
          { id: 10, team1: "Cloud9 New York",     team2: "Boston Breach",        winner: "Boston Breach",         score: "1-3" },
        ] as AnyMatch[],
      },
    ],
  },
  {
    label: "Semaine 2", done: false,
    days: [
      {
        label: "Jour 1 — 11 Juin", lockTime: "2026-06-11T17:00:00Z",
        matches: [
          { id: 11, team1: "OpTic Texas",         team2: "G2 Minnesota"          },
          { id: 12, team1: "Paris Gentle Mates",  team2: "FaZe Vegas"            },
          { id: 13, team1: "Los Angeles Thieves", team2: "Boston Breach"         },
        ] as AnyMatch[],
      },
      {
        label: "Jour 2 — 12 Juin", lockTime: "2026-06-12T17:00:00Z",
        matches: [
          { id: 14, team1: "Toronto KOI",         team2: "Boston Breach"         },
          { id: 15, team1: "OpTic Texas",         team2: "Carolina Royal Ravens" },
          { id: 16, team1: "Miami Heretics",      team2: "FaZe Vegas"            },
          { id: 17, team1: "Los Angeles Thieves", team2: "G2 Minnesota"          },
        ] as AnyMatch[],
      },
      {
        label: "Jour 3 — 13 Juin", lockTime: "2026-06-13T17:00:00Z",
        matches: [
          { id: 18, team1: "Toronto KOI",         team2: "Cloud9 New York"       },
          { id: 19, team1: "Vancouver Surge",     team2: "Paris Gentle Mates"    },
          { id: 20, team1: "Riyadh Falcons",      team2: "Carolina Royal Ravens" },
        ] as AnyMatch[],
      },
    ],
  },
  {
    label: "Semaine 3", done: false,
    days: [
      {
        label: "Jour 1 — 18 Juin", lockTime: "2026-06-18T17:00:00Z",
        matches: [
          { id: 21, team1: "Riyadh Falcons",      team2: "FaZe Vegas"            },
          { id: 22, team1: "Los Angeles Thieves", team2: "Cloud9 New York"       },
          { id: 23, team1: "Paris Gentle Mates",  team2: "Boston Breach"         },
        ] as AnyMatch[],
      },
      {
        label: "Jour 2 — 19 Juin", lockTime: "2026-06-19T17:00:00Z",
        matches: [
          { id: 24, team1: "Miami Heretics",      team2: "Cloud9 New York"       },
          { id: 25, team1: "Vancouver Surge",     team2: "Los Angeles Thieves"   },
          { id: 26, team1: "Toronto KOI",         team2: "OpTic Texas"           },
          { id: 27, team1: "Riyadh Falcons",      team2: "G2 Minnesota"          },
        ] as AnyMatch[],
      },
      {
        label: "Jour 3 — 20 Juin", lockTime: "2026-06-20T17:00:00Z",
        matches: [
          { id: 28, team1: "Vancouver Surge",     team2: "Miami Heretics"        },
          { id: 29, team1: "Toronto KOI",         team2: "G2 Minnesota"          },
          { id: 30, team1: "FaZe Vegas",          team2: "Carolina Royal Ravens" },
        ] as AnyMatch[],
      },
    ],
  },
];

function isDayLocked(lockTime: string) {
  return new Date() >= new Date(lockTime);
}

// ─── ScoreBox ─────────────────────────────────────────────────────────────────
function ScoreBox({
  value, onChange, color, side, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  color: string;
  side: "left" | "right";
  disabled?: boolean;
}) {
  const filled = value !== "";
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={1}
      value={value}
      disabled={disabled}
      placeholder="–"
      onChange={e => {
        const v = e.target.value;
        if (v === "" || /^[0-3]$/.test(v)) onChange(v);
      }}
      style={{
        width: 38, height: 38, flexShrink: 0,
        textAlign: "center",
        fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 20,
        background: filled ? `${color}18` : "var(--bg2)",
        border: `1px solid ${filled ? color + "66" : "var(--border2)"}`,
        borderRadius: 8,
        color: filled ? color : "var(--text3)",
        outline: "none",
        cursor: disabled ? "default" : "text",
        transition: "all 0.15s",
        caretColor: color,
      }}
    />
  );
}

// ─── MatchCard ─────────────────────────────────────────────────────────────────
function MatchCard({
  match, prediction, locked,
  onChange,
}: {
  match: AnyMatch;
  prediction?: ScoreInput;
  locked: boolean;
  onChange?: (p: ScoreInput) => void;
}) {
  const done = isCompleted(match);
  const t1 = TEAMS[match.team1] ?? { color: "#7082A8", abbr: "?" };
  const t2 = TEAMS[match.team2] ?? { color: "#7082A8", abbr: "?" };

  // Official result (only for completed matches)
  let officialLabel: string | null = null;
  let officialWinner: "team1" | "team2" | null = null;
  let pts: 0 | 3 | 5 | -1 = -1; // -1 = pas de prédiction
  if (done) {
    const c = match as CompletedMatch;
    const [s1, s2] = c.score.split("-").map(Number);
    officialLabel = `${s1} – ${s2}`;
    officialWinner = s1 > s2 ? "team1" : "team2";
    if (prediction) pts = getPoints(c, prediction);
  }

  const winColor = officialWinner === "team1" ? t1.color : officialWinner === "team2" ? t2.color : "var(--text2)";
  const isDisabled = done || locked;
  const accentColor = pts === 5 ? "#36D399" : pts === 3 ? "#F5C842" : pts === 0 ? "#F87171" : null;

  return (
    <div style={{
      display: "flex", position: "relative",
      border: accentColor ? `1px solid ${accentColor}44` : "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden",
      opacity: done ? 0.72 : 1,
      transition: "opacity 0.2s",
    }}>
      {/* Barre accent gauche */}
      {accentColor && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: accentColor, zIndex: 1, pointerEvents: "none",
        }} />
      )}

      {/* ── Team 1 side ── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 8,
        padding: `11px 10px 11px ${accentColor ? "17px" : "14px"}`,
        background: officialWinner === "team1" ? `${t1.color}12` : "var(--surface)",
        borderRight: "1px solid var(--border)",
        transition: "background 0.2s",
        minWidth: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
          background: `${t1.color}22`,
          border: `1px solid ${officialWinner === "team1" ? t1.color + "77" : t1.color + "33"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 10, color: t1.color,
        }}>{t1.abbr}</div>
        <span style={{
          fontFamily: "var(--font-head)", fontWeight: 700,
          fontSize: "clamp(10px, 2vw, 13px)",
          color: officialWinner === "team1" ? t1.color : officialWinner === "team2" ? "var(--text3)" : "var(--text)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          transition: "color 0.2s",
        }}>{match.team1}</span>
        <ScoreBox
          value={prediction?.score1 ?? ""}
          color={t1.color}
          side="left"
          disabled={isDisabled}
          onChange={v => onChange?.({ score1: v, score2: prediction?.score2 ?? "" })}
        />
      </div>

      {/* ── Center — officiel seulement ── */}
      {officialLabel && (
        <div style={{
          flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 2, padding: "8px 14px",
          background: "var(--surface2)",
          borderLeft: "1px solid var(--border)",
          borderRight: "1px solid var(--border)",
        }}>
          <span style={{
            fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 17,
            color: winColor, letterSpacing: 2, whiteSpace: "nowrap",
          }}>{officialLabel}</span>
          <span style={{
            fontSize: 8, color: winColor, opacity: 0.55,
            fontFamily: "var(--font-head)", letterSpacing: 1, textTransform: "uppercase",
          }}>officiel</span>
          {/* Badge points */}
          {pts >= 0 && (
            <div style={{
              marginTop: 3,
              padding: "1px 7px", borderRadius: 5,
              background: accentColor ? `${accentColor}20` : "transparent",
              border: `1px solid ${accentColor ?? "var(--border)"}55`,
              fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 12,
              color: accentColor ?? "var(--text3)",
              whiteSpace: "nowrap",
              letterSpacing: 0.5,
            }}>
              {`+${pts} pts`}
            </div>
          )}
        </div>
      )}

      {/* ── Team 2 side ── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", flexDirection: "row-reverse", gap: 8,
        padding: "11px 14px 11px 10px",
        background: officialWinner === "team2" ? `${t2.color}12` : "var(--surface)",
        transition: "background 0.2s",
        minWidth: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
          background: `${t2.color}22`,
          border: `1px solid ${officialWinner === "team2" ? t2.color + "77" : t2.color + "33"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 10, color: t2.color,
        }}>{t2.abbr}</div>
        <span style={{
          fontFamily: "var(--font-head)", fontWeight: 700,
          fontSize: "clamp(10px, 2vw, 13px)",
          color: officialWinner === "team2" ? t2.color : officialWinner === "team1" ? "var(--text3)" : "var(--text)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right",
          transition: "color 0.2s",
        }}>{match.team2}</span>
        <ScoreBox
          value={prediction?.score2 ?? ""}
          color={t2.color}
          side="right"
          disabled={isDisabled}
          onChange={v => onChange?.({ score1: prediction?.score1 ?? "", score2: v })}
        />
      </div>

    </div>
  );
}

// match_key = "cdl26s4-" + id.toString().padStart(3, "0")
function matchKey(id: number) {
  return `cdl26s4-${String(id).padStart(3, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CDLPredictPage() {
  const [predictions, setPredictions] = useState<Record<number, ScoreInput>>(WEEK1_PREDICTIONS);
  const [activeWeek, setActiveWeek] = useState(1);
  const [showStandings, setShowStandings] = useState(false);
  const [validated, setValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Supabase — charge les prédictions existantes au montage
  useEffect(() => {
    const supabase = createClient();

    async function loadPredictions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupère les UUID des matchs CDL S4 via leurs match_key
      const keys = Array.from({ length: 30 }, (_, i) => matchKey(i + 1));
      const { data: matchRows } = await supabase
        .from("matches")
        .select("id, match_key")
        .in("match_key", keys);

      if (!matchRows?.length) return;

      // Carte match_key → uuid et uuid → local id
      const keyToUuid: Record<string, string> = {};
      const uuidToLocalId: Record<string, number> = {};
      matchRows.forEach(r => {
        keyToUuid[r.match_key] = r.id;
        const localId = parseInt(r.match_key.replace("cdl26s4-", ""));
        uuidToLocalId[r.id] = localId;
      });

      // Charge les prédictions de l'utilisateur
      const { data: predRows } = await supabase
        .from("predictions")
        .select("match_id, score_a, score_b")
        .eq("user_id", user.id)
        .in("match_id", Object.values(keyToUuid));

      if (predRows?.length) {
        setPredictions(prev => {
          const next = { ...prev };
          predRows.forEach(p => {
            const localId = uuidToLocalId[p.match_id];
            if (localId && localId > 10) { // uniquement les matchs à venir
              next[localId] = {
                score1: p.score_a.toString(),
                score2: p.score_b.toString(),
              };
            }
          });
          return next;
        });
      }
    }

    loadPredictions();
  }, []);

  function handleChange(matchId: number, p: ScoreInput) {
    setPredictions(prev => ({ ...prev, [matchId]: p }));
    setValidated(false);
    setSaveError(null);
  }

  const handleValidate = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveError("Non connecté"); setSaving(false); return; }

    // Récupère les UUID des matchs à venir
    const upcomingIds = Array.from({ length: 20 }, (_, i) => matchKey(i + 11));
    const { data: matchRows, error: matchFetchError } = await supabase
      .from("matches")
      .select("id, match_key")
      .in("match_key", upcomingIds);

    if (matchFetchError || !matchRows?.length) {
      setSaveError(
        matchFetchError
          ? `Erreur Supabase : ${matchFetchError.message} (code: ${matchFetchError.code})`
          : "Matchs introuvables en base — as-tu exécuté cdl_s4_seed.sql ?"
      );
      setSaving(false);
      return;
    }

    const keyToUuid: Record<string, string> = {};
    matchRows.forEach(r => { keyToUuid[r.match_key] = r.id; });

    // Construit les upserts pour les prédictions complètes uniquement
    const upserts = Object.entries(predictions)
      .filter(([id]) => parseInt(id) > 10)
      .filter(([, p]) => getResult(p) !== null)
      .map(([id, p]) => {
        const uuid = keyToUuid[matchKey(parseInt(id))];
        if (!uuid) return null;
        return {
          user_id: user.id,
          match_id: uuid,
          score_a: parseInt(p.score1),
          score_b: parseInt(p.score2),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (upserts.length === 0) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("predictions")
      .upsert(upserts, { onConflict: "user_id,match_id" });

    if (error) {
      setSaveError(error.message);
    } else {
      setValidated(true);
    }
    setSaving(false);
  }, [predictions]);

  // Points gagnés en Semaine 1
  const week1Points = WEEKS[0].days
    .flatMap(d => d.matches)
    .filter(isCompleted)
    .reduce((sum, m) => {
      const p = predictions[m.id];
      return sum + (p ? getPoints(m, p) : 0);
    }, 0);

  const now  = new Date();
  const week = WEEKS[activeWeek];

  const allUpcoming = WEEKS.slice(1).flatMap(w => w.days).flatMap(d => d.matches);
  const totalUpcoming  = allUpcoming.length;
  const totalPredicted = Object.entries(predictions)
    .filter(([id]) => parseInt(id) > 10)
    .filter(([, p]) => getResult(p) !== null).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-10 py-8 sm:py-12">

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/predict" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "var(--font-head)", fontSize: 12, fontWeight: 700,
          color: "var(--text3)", textDecoration: "none", textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 16,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9.5 6H2.5M5.5 3L2.5 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Prédictions
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <img src="/logos/cdl.png" alt="CDL" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: "var(--font-head)", fontSize: "clamp(20px, 5vw, 30px)",
              fontWeight: 900, color: "var(--text)", letterSpacing: 1, textTransform: "uppercase", lineHeight: 1,
            }}>CDL 2026 — Stage 4</h1>
            <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 4, fontFamily: "var(--font-head)", letterSpacing: 0.5 }}>
              Major Qualifiers · 29 Mai – 21 Juin 2026 · BO5
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {/* Points S1 */}
            <div style={{
              background: "#36D39910", border: "1px solid #36D39940",
              borderRadius: 8, padding: "6px 14px", textAlign: "center",
            }}>
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 20, color: "#36D399", lineHeight: 1 }}>
                +{week1Points}
              </div>
              <div style={{ fontSize: 9, color: "#36D39977", fontFamily: "var(--font-head)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                pts S1
              </div>
            </div>
            {/* Prédictions à venir */}
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: 8, padding: "6px 14px", textAlign: "center",
            }}>
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 20, color: "var(--text)", lineHeight: 1 }}>
                {totalPredicted}<span style={{ color: "var(--text3)", fontSize: 14 }}>/{totalUpcoming}</span>
              </div>
              <div style={{ fontSize: 9, color: "var(--text3)", fontFamily: "var(--font-head)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                Prédites
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Standings toggle */}
      <button
        onClick={() => setShowStandings(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", marginBottom: 16,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, cursor: "pointer",
          fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13,
          color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1,
        }}
      >
        <span>Classement après Semaine 1</span>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none"
          style={{ transform: showStandings ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {showStandings && (
        <div style={{ marginBottom: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  {["#", "Équipe", "V", "D", "Cartes +/-", "Pts"].map((h, i) => (
                    <th key={h} style={{
                      padding: "8px 12px", textAlign: i <= 1 ? "left" : "center",
                      fontFamily: "var(--font-head)", fontSize: 11, fontWeight: 700,
                      color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STANDINGS.map((row, i) => {
                  const t = TEAMS[row.team] ?? { color: "#7082A8", abbr: "?" };
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      <td style={{ padding: "8px 12px", fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12, color: row.rank <= 3 ? "#F5C842" : "var(--text3)", width: 32 }}>{row.rank}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                            background: `${t.color}22`, border: `1px solid ${t.color}44`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 9, color: t.color,
                          }}>{t.abbr}</div>
                          <span style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{row.team}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13, color: "#36D399" }}>{row.w}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13, color: "#F87171" }}>{row.l}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "var(--font-head)", fontSize: 12, color: row.diff > 0 ? "#36D399" : row.diff < 0 ? "#F87171" : "var(--text2)" }}>
                        {row.diff > 0 ? "+" : ""}{row.diff}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 14, color: row.pts > 0 ? "var(--text)" : "var(--text3)" }}>{row.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Week tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {WEEKS.map((w, i) => {
          const allLocked = w.done || w.days.every(d => isDayLocked(d.lockTime));
          return (
            <button key={i} onClick={() => setActiveWeek(i)} style={{
              padding: "6px 14px",
              fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
              textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
              border: activeWeek === i ? "1px solid #36D39944" : "1px solid var(--border)",
              borderRadius: 8,
              background: activeWeek === i ? "#36D39918" : "var(--surface)",
              color: activeWeek === i ? "#36D399" : "var(--text3)",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {w.label}
              {allLocked && (
                <span style={{ fontSize: 9, color: "var(--text3)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px" }}>
                  {w.done ? "DONE" : "LOCK"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Days + matches */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {week.days.map((day) => {
          const dayLocked = week.done || isDayLocked(day.lockTime);
          const lockDate  = new Date(day.lockTime);
          const diff      = lockDate.getTime() - now.getTime();
          const hoursLeft = Math.ceil(diff / 3_600_000);

          return (
            <div key={day.label}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)",
              }}>
                <span style={{
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                  color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1,
                }}>{day.label}</span>
                {!week.done && (
                  <span style={{
                    fontFamily: "var(--font-head)", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    color: dayLocked ? "#F87171" : diff < 7_200_000 ? "#F5C842" : "var(--text3)",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {dayLocked ? (
                      <><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg> Prédictions fermées</>
                    ) : hoursLeft <= 24 ? (
                      <><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Ferme dans {hoursLeft}h</>
                    ) : (
                      <>Ferme le {lockDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à 19h00</>
                    )}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {day.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    prediction={predictions[m.id]}
                    locked={dayLocked}
                    onChange={!dayLocked ? (p) => handleChange(m.id, p) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit banner */}
      {!week.done && totalPredicted > 0 && (
        <div style={{
          position: "sticky", bottom: 20, marginTop: 28,
          background: "rgba(13,17,32,0.92)",
          border: `1px solid ${validated ? "#36D39966" : "#36D39933"}`,
          borderRadius: 12, padding: "12px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          backdropFilter: "blur(16px)",
          transition: "border-color 0.2s",
        }}>
          <div>
            {saveError ? (
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13, color: "#F87171" }}>
                ⚠ {saveError}
              </div>
            ) : validated ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke="#36D399" strokeWidth="1"/>
                  <path d="M3.5 6l2 2 3-3.5" stroke="#36D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 14, color: "#36D399" }}>
                  Prédictions sauvegardées
                </span>
              </div>
            ) : (
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                {totalPredicted} prédiction{totalPredicted > 1 ? "s" : ""} complète{totalPredicted > 1 ? "s" : ""}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3, fontFamily: "var(--font-head)" }}>
              Modifiables jusqu'à la fermeture · 1h avant chaque journée
            </div>
          </div>
          <button
            onClick={handleValidate}
            disabled={saving}
            style={{
              padding: "8px 20px", borderRadius: 8,
              cursor: saving ? "wait" : "pointer", flexShrink: 0,
              background: validated ? "transparent" : saving ? "#36D39966" : "#36D399",
              border: validated ? "1px solid #36D39955" : "none",
              fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 13,
              color: validated ? "#36D399" : "#0A0D15",
              textTransform: "uppercase", letterSpacing: 1,
              transition: "all 0.2s",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "..." : validated ? "✓ Validé" : "Valider"}
          </button>
        </div>
      )}

    </div>
  );
}
