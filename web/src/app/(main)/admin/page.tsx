"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Tournament = {
  id: string;
  name: string;
  slug: string;
  status: string;
  liquipedia_url: string | null;
  match_count?: number;
  finished_count?: number;
  pred_count?: number;
  uncalculated_count?: number;
};

export default function AdminPage() {
  const [allowed, setAllowed]           = useState<boolean | null>(null);
  const [tournaments, setTournaments]   = useState<Tournament[]>([]);
  const [editUrl, setEditUrl]           = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState<Record<string, boolean>>({});
  const [messages, setMessages]         = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [syncing, setSyncing]           = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); return; }

      const res = await fetch("/api/admin/me");
      setAllowed(res.ok);
      if (res.ok) loadTournaments();
    }
    init();
  }, []);

  async function loadTournaments() {
    const supabase = createClient();
    const { data: tours } = await supabase
      .from("tournaments")
      .select("id, name, slug, status, liquipedia_url")
      .order("created_at", { ascending: false });

    if (!tours) return;

    // Charge les stats par tournoi
    const enriched: Tournament[] = await Promise.all(
      tours.map(async t => {
        const { data: matches } = await supabase
          .from("matches")
          .select("id, status")
          .eq("tournament_id", t.id);

        const matchIds = matches?.map(m => m.id) ?? [];
        const finished = matches?.filter(m => m.status === "finished").length ?? 0;

        let predCount = 0;
        let uncalcCount = 0;
        if (matchIds.length) {
          const { data: preds } = await supabase
            .from("predictions")
            .select("id, points_earned")
            .in("match_id", matchIds);
          predCount   = preds?.length ?? 0;
          uncalcCount = preds?.filter(p => p.points_earned === null).length ?? 0;
        }

        return {
          ...t,
          match_count:       matches?.length ?? 0,
          finished_count:    finished,
          pred_count:        predCount,
          uncalculated_count: uncalcCount,
        };
      })
    );

    setTournaments(enriched);
    const urls: Record<string, string> = {};
    enriched.forEach(t => { urls[t.id] = t.liquipedia_url ?? ""; });
    setEditUrl(urls);
  }

  async function saveUrl(id: string) {
    setLoading(l => ({ ...l, [id]: true }));
    const res = await fetch("/api/admin/save-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: id, url: editUrl[id] }),
    });
    const data = await res.json();
    setMessages(m => ({ ...m, [id]: res.ok ? "URL sauvegardée ✓" : `Erreur: ${data.error}` }));
    setLoading(l => ({ ...l, [id]: false }));
    setTimeout(() => setMessages(m => ({ ...m, [id]: "" })), 3000);
  }

  async function syncNow() {
    setSyncing(true);
    const res = await fetch("/api/admin/sync-now", { method: "POST" });
    const data = await res.json();
    alert(res.ok ? `Sync OK — ${data.synced} match(s) mis à jour` : `Erreur: ${data.error}`);
    setSyncing(false);
    loadTournaments();
  }

  async function calculatePoints(id: string) {
    setLoading(l => ({ ...l, [`calc_${id}`]: true }));
    const res = await fetch("/api/admin/calculate-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: id }),
    });
    const data = await res.json();
    setMessages(m => ({ ...m, [id]: res.ok ? `${data.updated} prédiction(s) calculées ✓` : `Erreur: ${data.error}` }));
    setLoading(l => ({ ...l, [`calc_${id}`]: false }));
    loadTournaments();
  }

  async function closeSeason(id: string) {
    setConfirmClose(null);
    setLoading(l => ({ ...l, [`close_${id}`]: true }));
    const res = await fetch("/api/admin/close-season", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: id }),
    });
    const data = await res.json();
    setMessages(m => ({ ...m, [id]: res.ok ? `Saison clôturée — ${data.credited} profil(s) crédités ✓` : `Erreur: ${data.error}` }));
    setLoading(l => ({ ...l, [`close_${id}`]: false }));
    loadTournaments();
  }

  if (allowed === null) return <div style={{ padding: 40, color: "var(--text3)" }}>Chargement…</div>;
  if (allowed === false) return <div style={{ padding: 40, color: "#F87171" }}>Accès refusé.</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 900, color: "var(--text)", textTransform: "uppercase" }}>
          Admin — Tournois
        </h1>
        <button
          onClick={syncNow}
          disabled={syncing}
          style={{
            padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            background: syncing ? "var(--bg2)" : "#3B82F6", color: "#fff",
            fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13,
          }}
        >
          {syncing ? "Sync en cours…" : "⟳ Sync Liquipedia maintenant"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {tournaments.map(t => (
          <div key={t.id} style={{
            border: "1px solid var(--border)", borderRadius: 12,
            padding: 20, background: "var(--surface)",
          }}>
            {/* Header tournoi */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{
                fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 16, color: "var(--text)",
              }}>{t.name}</span>
              <span style={{
                padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: t.status === "live" ? "#36D39920" : t.status === "finished" ? "#6B728020" : "#F5C84220",
                color:      t.status === "live" ? "#36D399"   : t.status === "finished" ? "#9CA3AF"   : "#F5C842",
                border: `1px solid ${t.status === "live" ? "#36D39940" : t.status === "finished" ? "#6B728040" : "#F5C84240"}`,
              }}>{t.status}</span>

              {/* Stats */}
              <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
                {t.finished_count}/{t.match_count} matchs terminés &nbsp;·&nbsp;
                {t.pred_count} prédictions &nbsp;·&nbsp;
                {t.uncalculated_count} non calculées
              </span>
            </div>

            {/* URL Liquipedia */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                type="url"
                placeholder="https://liquipedia.net/callofduty/..."
                value={editUrl[t.id] ?? ""}
                onChange={e => setEditUrl(u => ({ ...u, [t.id]: e.target.value }))}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 7,
                  border: "1px solid var(--border2)", background: "var(--bg2)",
                  color: "var(--text)", fontSize: 13, outline: "none",
                }}
              />
              <button
                onClick={() => saveUrl(t.id)}
                disabled={loading[t.id]}
                style={{
                  padding: "8px 16px", borderRadius: 7, border: "none",
                  background: "var(--border2)", color: "var(--text)", cursor: "pointer",
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                }}
              >
                {loading[t.id] ? "…" : "Sauver"}
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => calculatePoints(t.id)}
                disabled={!!loading[`calc_${t.id}`] || t.finished_count === 0}
                style={{
                  padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: "#F5C84220", color: "#F5C842",
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                  opacity: t.finished_count === 0 ? 0.4 : 1,
                }}
              >
                {loading[`calc_${t.id}`] ? "Calcul…" : "Calculer les points"}
              </button>

              {t.status !== "finished" && (
                confirmClose === t.id ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#F87171" }}>Confirmer la clôture ?</span>
                    <button
                      onClick={() => closeSeason(t.id)}
                      style={{
                        padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "#F8717130", color: "#F87171",
                        fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                      }}
                    >
                      Oui, clôturer
                    </button>
                    <button
                      onClick={() => setConfirmClose(null)}
                      style={{
                        padding: "8px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "var(--border2)", color: "var(--text)",
                        fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClose(t.id)}
                    disabled={!!loading[`close_${t.id}`] || (t.uncalculated_count ?? 0) > 0}
                    title={(t.uncalculated_count ?? 0) > 0 ? "Calcule les points d'abord" : ""}
                    style={{
                      padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                      background: "#F8717120", color: "#F87171",
                      fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                      opacity: (t.uncalculated_count ?? 0) > 0 ? 0.4 : 1,
                    }}
                  >
                    Clôturer la saison
                  </button>
                )
              )}
            </div>

            {/* Message feedback */}
            {messages[t.id] && (
              <p style={{ marginTop: 10, fontSize: 12, color: messages[t.id].startsWith("Erreur") ? "#F87171" : "#36D399" }}>
                {messages[t.id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
