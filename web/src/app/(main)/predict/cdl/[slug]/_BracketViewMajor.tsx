"use client";
import { useRef, useEffect, useState } from "react";
import type { DBMatch } from "./types";

// ─── Layout : CDL Major (double élimination 8 équipes) ───────────────────────
// Upper : WR1 (4) → WR2 (2) → Winners Final (1) → Grand Final (1)
// Lower : ER1 (2) → ER2 (2) → ER3 (1) → Elimination Finals (1)
const SLOT_H   = 110;
const MATCH_H  = 66;
const INSET_Y  = (SLOT_H - MATCH_H) / 2;   // ~22
const COL_W    = 152;
const GAP_W    = 40;
const STRIDE   = COL_W + GAP_W;             // 192
const LABEL_H  = 26;

const UB_H    = 4 * SLOT_H;               // 440 — 4 slots pour WR1
const SEC_GAP = 40;
const LB_TOP  = UB_H + SEC_GAP;           // 480
const LB_H    = 2 * SLOT_H;               // 220
const TOTAL_H = UB_H + SEC_GAP + LB_H;    // 700

const GF_COL  = 4;                         // 5e colonne
const TOTAL_W = GF_COL * STRIDE + COL_W;  // 4*192+152 = 920

// Position Y absolue dans zone bracket
const cy_ub = (s: number) => s * SLOT_H + SLOT_H / 2;
const cy_lb = (s: number) => LB_TOP + s * SLOT_H + SLOT_H / 2;
const my_ub = (s: number) => s * SLOT_H + INSET_Y;
const my_lb = (s: number) => LB_TOP + s * SLOT_H + INSET_Y;
const cx    = (c: number) => c * STRIDE;

// Grand Final centré entre UB Final et LB Finals
const GF_CENTER_Y = (cy_ub(1.5) + cy_lb(0.5)) / 2;  // milieu vertical
const GF_TOP      = GF_CENTER_Y - MATCH_H / 2;

const LINE = "#1E2D3D";

// ─── Rounds ──────────────────────────────────────────────────────────────────
// UB
const UB_ROUNDS = [
  { label: "Winners Round 1", col: 0, slots: [0, 1, 2, 3] },
  { label: "Winners Round 2", col: 1, slots: [0.5, 2.5] },
  { label: "Winners Final",   col: 2, slots: [1.5] },
] as const;

// LB
const LB_ROUNDS = [
  { label: "Elimination Round 1", col: 0, slots: [0, 1] },
  { label: "Elimination Round 2", col: 1, slots: [0, 1] },
  { label: "Elimination Round 3", col: 2, slots: [0.5] },
  { label: "Elimination Finals",  col: 3, slots: [0.5] },
] as const;

const GF_LABEL = "Grand Final";

// ─── Couleurs équipes ─────────────────────────────────────────────────────────
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
const FALLBACK = { color: "#7082A8", abbr: "?" };

// ─── Slot Liquipedia (pour afficher TBD avec noms réels) ─────────────────────
export interface LiquipediaSlot {
  roundLabel: string;
  slotIndex: number;   // 0-based within the round
  teamA: string;
  teamB: string;
}

function makePlaceholder(round: string, idx: number, slot?: LiquipediaSlot): DBMatch {
  return {
    id: `ph-${round}-${idx}`,
    match_key: `ph-${round}-${idx}`,
    team_a: slot?.teamA ?? "TBD",
    team_b: slot?.teamB ?? "TBD",
    score_a: null, score_b: null,
    status: "upcoming", scheduled_at: "", round_label: round,
  };
}

// ─── Boîte match ─────────────────────────────────────────────────────────────
function MatchBox({
  match, pick, onPick, locked,
}: {
  match: DBMatch;
  pick: string | null;
  onPick: (team: string) => void;
  locked: boolean;
}) {
  const done   = match.status === "finished";
  const t1     = TEAMS[match.team_a] ?? FALLBACK;
  const t2     = TEAMS[match.team_b] ?? FALLBACK;
  const winA   = done && match.score_a !== null && match.score_b !== null && match.score_a > match.score_b;
  const winB   = done && match.score_a !== null && match.score_b !== null && match.score_b > match.score_a;
  const isTBD  = !match.team_a || match.team_a === "TBD";
  const canClick = !done && !locked && !isTBD;

  let pts: number | null = null;
  if (done && pick) {
    const correctWin = winA ? match.team_a : winB ? match.team_b : null;
    pts = correctWin === pick ? 3 : 0;
  }

  function Row({ team, score, info, win, picked, loss }: {
    team: string; score: number | null; info: typeof t1;
    win: boolean; picked: boolean; loss: boolean;
  }) {
    return (
      <div
        onClick={() => canClick && onPick(team)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 7px 5px 5px",
          cursor: canClick ? "pointer" : "default",
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
          fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 7,
          color: info.color,
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
          }}>
            {score}
          </span>
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

// ─── Composant principal ──────────────────────────────────────────────────────
export function BracketViewMajor({
  matches,
  picks,
  onPick,
  liquipediaSlots,
}: {
  matches: DBMatch[];
  picks: Record<string, string>;
  onPick: (matchId: string, team: string) => void;
  liquipediaSlots?: LiquipediaSlot[];
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientWidth - 8;
      setScale(Math.min(1.5, Math.max(0.3, available / TOTAL_W)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allLabels = [
    ...UB_ROUNDS.map(r => r.label),
    ...LB_ROUNDS.map(r => r.label),
    GF_LABEL,
  ] as string[];

  // Groupe les matchs DB par round
  const grouped: Record<string, DBMatch[]> = {};
  for (const l of allLabels) grouped[l] = [];
  for (const m of matches) {
    if (grouped[m.round_label] !== undefined) grouped[m.round_label].push(m);
  }
  for (const l of allLabels) {
    grouped[l].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  // Index des slots Liquipedia par round+index
  const lpSlots: Record<string, LiquipediaSlot> = {};
  for (const s of liquipediaSlots ?? []) {
    lpSlots[`${s.roundLabel}:${s.slotIndex}`] = s;
  }

  function getMatch(round: string, idx: number): DBMatch {
    return grouped[round]?.[idx] ?? makePlaceholder(round, idx, lpSlots[`${round}:${idx}`]);
  }

  // Locks : 1h avant le 1er match du round
  const now = Date.now();
  const locked = new Set<string>();
  for (const l of allLabels) {
    const first = grouped[l].find(m => m.scheduled_at);
    if (first) {
      const lockMs = new Date(first.scheduled_at).getTime() - 60 * 60 * 1000;
      if (now >= lockMs) locked.add(l);
    }
  }

  const scaledH = Math.round((TOTAL_H + LABEL_H) * scale);

  // Coordonnées connecteurs GF
  const xWF_r   = cx(2) + COL_W;
  const xEF_r   = cx(3) + COL_W;
  const xGF_l   = cx(GF_COL);
  const xJoin   = xGF_l - GAP_W / 2;
  const yUB_fin = cy_ub(1.5);
  const yLB_fin = cy_lb(0.5);

  return (
    <div ref={outerRef} style={{ width: "100%", position: "relative", height: scaledH }}>
      <div style={{
        position: "absolute", top: 0, left: 0,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
        width: TOTAL_W,
        height: TOTAL_H + LABEL_H,
      }}>

        {/* ── En-tête "Winners Bracket" ─────────────────────────────────── */}
        <div style={{
          position: "absolute", top: 0, left: 0, height: LABEL_H,
          display: "flex", alignItems: "center",
          fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 9,
          textTransform: "uppercase", letterSpacing: 2, color: "#4A8FE2",
        }}>
          Winners Bracket
        </div>

        {/* Labels de rounds UB */}
        {UB_ROUNDS.map(r => (
          <div key={r.label} style={{
            position: "absolute", top: 0, left: cx(r.col), width: COL_W,
            height: LABEL_H, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 8,
            textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)",
          }}>
            {r.label}
          </div>
        ))}
        <div style={{
          position: "absolute", top: 0, left: cx(GF_COL), width: COL_W,
          height: LABEL_H, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 9,
          textTransform: "uppercase", letterSpacing: 1, color: "#F5C842",
        }}>
          Grand Final
        </div>

        {/* ── Zone bracket ──────────────────────────────────────────────── */}
        <div style={{
          position: "absolute", top: LABEL_H, left: 0,
          width: TOTAL_W, height: TOTAL_H,
        }}>
          <svg style={{
            position: "absolute", inset: 0,
            width: TOTAL_W, height: TOTAL_H,
            overflow: "visible", pointerEvents: "none",
          }}>

            {/* ── WR1 → WR2 : 2 connecteurs bracket (0,1 → 0.5) et (2,3 → 2.5) */}
            {([0, 1] as const).map(pair => {
              const s0 = pair * 2;
              const s1 = pair * 2 + 1;
              const sMid = pair * 2 + 0.5;
              const x0  = cx(0) + COL_W;
              const x1  = cx(1);
              const xM  = x0 + GAP_W / 2;
              return (
                <g key={`wr1wr2-${pair}`}>
                  <line x1={x0} y1={cy_ub(s0)}   x2={xM} y2={cy_ub(s0)}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={x0} y1={cy_ub(s1)}   x2={xM} y2={cy_ub(s1)}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={cy_ub(s0)}   x2={xM} y2={cy_ub(s1)}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={cy_ub(sMid)} x2={x1} y2={cy_ub(sMid)} stroke={LINE} strokeWidth={1.5} />
                </g>
              );
            })}

            {/* ── WR2 → WF : connecteur bracket (0.5, 2.5 → 1.5) ───────── */}
            {(() => {
              const y1 = cy_ub(0.5), y2 = cy_ub(2.5), yM = cy_ub(1.5);
              const x0 = cx(1) + COL_W, x2 = cx(2), xM = x0 + GAP_W / 2;
              return (
                <g>
                  <line x1={x0} y1={y1} x2={xM} y2={y1} stroke={LINE} strokeWidth={1.5} />
                  <line x1={x0} y1={y2} x2={xM} y2={y2} stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={y1} x2={xM} y2={y2} stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={yM} x2={x2} y2={yM} stroke={LINE} strokeWidth={1.5} />
                </g>
              );
            })()}

            {/* ── WF + EF → GF ─────────────────────────────────────────── */}
            <g>
              <line x1={xWF_r} y1={yUB_fin}      x2={xJoin} y2={yUB_fin}      stroke={LINE} strokeWidth={1.5} />
              <line x1={xEF_r} y1={yLB_fin}      x2={xJoin} y2={yLB_fin}      stroke={LINE} strokeWidth={1.5} />
              <line x1={xJoin} y1={yUB_fin}      x2={xJoin} y2={yLB_fin}      stroke={LINE} strokeWidth={1.5} />
              <line x1={xJoin} y1={GF_CENTER_Y}  x2={xGF_l} y2={GF_CENTER_Y}  stroke={LINE} strokeWidth={1.5} />
            </g>

            {/* ── ER1 → ER2 : lignes horizontales directes ─────────────── */}
            {[0, 1].map(s => (
              <line key={`er1er2-${s}`}
                x1={cx(0) + COL_W} y1={cy_lb(s)}
                x2={cx(1)}         y2={cy_lb(s)}
                stroke={LINE} strokeWidth={1.5}
              />
            ))}

            {/* ── ER2 → ER3 : connecteur bracket (0,1 → 0.5) ─────────── */}
            {(() => {
              const y1 = cy_lb(0), y2 = cy_lb(1), yM = cy_lb(0.5);
              const x0 = cx(1) + COL_W, x2 = cx(2), xM = x0 + GAP_W / 2;
              return (
                <g>
                  <line x1={x0} y1={y1} x2={xM} y2={y1} stroke={LINE} strokeWidth={1.5} />
                  <line x1={x0} y1={y2} x2={xM} y2={y2} stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={y1} x2={xM} y2={y2} stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={yM} x2={x2} y2={yM} stroke={LINE} strokeWidth={1.5} />
                </g>
              );
            })()}

            {/* ── ER3 → Elimination Finals : ligne horizontale ──────────── */}
            <line
              x1={cx(2) + COL_W} y1={cy_lb(0.5)}
              x2={cx(3)}          y2={cy_lb(0.5)}
              stroke={LINE} strokeWidth={1.5}
            />
          </svg>

          {/* Séparateur Winners / Elimination */}
          <div style={{
            position: "absolute",
            top: UB_H + SEC_GAP / 2 - 1, left: 0, right: 0,
            height: 1, background: "var(--border)", opacity: 0.4,
          }} />

          {/* En-tête "Elimination Bracket" */}
          <div style={{
            position: "absolute", top: UB_H + 8, left: 0,
            fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 9,
            textTransform: "uppercase", letterSpacing: 2, color: "#E09B3D",
          }}>
            Elimination Bracket
          </div>

          {/* Labels de rounds LB */}
          {LB_ROUNDS.map(r => (
            <div key={r.label} style={{
              position: "absolute",
              top: UB_H + SEC_GAP - LABEL_H + 2,
              left: cx(r.col), width: COL_W,
              textAlign: "center",
              fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 8,
              textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)",
            }}>
              {r.label}
            </div>
          ))}

          {/* ── Boîtes UB ────────────────────────────────────────────────── */}
          {UB_ROUNDS.map(r =>
            (r.slots as readonly number[]).map((slot, mi) => {
              const m = getMatch(r.label, mi);
              return (
                <div key={m.id} style={{
                  position: "absolute",
                  left: cx(r.col), top: my_ub(slot), width: COL_W,
                }}>
                  <MatchBox
                    match={m}
                    pick={picks[m.id] ?? null}
                    onPick={t => onPick(m.id, t)}
                    locked={locked.has(r.label)}
                  />
                </div>
              );
            })
          )}

          {/* ── Boîtes LB ────────────────────────────────────────────────── */}
          {LB_ROUNDS.map(r =>
            (r.slots as readonly number[]).map((slot, mi) => {
              const m = getMatch(r.label, mi);
              return (
                <div key={m.id} style={{
                  position: "absolute",
                  left: cx(r.col), top: my_lb(slot), width: COL_W,
                }}>
                  <MatchBox
                    match={m}
                    pick={picks[m.id] ?? null}
                    onPick={t => onPick(m.id, t)}
                    locked={locked.has(r.label)}
                  />
                </div>
              );
            })
          )}

          {/* ── Grand Final (centré entre WF et EF) ─────────────────────── */}
          {(() => {
            const m = getMatch(GF_LABEL, 0);
            return (
              <div style={{
                position: "absolute",
                left: cx(GF_COL), top: GF_TOP, width: COL_W, zIndex: 10,
              }}>
                <MatchBox
                  match={m}
                  pick={picks[m.id] ?? null}
                  onPick={t => onPick(m.id, t)}
                  locked={locked.has(GF_LABEL)}
                />
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
