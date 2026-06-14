"use client";

import { useRef, useEffect, useState } from "react";
import type { DBMatch } from "./types";

// ─── Constantes de layout ────────────────────────────────────────────────────
const SLOT_H   = 126;           // hauteur d'un « slot » vertical
const MATCH_H  = 80;            // hauteur d'une boîte match
const INSET_Y  = (SLOT_H - MATCH_H) / 2;   // centrage vertical dans le slot
const COL_W    = 192;           // largeur d'une colonne (round)
const GAP_W    = 56;            // espace entre colonnes (pour les connecteurs)
const STRIDE   = COL_W + GAP_W; // distance entre débuts de colonnes

// Ordre des rounds et slots (en unités de SLOT_H)
// R1 et QF : 4 matchs → slots 0, 1, 2, 3
// SF       : 2 matchs → slots 0.5 et 2.5 (midpoints des paires QF)
// Finale   : 1 match  → slot 1.5 (midpoint des deux SF)
const ROUNDS: Array<{ label: string; slots: number[] }> = [
  { label: "Tour 1",           slots: [0, 1, 2, 3] },
  { label: "Quarts de finale", slots: [0, 1, 2, 3] },
  { label: "Demi-finales",     slots: [0.5, 2.5]   },
  { label: "Finale",           slots: [1.5]         },
];

const TOTAL_W  = 4 * COL_W + 3 * GAP_W;
const TOTAL_H  = 4 * SLOT_H;
const LABEL_H  = 30;

// Centre Y d'un slot donné
const cy = (slot: number) => slot * SLOT_H + SLOT_H / 2;
// Position Y du haut d'une boîte match dans un slot
const my = (slot: number) => slot * SLOT_H + INSET_Y;
// Position X de la colonne round ri
const cx = (ri: number)   => ri * STRIDE;

// ─── Couleurs d'équipe ───────────────────────────────────────────────────────
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

// ─── Ligne de connecteur SVG ─────────────────────────────────────────────────
const LINE = "#1E2D3D";

// ─── Boîte match ─────────────────────────────────────────────────────────────
function MatchBox({
  match, pick, onPick, locked,
}: {
  match: DBMatch;
  pick: string | null;
  onPick: (team: string) => void;
  locked: boolean;
}) {
  const done  = match.status === "finished";
  const t1    = TEAMS[match.team_a] ?? FALLBACK;
  const t2    = TEAMS[match.team_b] ?? FALLBACK;
  const winA  = done && match.score_a !== null && match.score_b !== null && match.score_a > match.score_b;
  const winB  = done && match.score_a !== null && match.score_b !== null && match.score_b > match.score_a;
  const isTBD = !match.team_a || match.team_a === "TBD";
  const canClick = !done && !locked && !isTBD;

  // Résultat du pronostic
  let pts: number | null = null;
  if (done && pick) {
    const correctWin = winA ? match.team_a : winB ? match.team_b : null;
    pts = correctWin === pick ? 3 : 0;
  }

  function Row({
    team, score, info, win, picked, loss,
  }: {
    team: string; score: number | null; info: typeof t1;
    win: boolean; picked: boolean; loss: boolean;
  }) {
    return (
      <div
        onClick={() => canClick && onPick(team)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 8px 7px 6px",
          cursor: canClick ? "pointer" : "default",
          background: win
            ? `${info.color}18`
            : (picked && !done)
            ? `${info.color}12`
            : "transparent",
          borderLeft: `3px solid ${picked ? info.color : "transparent"}`,
          transition: "background 0.12s",
          opacity: loss && !picked ? 0.35 : 1,
          userSelect: "none",
        }}
      >
        {/* Badge équipe */}
        <div style={{
          width: 22, height: 22, borderRadius: 4, flexShrink: 0,
          background: `${info.color}22`,
          border: `1px solid ${(win || picked) ? info.color + "88" : info.color + "33"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 7,
          color: info.color, letterSpacing: 0,
        }}>
          {info.abbr.slice(0, 3)}
        </div>

        {/* Nom */}
        <span style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontFamily: "var(--font-head)", fontWeight: win ? 800 : 600, fontSize: 11,
          color: win
            ? info.color
            : picked
            ? "var(--text)"
            : "var(--text2)",
        }}>
          {team || "TBD"}
        </span>

        {/* Score officiel */}
        {score !== null && (
          <span style={{
            fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 15,
            color: win ? info.color : "var(--text3)",
            minWidth: 14, textAlign: "right", flexShrink: 0,
          }}>
            {score}
          </span>
        )}

        {/* Indicateur de choix (avant résultat) */}
        {!done && picked && (
          <span style={{
            fontSize: 8, fontFamily: "var(--font-head)", fontWeight: 800,
            color: info.color, background: `${info.color}20`,
            padding: "1px 4px", borderRadius: 3, flexShrink: 0,
            letterSpacing: 0.3, textTransform: "uppercase",
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
      borderRadius: 8, overflow: "visible",
      background: "var(--surface)",
      position: "relative",
      boxShadow: "0 2px 8px #00000030",
    }}>
      <div style={{ overflow: "hidden", borderRadius: 7 }}>
        <Row team={match.team_a} score={match.score_a} info={t1} win={winA} picked={pick === match.team_a} loss={winB} />
        <div style={{ height: 1, background: "var(--border)" }} />
        <Row team={match.team_b} score={match.score_b} info={t2} win={winB} picked={pick === match.team_b} loss={winA} />
      </div>

      {/* Badge points */}
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

// ─── Vue bracket principale ──────────────────────────────────────────────────
export function BracketView({
  matches,
  picks,
  onPick,
}: {
  matches: DBMatch[];
  picks: Record<string, string>;   // matchId → teamName sélectionnée
  onPick: (matchId: string, team: string) => void;
}) {
  // ── Scaling adaptatif à la largeur du conteneur ───────────────────────────
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientWidth - 8;
      // Max 1.6× sur grand écran, réduit si écran trop petit
      const s = Math.min(1.6, Math.max(0.3, available / TOTAL_W));
      setScale(s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Groupe et trie par round ──────────────────────────────────────────────
  const grouped: Record<string, DBMatch[]> = {};
  for (const r of ROUNDS) grouped[r.label] = [];

  for (const m of matches) {
    if (grouped[m.round_label]) grouped[m.round_label].push(m);
  }
  for (const r of ROUNDS) {
    grouped[r.label].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  // Rounds verrouillés : 1h avant le 1er match du round
  const now = Date.now();
  const locked = new Set<string>();
  for (const r of ROUNDS) {
    const first = grouped[r.label][0];
    if (first) {
      const lockMs = new Date(first.scheduled_at).getTime() - 60 * 60 * 1000;
      if (now >= lockMs) locked.add(r.label);
    }
  }

  const scaledH = Math.round((TOTAL_H + LABEL_H) * scale);

  return (
    // Conteneur outer : mesure la largeur disponible
    <div ref={outerRef} style={{ width: "100%", position: "relative", height: scaledH }}>
      {/* Conteneur inner : transformé au scale calculé */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
        width: TOTAL_W,
        height: TOTAL_H + LABEL_H,
      }}>

        {/* ── Labels de rounds ─────────────────────────────────────────────── */}
        {ROUNDS.map((r, ri) => {
          const hasOpen = !locked.has(r.label) && grouped[r.label].some(m => m.status !== "finished");
          return (
            <div key={r.label} style={{
              position: "absolute",
              left: cx(ri), top: 0, width: COL_W,
              textAlign: "center",
              fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 10,
              textTransform: "uppercase", letterSpacing: 1.5,
              color: "var(--text3)",
            }}>
              {r.label}
              {locked.has(r.label) && grouped[r.label].some(m => m.status !== "finished") && (
                <span style={{ marginLeft: 5, fontSize: 10 }}>🔒</span>
              )}
              {hasOpen && (
                <span style={{ marginLeft: 5, fontSize: 10, color: "#F5C842" }}>🔓</span>
              )}
            </div>
          );
        })}

        {/* Conteneur bracket (décalé sous les labels) */}
        <div style={{
          position: "absolute", top: LABEL_H, left: 0,
          width: TOTAL_W, height: TOTAL_H,
        }}>

          {/* ── Lignes de connexion SVG ──────────────────────────────────── */}
          <svg style={{
            position: "absolute", inset: 0,
            width: TOTAL_W, height: TOTAL_H,
            overflow: "visible", pointerEvents: "none",
          }}>
            {/* R1 → QF : 4 lignes horizontales (même slot Y) */}
            {[0, 1, 2, 3].map(i => (
              <line key={`r1qf-${i}`}
                x1={cx(0) + COL_W} y1={cy(i)}
                x2={cx(1)}         y2={cy(i)}
                stroke={LINE} strokeWidth={1.5}
              />
            ))}

            {/* QF → SF : 2 connecteurs en bracket */}
            {[0, 1].map(sf => {
              const y1   = cy(sf * 2);        // QF pair haut
              const y2   = cy(sf * 2 + 1);    // QF pair bas
              const yMid = cy(sf * 2 + 0.5);  // = cy du SF
              const x0   = cx(1) + COL_W;     // bord droit QF
              const x2   = cx(2);             // bord gauche SF
              const xM   = x0 + GAP_W / 2;   // milieu du gap
              return (
                <g key={`qfsf-${sf}`}>
                  <line x1={x0} y1={y1}   x2={xM} y2={y1}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={x0} y1={y2}   x2={xM} y2={y2}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={y1}   x2={xM} y2={y2}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={yMid} x2={x2} y2={yMid} stroke={LINE} strokeWidth={1.5} />
                </g>
              );
            })}

            {/* SF → Finale : 1 connecteur */}
            {(() => {
              const y1   = cy(0.5);
              const y2   = cy(2.5);
              const yMid = cy(1.5);
              const x0   = cx(2) + COL_W;
              const x2   = cx(3);
              const xM   = x0 + GAP_W / 2;
              return (
                <g>
                  <line x1={x0} y1={y1}   x2={xM} y2={y1}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={x0} y1={y2}   x2={xM} y2={y2}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={y1}   x2={xM} y2={y2}   stroke={LINE} strokeWidth={1.5} />
                  <line x1={xM} y1={yMid} x2={x2} y2={yMid} stroke={LINE} strokeWidth={1.5} />
                </g>
              );
            })()}
          </svg>

          {/* ── Boîtes match ─────────────────────────────────────────────── */}
          {ROUNDS.map((r, ri) =>
            r.slots.map((slot, mi) => {
              const match = grouped[r.label][mi];
              if (!match) return null;
              return (
                <div key={match.id} style={{
                  position: "absolute",
                  left: cx(ri),
                  top: my(slot),
                  width: COL_W,
                }}>
                  <MatchBox
                    match={match}
                    pick={picks[match.id] ?? null}
                    onPick={team => onPick(match.id, team)}
                    locked={locked.has(r.label)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

