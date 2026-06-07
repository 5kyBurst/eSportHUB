"use client";

import { useState } from "react";
import Link from "next/link";

type Game = {
  id: string;
  name: string;
  full: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
};

export default function GameCard({ game }: { game: Game }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/predict/${game.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textDecoration: "none",
        background: hovered ? game.bg : "var(--surface)",
        border: `1px solid ${game.border}`,
        borderRadius: 12,
        padding: "clamp(16px, 3vw, 28px) clamp(14px, 3vw, 24px)",
        textAlign: "left",
        cursor: "pointer",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 0.15s, background 0.15s",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "clamp(12px, 3vw, 24px)",
      }}
    >
      {/* Glow */}
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 80, height: 80,
        borderRadius: "50%",
        background: game.color,
        opacity: 0.06,
        filter: "blur(20px)",
        pointerEvents: "none",
      }} />

      {/* Icon */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "clamp(40px, 8vw, 64px)" }}>
        <div style={{ height: "clamp(32px, 6vw, 48px)", display: "flex", alignItems: "center" }}>
          {game.icon}
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: "clamp(20px, 4vw, 26px)",
          fontWeight: 900,
          color: game.color,
          letterSpacing: 1,
          textTransform: "uppercase",
          lineHeight: 1,
        }}>
          {game.name}
        </div>
        <div style={{
          fontFamily: "var(--font-body)",
          fontSize: "clamp(11px, 1.8vw, 13px)",
          color: "var(--text3)",
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {game.full}
        </div>
      </div>

      {/* Arrow */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span className="hidden sm:inline" style={{
          fontSize: 11, fontFamily: "var(--font-head)", fontWeight: 700,
          color: game.color, textTransform: "uppercase", letterSpacing: 1,
        }}>
          Voir les matchs
        </span>
        <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke={game.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  );
}
