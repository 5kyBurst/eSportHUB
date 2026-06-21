"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GenericBracket } from "./_GenericBracket";
import type { BracketLayout, BracketSlot } from "@/lib/liquipedia";

// ─── Types ────────────────────────────────────────────────────────────────────
type ScoreInput = { score1: string; score2: string };

type DBMatch = {
  id: string;
  match_key: string;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
  status: "upcoming" | "live" | "finished";
  scheduled_at: string;
  round_label: string;
};

type DayGroup  = { label: string; lockTime: string; matches: DBMatch[] };
type WeekGroup = { label: string; days: DayGroup[] };

type Tournament = {
  id: string;
  name: string;
  slug: string;
  format: string;   // "swiss" | "bracket" | ...
  start_date: string;
  end_date: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TEAMS: Record<string, { color: string; abbr: string }> = {
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

function getResult(p?: ScoreInput): { winner: "a" | "b"; label: string } | null {
  if (!p) return null;
  const n1 = parseInt(p.score1), n2 = parseInt(p.score2);
  if (isNaN(n1) || isNaN(n2)) return null;
  if (n1 === 3 && n2 >= 0 && n2 <= 2) return { winner: "a", label: `${n1} – ${n2}` };
  if (n2 === 3 && n1 >= 0 && n1 <= 2) return { winner: "b", label: `${n1} – ${n2}` };
  return null;
}

function getPoints(match: DBMatch, p: ScoreInput): 0 | 3 | 5 {
  const ps1 = parseInt(p.score1), ps2 = parseInt(p.score2);
  if (isNaN(ps1) || isNaN(ps2) || match.score_a === null || match.score_b === null) return 0;
  if (ps1 === match.score_a && ps2 === match.score_b) return 5;
  const oWin = match.score_a > match.score_b ? "a" : "b";
  const pWin = ps1 > ps2 ? "a" : ps2 > ps1 ? "b" : null;
  if (pWin === oWin) return 3;
  return 0;
}

function isDayLocked(lockTime: string) {
  return new Date() >= new Date(lockTime);
}

// "Semaine 1 · Jour 2" → { week: "Semaine 1", weekNum: 1 }
function parseWeekLabel(roundLabel: string): { week: string; weekNum: number } {
  const m = roundLabel.match(/Semaine\s+(\d+)/i);
  const n = m ? parseInt(m[1]) : 0;
  return { week: `Semaine ${n}`, weekNum: n };
}

// Groupe les matchs DB en semaines > jours
function groupMatches(matches: DBMatch[]): WeekGroup[] {
  const weeksMap = new Map<string, Map<string, DBMatch[]>>();

  for (const m of matches) {
    const { week } = parseWeekLabel(m.round_label);
    if (!weeksMap.has(week)) weeksMap.set(week, new Map());
    const days = weeksMap.get(week)!;
    if (!days.has(m.round_label)) days.set(m.round_label, []);
    days.get(m.round_label)!.push(m);
  }

  return [...weeksMap.entries()].map(([weekLabel, days]) => ({
    label: weekLabel,
    days: [...days.entries()].map(([dayLabel, dayMatches]) => {
      const sorted = [...dayMatches].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
      // Lock = 1h avant le 1er match du jour
      const firstMs = new Date(sorted[0]?.scheduled_at ?? Date.now()).getTime();
      const lockTime = new Date(firstMs - 60 * 60 * 1000).toISOString();
      return { label: dayLabel, lockTime, matches: sorted };
    }),
  }));
}

// ─── ScoreBox ─────────────────────────────────────────────────────────────────
function ScoreBox({ value, onChange, color, disabled }: {
  value: string; onChange: (v: string) => void; color: string; disabled?: boolean;
}) {
  return (
    <input
      type="text" inputMode="numeric" maxLength={1} value={value}
      disabled={disabled} placeholder="–"
      onChange={e => { const v = e.target.value; if (v === "" || /^[0-3]$/.test(v)) onChange(v); }}
      style={{
        width: 38, height: 38, flexShrink: 0, textAlign: "center",
        fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 20,
        background: value !== "" ? `${color}18` : "var(--bg2)",
        border: `1px solid ${value !== "" ? color + "66" : "var(--border2)"}`,
        borderRadius: 8, color: value !== "" ? color : "var(--text3)",
        outline: "none", cursor: disabled ? "default" : "text", transition: "all 0.15s",
      }}
    />
  );
}

// ─── MatchCard ─────────────────────────────────────────────────────────────────
function MatchCard({ match, prediction, locked, onChange }: {
  match: DBMatch; prediction?: ScoreInput; locked: boolean;
  onChange?: (p: ScoreInput) => void;
}) {
  const done = match.status === "finished";
  const t1 = TEAMS[match.team_a] ?? { color: "#7082A8", abbr: "?" };
  const t2 = TEAMS[match.team_b] ?? { color: "#7082A8", abbr: "?" };

  let officialLabel: string | null = null;
  let officialWinner: "a" | "b" | null = null;
  let pts: 0 | 3 | 5 | -1 = -1;

  if (done && match.score_a !== null && match.score_b !== null) {
    officialLabel = `${match.score_a} – ${match.score_b}`;
    officialWinner = match.score_a > match.score_b ? "a" : "b";
    if (prediction) pts = getPoints(match, prediction);
  }

  const winColor = officialWinner === "a" ? t1.color : officialWinner === "b" ? t2.color : "var(--text2)";
  const isDisabled = done || locked;
  const accentColor = pts === 5 ? "#36D399" : pts === 3 ? "#F5C842" : pts === 0 ? "#F87171" : null;

  return (
    <div style={{
      display: "flex", position: "relative",
      border: accentColor ? `1px solid ${accentColor}44` : "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden", opacity: done ? 0.72 : 1,
    }}>
      {accentColor && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: accentColor, zIndex: 1, pointerEvents: "none",
        }} />
      )}

      {/* Team A */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 8,
        padding: `11px 10px 11px ${accentColor ? "17px" : "14px"}`,
        background: officialWinner === "a" ? `${t1.color}12` : "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
          background: `${t1.color}22`, border: `1px solid ${officialWinner === "a" ? t1.color + "77" : t1.color + "33"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 10, color: t1.color,
        }}>{t1.abbr}</div>
        <span style={{
          fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "clamp(10px, 2vw, 13px)",
          color: officialWinner === "a" ? t1.color : officialWinner === "b" ? "var(--text3)" : "var(--text)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{match.team_a}</span>
        <ScoreBox value={prediction?.score1 ?? ""} color={t1.color} disabled={isDisabled}
          onChange={v => onChange?.({ score1: v, score2: prediction?.score2 ?? "" })} />
      </div>

      {/* Score officiel */}
      {officialLabel && (
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 2, padding: "8px 14px",
          background: "var(--surface2)",
          borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)",
        }}>
          <span style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 17, color: winColor, letterSpacing: 2 }}>
            {officialLabel}
          </span>
          <span style={{ fontSize: 8, color: winColor, opacity: 0.55, fontFamily: "var(--font-head)", letterSpacing: 1, textTransform: "uppercase" }}>
            officiel
          </span>
          {pts >= 0 && (
            <div style={{
              marginTop: 4, padding: "2px 7px", borderRadius: 6,
              background: accentColor ? `${accentColor}22` : "transparent",
              border: accentColor ? `1px solid ${accentColor}44` : "none",
              fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 11,
              color: accentColor ?? "var(--text3)",
            }}>
              {pts > 0 ? `+${pts}` : "×"}
            </div>
          )}
        </div>
      )}

      {/* Team B */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 8,
        padding: "11px 14px 11px 10px",
        background: officialWinner === "b" ? `${t2.color}12` : "var(--surface)",
        borderLeft: officialLabel ? "none" : "1px solid var(--border)",
        flexDirection: "row-reverse",
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
          background: `${t2.color}22`, border: `1px solid ${officialWinner === "b" ? t2.color + "77" : t2.color + "33"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 10, color: t2.color,
        }}>{t2.abbr}</div>
        <span style={{
          fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "clamp(10px, 2vw, 13px)",
          color: officialWinner === "b" ? t2.color : officialWinner === "a" ? "var(--text3)" : "var(--text)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right",
        }}>{match.team_b}</span>
        <ScoreBox value={prediction?.score2 ?? ""} color={t2.color} disabled={isDisabled}
          onChange={v => onChange?.({ score1: prediction?.score1 ?? "", score2: v })} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CDLTournamentPage() {
  const { slug } = useParams<{ slug: string }>();

  const [tournament, setTournament]   = useState<Tournament | null>(null);
  const [weeks, setWeeks]             = useState<WeekGroup[]>([]);
  const [predictions, setPredictions] = useState<Record<string, ScoreInput>>({});
  const [activeWeek, setActiveWeek]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [validated, setValidated]     = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  // Bracket format : picks = { matchId → teamName }
  const [bracketPicks, setBracketPicks] = useState<Record<string, string>>({});
  const [bracketLayout, setBracketLayout] = useState<BracketLayout | null>(null);
  const [bracketSlots, setBracketSlots] = useState<BracketSlot[]>([]);

  // Chargement du tournoi + matchs + prédictions de l'utilisateur
  useEffect(() => {
    if (!slug) return;
    const supabase = createClient();

    async function load() {
      // 1. Tournoi
      const { data: t } = await supabase
        .from("tournaments")
        .select("id, name, slug, format, start_date, end_date")
        .eq("slug", slug)
        .single();

      if (!t) { setLoading(false); return; }
      setTournament(t);

      // 1b. Layout Liquipedia (structure du bracket + slots TBD)
      const isBracketFormat = ["bracket", "double_elim", "double_elimination", "single_elimination"].includes(t.format ?? "");
      if (isBracketFormat) {
        fetch(`/api/bracket/${t.slug}`)
          .then(r => r.json())
          .then((d: { layout?: BracketLayout; slots?: BracketSlot[] }) => {
            if (d.layout) setBracketLayout(d.layout);
            if (d.slots?.length) setBracketSlots(d.slots);
          })
          .catch(() => {/* silencieux */});
      }

      // 2. Matchs
      const { data: matches } = await supabase
        .from("matches")
        .select("id, match_key, team_a, team_b, score_a, score_b, status, scheduled_at, round_label")
        .eq("tournament_id", t.id)
        .order("scheduled_at", { ascending: true });

      if (!matches?.length) { setLoading(false); return; }
      const grouped = groupMatches(matches as DBMatch[]);
      setWeeks(grouped);

      const now = Date.now();
      // Priorité 1 : semaine avec un jour encore ouvert (non verrouillé) et des matchs à venir
      const firstOpen = grouped.findIndex(w =>
        w.days.some(d =>
          new Date(d.lockTime).getTime() > now &&
          d.matches.some(m => m.status !== "finished")
        )
      );
      // Priorité 2 : première semaine avec des matchs non terminés (verrouillée mais pas finie)
      const firstPending = grouped.findIndex(w =>
        w.days.some(d => d.matches.some(m => m.status !== "finished"))
      );
      setActiveWeek(firstOpen >= 0 ? firstOpen : firstPending >= 0 ? firstPending : grouped.length - 1);

      // 3. Prédictions de l'utilisateur
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const matchIds = matches.map(m => m.id);
      const { data: preds } = await supabase
        .from("predictions")
        .select("match_id, score_a, score_b")
        .eq("user_id", user.id)
        .in("match_id", matchIds);

      if (preds?.length) {
        if (t.format === "bracket" || t.format === "double_elim") {
          // Format bracket : on convertit score_a/score_b en nom d'équipe gagnante
          const bpicks: Record<string, string> = {};
          for (const p of preds) {
            const m = matches?.find(x => x.id === p.match_id);
            if (m) bpicks[p.match_id] = p.score_a > p.score_b ? m.team_a : m.team_b;
          }
          setBracketPicks(bpicks);
        } else {
          const init: Record<string, ScoreInput> = {};
          preds.forEach(p => {
            init[p.match_id] = { score1: p.score_a.toString(), score2: p.score_b.toString() };
          });
          setPredictions(init);
        }
      }

      setLoading(false);
    }

    load();
  }, [slug]);

  function handleChange(matchId: string, p: ScoreInput) {
    setPredictions(prev => ({ ...prev, [matchId]: p }));
    setValidated(false);
    setSaveError(null);
  }

  // ─── Valider les picks bracket ────────────────────────────────────────────
  const handleBracketValidate = useCallback(async () => {
    setSaving(true); setSaveError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveError("Non connecté"); setSaving(false); return; }

    const allMatches = weeks.flatMap(w => w.days.flatMap(d => d.matches));
    const now = Date.now();

    // Pour chaque pick, vérifie que le round n'est pas verrouillé
    const upserts = Object.entries(bracketPicks).filter(([matchId, teamName]) => {
      const match = allMatches.find(m => m.id === matchId);
      if (!match || match.status === "finished") return false;
      // Lock 1h avant le 1er match du round
      const roundMatches = allMatches.filter(m => m.round_label === match.round_label);
      const first = roundMatches.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
      if (!first) return false;
      const lockMs = new Date(first.scheduled_at).getTime() - 60 * 60 * 1000;
      return now < lockMs;
    }).map(([matchId, teamName]) => {
      const match = allMatches.find(m => m.id === matchId)!;
      return {
        user_id:  user.id,
        match_id: matchId,
        score_a:  teamName === match.team_a ? 3 : 0,
        score_b:  teamName === match.team_b ? 3 : 0,
      };
    });

    if (upserts.length === 0) { setSaving(false); return; }

    const { error } = await supabase
      .from("predictions")
      .upsert(upserts, { onConflict: "user_id,match_id" });

    if (error) setSaveError(`Erreur : ${error.message}`);
    else setValidated(true);
    setSaving(false);
  }, [bracketPicks, weeks]);

  const handleValidate = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveError("Non connecté"); setSaving(false); return; }

    // Prépare les upserts : matchs à venir, jour non verrouillé, prédiction valide
    const allDays = weeks.flatMap(w => w.days);
    const unlockedMatchIds = new Set(
      allDays
        .filter(d => !isDayLocked(d.lockTime))
        .flatMap(d => d.matches)
        .filter(m => m.status !== "finished")
        .map(m => m.id)
    );

    const upserts = Object.entries(predictions)
      .filter(([id]) => unlockedMatchIds.has(id))
      .filter(([, p]) => getResult(p) !== null)
      .map(([id, p]) => ({
        user_id:  user.id,
        match_id: id,
        score_a:  parseInt(p.score1),
        score_b:  parseInt(p.score2),
      }));

    if (upserts.length === 0) { setSaving(false); return; }

    const { error } = await supabase
      .from("predictions")
      .upsert(upserts, { onConflict: "user_id,match_id" });

    if (error) setSaveError(`Erreur Supabase : ${error.message} (code: ${error.code})`);
    else setValidated(true);

    setSaving(false);
  }, [predictions, weeks]);

  // ─── Rendu ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 40, color: "var(--text3)", fontFamily: "var(--font-head)" }}>
        Chargement…
      </div>
    );
  }

  if (!tournament) {
    return (
      <div style={{ padding: 40 }}>
        <Link href="/predict/cdl" style={{ color: "var(--text3)", fontFamily: "var(--font-head)", fontSize: 13 }}>
          ← Retour
        </Link>
        <p style={{ marginTop: 16, color: "#F87171", fontFamily: "var(--font-head)" }}>
          Tournoi introuvable.
        </p>
      </div>
    );
  }

  const isBracket      = tournament?.format === "bracket" || tournament?.format === "double_elim" || tournament?.format === "double_elimination";
  const isDoubleBracket = tournament?.format === "double_elim" || tournament?.format === "double_elimination";
  const week       = weeks[activeWeek];
  const allMatches = weeks.flatMap(w => w.days.flatMap(d => d.matches));
  const finished   = allMatches.filter(m => m.status === "finished");
  const upcoming   = allMatches.filter(m => m.status !== "finished");

  // Compteurs / points selon le format
  const totalPred = isBracket
    ? Object.keys(bracketPicks).filter(id => {
        const m = allMatches.find(x => x.id === id);
        return m && m.status !== "finished";
      }).length
    : upcoming.filter(m => getResult(predictions[m.id]) !== null).length;

  const week1Points = isBracket
    ? finished.reduce((sum, m) => {
        const pick = bracketPicks[m.id];
        if (!pick || m.score_a === null || m.score_b === null) return sum;
        const correctWin = m.score_a > m.score_b ? m.team_a : m.team_b;
        return sum + (correctWin === pick ? 3 : 0);
      }, 0)
    : finished.reduce((sum, m) => {
        const p = predictions[m.id];
        return sum + (p ? getPoints(m, p) : 0);
      }, 0);

  return (
    <div style={{
      width: "100%",
      maxWidth: isBracket ? 1600 : 896,
      margin: "0 auto",
      padding: "32px 24px",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/predict/cdl" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "var(--font-head)", fontSize: 12, fontWeight: 700,
          color: "var(--text3)", textDecoration: "none", textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 16,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9.5 6H2.5M5.5 3L2.5 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          CDL
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <img src="/logos/cdl.png" alt="CDL" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: "var(--font-head)", fontSize: "clamp(18px, 5vw, 28px)",
              fontWeight: 900, color: "var(--text)", letterSpacing: 1, textTransform: "uppercase", lineHeight: 1,
            }}>{tournament.name}</h1>
            <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 4, fontFamily: "var(--font-head)", letterSpacing: 0.5 }}>
              {new Date(tournament.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              {" – "}
              {new Date(tournament.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              {" · BO5"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {week1Points > 0 && (
              <div style={{
                background: "#36D39910", border: "1px solid #36D39940",
                borderRadius: 8, padding: "8px 14px", textAlign: "center",
              }}>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 22, color: "#36D399" }}>
                  +{week1Points}
                </div>
                <div style={{ fontFamily: "var(--font-head)", fontSize: 9, color: "#36D39988", letterSpacing: 1, textTransform: "uppercase" }}>
                  pts gagnés
                </div>
              </div>
            )}
            <div style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "8px 14px", textAlign: "center",
            }}>
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 22, color: "var(--text)" }}>
                {totalPred}/{upcoming.length}
              </div>
              <div style={{ fontFamily: "var(--font-head)", fontSize: 9, color: "var(--text3)", letterSpacing: 1, textTransform: "uppercase" }}>
                prédites
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Format bracket ────────────────────────────────────────────────── */}
      {isBracket ? (
        <>
          {bracketLayout ? (
            <GenericBracket
              layout={bracketLayout}
              slots={bracketSlots}
              matches={allMatches}
              picks={bracketPicks}
              onPick={(matchId, team) => {
                setBracketPicks(p => {
                  if (p[matchId] === team) { const next = { ...p }; delete next[matchId]; return next; }
                  return { ...p, [matchId]: team };
                });
                setValidated(false);
              }}
            />
          ) : (
            <div style={{ padding: "24px 0", color: "var(--text3)", fontFamily: "var(--font-head)", fontSize: 13 }}>
              Chargement du bracket…
            </div>
          )}

          {upcoming.length > 0 && (
            <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={handleBracketValidate}
                disabled={saving || validated}
                style={{
                  padding: "13px 28px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: validated ? "#36D39920" : saving ? "var(--bg2)" : "var(--text)",
                  color: validated ? "#36D399" : saving ? "var(--text3)" : "var(--bg)",
                  fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 14,
                  letterSpacing: 1, textTransform: "uppercase", transition: "all 0.2s",
                }}
              >
                {validated ? "✓ Prédictions sauvegardées" : saving ? "Envoi…" : "Valider mes prédictions"}
              </button>
              {saveError && (
                <span style={{ fontSize: 12, color: "#F87171", fontFamily: "var(--font-head)" }}>
                  {saveError}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ── Format matchlist (semaines / jours) ───────────────────────── */}
          {weeks.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {weeks.map((w, i) => (
                <button key={w.label} onClick={() => setActiveWeek(i)} style={{
                  padding: "8px 18px", borderRadius: 20,
                  border: `1px solid ${activeWeek === i ? "var(--text)" : "var(--border)"}`,
                  background: activeWeek === i ? "var(--text)" : "transparent",
                  color: activeWeek === i ? "var(--bg)" : "var(--text3)",
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", transition: "all 0.15s", textTransform: "uppercase", letterSpacing: 1,
                }}>{w.label}</button>
              ))}
            </div>
          )}

          {week?.days.map(day => (
            <div key={day.label} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{
                  fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 13,
                  color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1,
                }}>{day.label}</span>
                {isDayLocked(day.lockTime) ? (
                  <span style={{
                    fontSize: 10, fontFamily: "var(--font-head)", fontWeight: 700,
                    color: "#F87171", background: "#F8717115", border: "1px solid #F8717130",
                    padding: "2px 8px", borderRadius: 20, letterSpacing: 1, textTransform: "uppercase",
                  }}>Verrouillé</span>
                ) : (
                  <span style={{
                    fontSize: 10, fontFamily: "var(--font-head)", fontWeight: 700,
                    color: "#F5C842", background: "#F5C84215", border: "1px solid #F5C84230",
                    padding: "2px 8px", borderRadius: 20, letterSpacing: 1,
                  }}>
                    🔓 Ferme à {new Date(day.lockTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })} CEST
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {day.matches.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    prediction={predictions[m.id]}
                    locked={isDayLocked(day.lockTime)}
                    onChange={p => handleChange(m.id, p)}
                  />
                ))}
              </div>
            </div>
          ))}

          {upcoming.length > 0 && (
            <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={handleValidate}
                disabled={saving || validated}
                style={{
                  padding: "13px 28px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: validated ? "#36D39920" : saving ? "var(--bg2)" : "var(--text)",
                  color: validated ? "#36D399" : saving ? "var(--text3)" : "var(--bg)",
                  fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 14,
                  letterSpacing: 1, textTransform: "uppercase", transition: "all 0.2s",
                }}
              >
                {validated ? "✓ Prédictions sauvegardées" : saving ? "Envoi…" : "Valider mes prédictions"}
              </button>
              {saveError && (
                <span style={{ fontSize: 12, color: "#F87171", fontFamily: "var(--font-head)" }}>
                  {saveError}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
