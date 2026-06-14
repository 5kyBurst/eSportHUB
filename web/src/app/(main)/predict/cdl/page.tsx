import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TournamentCard from "./_TournamentCard";

export default async function CDLListPage() {
  const supabase = await createClient();

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, slug, status, start_date, end_date")
    .eq("game", "cdl")
    .order("start_date", { ascending: false });

  return (
    <div className="w-full max-w-5xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/logos/cdl.png" alt="CDL" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          <div>
            <h1 style={{
              fontFamily: "var(--font-head)", fontSize: "clamp(20px, 5vw, 30px)",
              fontWeight: 900, color: "var(--text)", letterSpacing: 1, textTransform: "uppercase", lineHeight: 1,
            }}>Call of Duty League</h1>
            <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 4 }}>
              Choisis une compétition pour faire tes prédictions
            </p>
          </div>
        </div>
      </div>

      {/* Liste des tournois */}
      {!tournaments?.length ? (
        <div style={{
          padding: 32, borderRadius: 12, border: "1px solid var(--border)",
          background: "var(--surface)", textAlign: "center",
          color: "var(--text3)", fontFamily: "var(--font-head)", fontSize: 14,
        }}>
          Aucune compétition CDL en cours pour le moment.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tournaments.map(t => (
            <TournamentCard
              key={t.id}
              name={t.name}
              slug={t.slug}
              status={t.status}
              start_date={t.start_date}
              end_date={t.end_date}
            />
          ))}
        </div>
      )}
    </div>
  );
}
