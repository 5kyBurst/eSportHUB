"use client";
import { useRef, useEffect, useState } from "react";
import type { DBMatch } from "./types";
import type { BracketLayout, BracketSlot } from "@/lib/liquipedia";

// ─── Constantes ───────────────────────────────────────────────────────────────
const SH  = 110;   // slot height (unité de position Y)
const MH  = 66;    // hauteur d'une boîte match
const IY  = (SH - MH) / 2;   // inset vertical dans le slot
const CW  = 152;   // largeur d'une colonne
const GW  = 40;    // gap entre colonnes
const ST  = CW + GW;
const LH  = 26;    // hauteur label de round
const GAP = 44;    // séparateur UB / LB
const LINE = "#1E2D3D";

// ─── Couleurs d'équipe ────────────────────────────────────────────────────────
const TEAMS: Record<string, { color: string; abbr: string }> = {
  // CDL
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
  // VCT
  "Paper Rex":             { color: "#FF4500", abbr: "PRX" },
  "Team Vitality":         { color: "#FFDD00", abbr: "VIT" },
  "Edward Gaming":         { color: "#0057A8", abbr: "EDG" },
  "Leviatán":              { color: "#7B2FBE", abbr: "LEV" },
  "FUT Esports":           { color: "#FF6B00", abbr: "FUT" },
  "XLG":                   { color: "#00A8E8", abbr: "XLG" },
  "G2 Esports":            { color: "#F6C31C", abbr: "G2"  },
  "Team Heretics":         { color: "#FFD700", abbr: "TH"  },
  "NRG":                   { color: "#FF3636", abbr: "NRG" },
  "Gen.G":                 { color: "#00C853", abbr: "GG"  },
  "DRG":                   { color: "#FF4B00", abbr: "DRG" },
};
const FB = { color: "#7082A8", abbr: "?" };

function teamInfo(name: string) { return TEAMS[name] ?? FB; }

// ─── Calcul des positions Y par round ────────────────────────────────────────
// Retourne pour chaque round le tableau de slots (position Y en unités de SH).
// Règle :
//  - Round 0 (premier) : slots [0, 1, …, n-1]
//  - Round suivant même effectif → positions identiques (connecteur direct)
//  - Round suivant effectif réduit → midpoints des groupes du round précédent
function computeSlots(matchCounts: number[]): number[][] {
  if (!matchCounts.length) return [];
  const all: number[][] = [];
  let prev = Array.from({ length: matchCounts[0] }, (_, i) => i);
  all.push(prev);
  for (let r = 1; r < matchCounts.length; r++) {
    const n = matchCounts[r];
    const pn = prev.length;
    let curr: number[];
    if (n >= pn) {
      curr = prev.slice(0, n);
    } else {
      curr = [];
      const g = pn / n;
      for (let i = 0; i < n; i++) {
        const lo = Math.floor(i * g);
        const hi = Math.ceil((i + 1) * g) - 1;
        curr.push((prev[lo] + prev[hi]) / 2);
      }
    }
    all.push(curr);
    prev = curr;
  }
  return all;
}

// ─── Lignes SVG entre deux rounds consécutifs ─────────────────────────────────
// x0 = bord droit de la colonne précédente, x1 = bord gauche de la suivante
// yBase = décalage Y de la section dans le SVG global
function Connectors({
  prevS, currS, x0, x1, yBase,
}: {
  prevS: number[]; currS: number[];
  x0: number; x1: number; yBase: number;
}) {
  const xM = x0 + GW / 2;
  if (prevS.length === currS.length) {
    return (
      <>
        {prevS.map((s, i) => {
          const y = yBase + s * SH + SH / 2;
          return <line key={i} x1={x0} y1={y} x2={x1} y2={y} stroke={LINE} strokeWidth={1.5} />;
        })}
      </>
    );
  }
  // Connecteur bracket : chaque groupe de prev → un match curr
  const g = prevS.length / currS.length;
  return (
    <>
      {currS.map((cs, ci) => {
        const lo = Math.floor(ci * g);
        const hi = Math.ceil((ci + 1) * g) - 1;
        const y1   = yBase + prevS[lo] * SH + SH / 2;
        const y2   = yBase + prevS[hi] * SH + SH / 2;
        const yMid = yBase + cs  * SH + SH / 2;
        if (lo === hi) {
          return <line key={ci} x1={x0} y1={y1} x2={x1} y2={yMid} stroke={LINE} strokeWidth={1.5} />;
        }
        return (
          <g key={ci}>
            <line x1={x0} y1={y1}   x2={xM} y2={y1}   stroke={LINE} strokeWidth={1.5} />
            <line x1={x0} y1={y2}   x2={xM} y2={y2}   stroke={LINE} strokeWidth={1.5} />
            <line x1={xM} y1={y1}   x2={xM} y2={y2}   stroke={LINE} strokeWidth={1.5} />
            <line x1={xM} y1={yMid} x2={x1} y2={yMid} stroke={LINE} strokeWidth={1.5} />
          </g>
        );
      })}
    </>
  );
}

// ─── Boîte match ──────────────────────────────────────────────────────────────
function MatchBox({
  match, pick, onPick, locked,
}: {
  match: DBMatch; pick: string | null;
  onPick: (t: string) => void; locked: boolean;
}) {
  const done  = match.status === "finished";
  const t1    = teamInfo(match.team_a);
  const t2    = teamInfo(match.team_b);
  const winA  = done && match.score_a !== null && match.score_b !== null && match.score_a > match.score_b;
  const winB  = done && match.score_a !== null && match.score_b !== null && match.score_b > match.score_a;
  const isTBD = !match.team_a || match.team_a === "TBD";
  const can   = !done && !locked && !isTBD;

  let pts: number | null = null;
  if (done && pick) {
    pts = (winA && pick === match.team_a) || (winB && pick === match.team_b) ? 3 : 0;
  }

  function Row({ team, score, info, win, picked, loss }: {
    team: string; score: number | null; info: { color: string; abbr: string };
    win: boolean; picked: boolean; loss: boolean;
  }) {
    return (
      <div
        onClick={() => can && onPick(team)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 7px 5px 5px",
          cursor: can ? "pointer" : "default",
          background: win ? `${info.color}18` : (picked && !done) ? `${info.color}12` : "transparent",
          borderLeft: `3px solid ${picked ? info.color : "transparent"}`,
          transition: "background 0.12s",
          opacity: loss && !picked ? 0.35 : 1,
          userSelect: "none",
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          background: `${info.color}22`,
          border: `1px solid ${(win || picked) ? info.color + "88" : info.color + "33"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 7, color: info.color,
        }}>
          {info.abbr.slice(0, 3)}
        </div>
        <span style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontFamily: "var(--font-head)", fontWeight: win ? 800 : 600, fontSize: 10,
          color: win ? info.color : picked ? "var(--text)" : isTBD ? "var(--text3)" : "var(--text2)",
        }}>
          {team || "TBD"}
        </span>
        {score !== null && (
          <span style={{
            fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 14,
            color: win ? info.color : "var(--text3)",
            minWidth: 12, textAlign: "right", flexShrink: 0,
          }}>{score}</span>
        )}
        {!done && picked && (
          <span style={{
            fontSize: 7, fontFamily: "var(--font-head)", fontWeight: 800,
            color: info.color, background: `${info.color}20`,
            padding: "1px 3px", borderRadius: 3, flexShrink: 0,
          }}>✓</span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      border: pts !== null
        ? `1px solid ${pts === 3 ? "#36D39955" : "#F8717155"}`
        : "1px solid var(--border)",
      borderRadius: 7, overflow: "visible",
      background: isTBD ? "var(--bg2)" : "var(--surface)",
      position: "relative",
      boxShadow: isTBD ? "none" : "0 2px 8px #00000030",
    }}>
      <div style={{ overflow: "hidden", borderRadius: 6 }}>
        <Row team={match.team_a || "TBD"} score={match.score_a} info={t1}
          win={winA} picked={pick === match.team_a} loss={winB} />
        <div style={{ height: 1, background: "var(--border)" }} />
        <Row team={match.team_b || "TBD"} score={match.score_b} info={t2}
          win={winB} picked={pick === match.team_b} loss={winA} />
      </div>
      {pts !== null && (
        <div style={{
          position: "absolute", top: -9, right: -2,
          fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 10,
          color: pts === 3 ? "#36D399" : "#F87171",
          background: pts === 3 ? "#0D1F1A" : "#1F0D0D",
          border: `1px solid ${pts === 3 ? "#36D39944" : "#F8717144"}`,
          padding: "1px 5px", borderRadius: 4,
        }}>
          {pts === 3 ? "+3" : "×"}
        </div>
      )}
    </div>
  );
}

function makePH(round: string, idx: number, slot?: BracketSlot): DBMatch {
  return {
    id: `ph-${round}-${idx}`, match_key: `ph-${round}-${idx}`,
    team_a: slot?.teamA ?? "TBD", team_b: slot?.teamB ?? "TBD",
    score_a: null, score_b: null, status: "upcoming",
    scheduled_at: "", round_label: round,
  };
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function GenericBracket({
  layout, slots: lpSlots = [], matches, picks, onPick,
}: {
  layout: BracketLayout;
  slots?: BracketSlot[];
  matches: DBMatch[];
  picks: Record<string, string>;
  onPick: (matchId: string, team: string) => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Index des matchs DB et des slots Liquipedia
  const grouped: Record<string, DBMatch[]> = {};
  for (const m of matches) {
    (grouped[m.round_label] ??= []).push(m);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  const lpIndex: Record<string, BracketSlot> = {};
  for (const s of lpSlots) {
    lpIndex[`${s.roundLabel}:${s.slotIndex}`] = s;
  }

  function getMatch(roundDbLabel: string, idx: number): DBMatch {
    return grouped[roundDbLabel]?.[idx]
      ?? makePH(roundDbLabel, idx, lpIndex[`${roundDbLabel}:${idx}`]);
  }

  // Locks : 1h avant le 1er match du round
  const now = Date.now();
  const locked = new Set<string>();
  for (const [label, ms] of Object.entries(grouped)) {
    const first = ms.find(m => m.scheduled_at);
    if (first) {
      const lockMs = new Date(first.scheduled_at).getTime() - 3600_000;
      if (now >= lockMs) locked.add(label);
    }
  }

  // Calcul des positions Y pour UB et LB
  const ubSlots = computeSlots(layout.ubRounds.map(r => r.matchCount));
  const lbSlots = computeSlots(layout.lbRounds.map(r => r.matchCount));

  const ubCount  = layout.ubRounds[0]?.matchCount ?? 1;
  const lbCount  = layout.lbRounds[0]?.matchCount ?? 0;
  const hasLB    = layout.hasLowerBracket;
  const hasGF    = !!layout.grandFinalDbLabel;

  const UB_H   = ubCount * SH;
  const LB_TOP = hasLB ? UB_H + GAP : 0;
  const LB_H   = hasLB ? lbCount * SH : 0;
  const AREA_H = LB_TOP + LB_H;

  // Nombre de colonnes : max(ubCols, lbCols) + 1 si GF
  const ubCols = layout.ubRounds.length;
  const lbCols = layout.lbRounds.length;
  const mainCols = Math.max(ubCols, lbCols);
  const gfCol = hasGF ? mainCols : -1;
  const totalCols = hasGF ? mainCols + 1 : mainCols;
  const TOTAL_W = totalCols > 0 ? (totalCols - 1) * ST + CW : CW;

  // Centre Y du GF (entre dernière ligne UB et LB)
  const ubLastSlot  = ubSlots[ubSlots.length - 1]?.[0] ?? 0;
  const lbLastSlot  = lbSlots[lbSlots.length - 1]?.[0] ?? 0;
  const gfCenterY   = hasLB
    ? ((ubLastSlot * SH + SH / 2) + (LB_TOP + lbLastSlot * SH + SH / 2)) / 2
    : ubLastSlot * SH + SH / 2;
  const gfTop = gfCenterY - MH / 2;

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 8;
      setScale(Math.min(1.5, Math.max(0.25, w / TOTAL_W)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [TOTAL_W]);

  const scaledH = Math.round((AREA_H + LH) * scale);

  return (
    <div ref={outerRef} style={{ width: "100%", position: "relative", height: scaledH }}>
      <div style={{
        position: "absolute", top: 0, left: 0,
        transformOrigin: "top left", transform: `scale(${scale})`,
        width: TOTAL_W, height: AREA_H + LH,
      }}>

        {/* ── Labels de colonnes ─────────────────────────────────────── */}
        {/* UB label */}
        {hasLB && (
          <div style={{
            position: "absolute", top: 0, left: 0, height: LH,
            display: "flex", alignItems: "center",
            fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 9,
            textTransform: "uppercase", letterSpacing: 2, color: "#4A8FE2",
          }}>
            Winners Bracket
          </div>
        )}
        {layout.ubRounds.map((r, ri) => (
          <div key={r.dbLabel} style={{
            position: "absolute", top: 0, left: ri * ST, width: CW, height: LH,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 8,
            textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)",
          }}>
            {r.label}
          </div>
        ))}
        {hasGF && (
          <div style={{
            position: "absolute", top: 0, left: gfCol * ST, width: CW, height: LH,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 9,
            textTransform: "uppercase", letterSpacing: 1, color: "#F5C842",
          }}>
            Grand Final
          </div>
        )}

        {/* ── Zone bracket ───────────────────────────────────────────── */}
        <div style={{
          position: "absolute", top: LH, left: 0, width: TOTAL_W, height: AREA_H,
        }}>
          <svg style={{
            position: "absolute", inset: 0, width: TOTAL_W, height: AREA_H,
            overflow: "visible", pointerEvents: "none",
          }}>
            {/* UB connectors */}
            {ubSlots.slice(0, -1).map((prevS, ri) => (
              <Connectors
                key={`ub-${ri}`}
                prevS={prevS} currS={ubSlots[ri + 1]}
                x0={ri * ST + CW} x1={(ri + 1) * ST}
                yBase={0}
              />
            ))}

            {/* GF connectors : WF → GF et EF → GF */}
            {hasGF && (() => {
              const xWF = (ubCols - 1) * ST + CW;
              const xEF = hasLB ? (lbCols - 1) * ST + CW : xWF;
              const xGF = gfCol * ST;
              const xJoin = xGF - GW / 2;
              const yUB = ubLastSlot * SH + SH / 2;
              const yLB = hasLB ? LB_TOP + lbLastSlot * SH + SH / 2 : yUB;
              if (hasLB) {
                return (
                  <g>
                    <line x1={xWF} y1={yUB}       x2={xJoin} y2={yUB}       stroke={LINE} strokeWidth={1.5} />
                    <line x1={xEF} y1={yLB}       x2={xJoin} y2={yLB}       stroke={LINE} strokeWidth={1.5} />
                    <line x1={xJoin} y1={yUB}     x2={xJoin} y2={yLB}       stroke={LINE} strokeWidth={1.5} />
                    <line x1={xJoin} y1={gfCenterY} x2={xGF} y2={gfCenterY} stroke={LINE} strokeWidth={1.5} />
                  </g>
                );
              }
              return <line x1={xWF} y1={yUB} x2={xGF} y2={gfCenterY} stroke={LINE} strokeWidth={1.5} />;
            })()}

            {/* LB connectors */}
            {lbSlots.slice(0, -1).map((prevS, ri) => (
              <Connectors
                key={`lb-${ri}`}
                prevS={prevS} currS={lbSlots[ri + 1]}
                x0={ri * ST + CW} x1={(ri + 1) * ST}
                yBase={LB_TOP}
              />
            ))}
          </svg>

          {/* Séparateur UB / LB */}
          {hasLB && (
            <>
              <div style={{
                position: "absolute",
                top: UB_H + GAP / 2 - 1, left: 0, right: 0,
                height: 1, background: "var(--border)", opacity: 0.4,
              }} />
              <div style={{
                position: "absolute", top: UB_H + 8, left: 0,
                fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 9,
                textTransform: "uppercase", letterSpacing: 2, color: "#E09B3D",
              }}>
                Elimination Bracket
              </div>
              {/* Labels LB */}
              {layout.lbRounds.map((r, ri) => (
                <div key={r.dbLabel} style={{
                  position: "absolute",
                  top: UB_H + GAP - LH + 2, left: ri * ST, width: CW,
                  textAlign: "center",
                  fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 8,
                  textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)",
                }}>
                  {r.label}
                </div>
              ))}
            </>
          )}

          {/* ── Boîtes UB ─────────────────────────────────────────────── */}
          {layout.ubRounds.map((r, ri) =>
            ubSlots[ri]?.map((slot, mi) => {
              const m = getMatch(r.dbLabel, mi);
              return (
                <div key={m.id} style={{
                  position: "absolute", left: ri * ST, top: slot * SH + IY, width: CW,
                }}>
                  <MatchBox match={m} pick={picks[m.id] ?? null}
                    onPick={t => onPick(m.id, t)} locked={locked.has(r.dbLabel)} />
                </div>
              );
            })
          )}

          {/* ── Boîtes LB ─────────────────────────────────────────────── */}
          {layout.lbRounds.map((r, ri) =>
            lbSlots[ri]?.map((slot, mi) => {
              const m = getMatch(r.dbLabel, mi);
              return (
                <div key={m.id} style={{
                  position: "absolute", left: ri * ST, top: LB_TOP + slot * SH + IY, width: CW,
                }}>
                  <MatchBox match={m} pick={picks[m.id] ?? null}
                    onPick={t => onPick(m.id, t)} locked={locked.has(r.dbLabel)} />
                </div>
              );
            })
          )}

          {/* ── Grand Final ───────────────────────────────────────────── */}
          {hasGF && (() => {
            const m = getMatch(layout.grandFinalDbLabel!, 0);
            return (
              <div style={{
                position: "absolute", left: gfCol * ST, top: gfTop, width: CW, zIndex: 10,
              }}>
                <MatchBox match={m} pick={picks[m.id] ?? null}
                  onPick={t => onPick(m.id, t)} locked={locked.has(layout.grandFinalDbLabel!)} />
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
