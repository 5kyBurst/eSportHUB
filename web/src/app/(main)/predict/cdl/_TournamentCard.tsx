"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  name: string;
  slug: string;
  status: string;
  start_date: string;
  end_date: string;
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  live:     { bg: "#36D39920", color: "#36D399", border: "#36D39940", label: "Live"     },
  upcoming: { bg: "#F5C84220", color: "#F5C842", border: "#F5C84240", label: "À venir"  },
  finished: { bg: "#FFFFFF10", color: "#888",    border: "#FFFFFF20", label: "Terminé"  },
};

export default function TournamentCard({ name, slug, status, start_date, end_date }: Props) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.upcoming;
  const isLive = status === "live";

  return (
    <Link
      href={`/predict/cdl/${slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "20px 24px", borderRadius: 12, textDecoration: "none",
        border: `1px solid ${isLive ? "#36D39940" : "var(--border)"}`,
        background: isLive ? "#36D39908" : "var(--surface)",
        opacity: status === "finished" ? 0.7 : 1,
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 0.15s, background 0.15s, opacity 0.15s",
      }}
    >
      <span style={{
        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
        flexShrink: 0,
        background: s.bg,
        color:      s.color,
        border:     `1px solid ${s.border}`,
        fontFamily: "var(--font-head)", textTransform: "uppercase", letterSpacing: 1,
      }}>
        {s.label}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-head)", fontWeight: 800, fontSize: "clamp(14px, 3vw, 18px)",
          color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>
          {new Date(start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          {" – "}
          {new Date(end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
        <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Link>
  );
}
