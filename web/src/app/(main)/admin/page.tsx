"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type ImportedMatch = {
  scheduledAt: string;
  teamA: string;
  teamB: string;
  roundLabel: string;
  matchKey: string;
};

type Match = {
  id: string;
  match_key: string;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
  status: string;
  round_label: string;
  scheduled_at: string;
};

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
  const [confirmClose, setConfirmClose]     = useState<string | null>(null);
  const [syncing, setSyncing]               = useState(false);
  // Import Liquipedia
  const [importPreview, setImportPreview]   = useState<Record<string, ImportedMatch[]>>({});
  const [importing, setImporting]           = useState<Record<string, boolean>>({});
  // Formulaire nouveau tournoi
  const [showNew, setShowNew]   = useState(false);
  const [newTournoi, setNewTournoi] = useState({
    name: "", slug: "", format: "swiss", game: "cdl",
    startDate: "", endDate: "", liquipediaUrl: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Éditeur de matchs : tournamentId ouvert
  const [openMatches, setOpenMatches]   = useState<string | null>(null);
  const [matches, setMatches]           = useState<Match[]>([]);
  const [scoreEdits, setScoreEdits]     = useState<Record<string, { a: string; b: string; status: string }>>({});

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

  function toSlug(name: string) {
    return name.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function createTournament() {
    setCreating(true); setCreateError(null);
    const res = await fetch("/api/admin/create-tournament", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:          newTournoi.name,
        slug:          newTournoi.slug,
        format:        newTournoi.format,
        game:          newTournoi.game,
        startDate:     newTournoi.startDate,
        endDate:       newTournoi.endDate,
        liquipediaUrl: newTournoi.liquipediaUrl || undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateError(data.error); return; }
    setShowNew(false);
    setNewTournoi({ name: "", slug: "", format: "swiss", game: "cdl", startDate: "", endDate: "", liquipediaUrl: "" });
    loadTournaments();
  }

  async function loadTournaments() {
    const supabase = createClient();
    const { data: tours } = await supabase
      .from("tournaments")
      .select("id, name, slug, status, liquipedia_url")
      .order("created_at", { ascending: false });
    if (!tours) return;

    const enriched: Tournament[] = await Promise.all(
      tours.map(async t => {
        const { data: mList } = await supabase.from("matches").select("id, status").eq("tournament_id", t.id);
        const matchIds = mList?.map(m => m.id) ?? [];
        const finished = mList?.filter(m => m.status === "finished").length ?? 0;
        let predCount = 0, uncalcCount = 0;
        if (matchIds.length) {
          const { data: preds } = await supabase.from("predictions").select("id, points_earned").in("match_id", matchIds);
          predCount   = preds?.length ?? 0;
          uncalcCount = preds?.filter(p => p.points_earned === null).length ?? 0;
        }
        return { ...t, match_count: mList?.length ?? 0, finished_count: finished, pred_count: predCount, uncalculated_count: uncalcCount };
      })
    );
    setTournaments(enriched);
    const urls: Record<string, string> = {};
    enriched.forEach(t => { urls[t.id] = t.liquipedia_url ?? ""; });
    setEditUrl(urls);
  }

  async function loadMatches(tournamentId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("matches")
      .select("id, match_key, team_a, team_b, score_a, score_b, status, round_label, scheduled_at")
      .eq("tournament_id", tournamentId)
      .order("scheduled_at", { ascending: true });
    if (!data) return;
    setMatches(data as Match[]);
    const edits: Record<string, { a: string; b: string; status: string }> = {};
    data.forEach(m => {
      edits[m.id] = {
        a: m.score_a?.toString() ?? "",
        b: m.score_b?.toString() ?? "",
        status: m.status,
      };
    });
    setScoreEdits(edits);
  }

  async function toggleMatches(tournamentId: string) {
    if (openMatches === tournamentId) { setOpenMatches(null); return; }
    setOpenMatches(tournamentId);
    await loadMatches(tournamentId);
  }

  async function saveMatch(matchId: string) {
    const e = scoreEdits[matchId];
    setLoading(l => ({ ...l, [`m_${matchId}`]: true }));
    const res = await fetch("/api/admin/update-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        scoreA: e.a !== "" ? parseInt(e.a) : null,
        scoreB: e.b !== "" ? parseInt(e.b) : null,
        status: e.status,
      }),
    });
    setLoading(l => ({ ...l, [`m_${matchId}`]: false }));
    if (!res.ok) { const d = await res.json(); alert(`Erreur: ${d.error}`); }
    else { await loadMatches(openMatches!); loadTournaments(); }
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
    setSyncing(false);
    if (!res.ok) { alert(`Erreur: ${data.error}`); return; }

    const lines: string[] = [`✓ ${data.synced} match(s) total mis à jour\n`];
    for (const t of (data.tournaments ?? [])) {
      let line = `• ${t.name}: ${t.updated} mis à jour`;
      if (t.skipped > 0) line += `, ${t.skipped} non trouvé(s) dans Liquipedia`;
      if (t.error)        line += `\n  ⚠ ${t.error}`;
      lines.push(line);
    }
    alert(lines.join("\n"));
    loadTournaments();
  }

  async function fixSchedules(tournamentSlug: string, id: string) {
    setLoading(l => ({ ...l, [`fix_${id}`]: true }));
    const res = await fetch("/api/admin/fix-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentSlug,
        // +25h : corriger les Semaine 2 et 3 (1 jour + 1h en avance dans le seed)
        roundLabels: [
          "Semaine 2 · Jour 3",
          "Semaine 3 · Jour 1", "Semaine 3 · Jour 2", "Semaine 3 · Jour 3",
        ],
        shiftMs: 25 * 60 * 60 * 1000,
      }),
    });
    const data = await res.json();
    setMessages(m => ({ ...m, [id]: res.ok ? `${data.updated} scheduled_at corrigés ✓` : `Erreur: ${data.error}` }));
    setLoading(l => ({ ...l, [`fix_${id}`]: false }));
  }

  async function importMatches(id: string, url: string, confirm = false) {
    if (!url) { alert("Aucune URL Liquipedia définie pour ce tournoi."); return; }
    setImporting(i => ({ ...i, [id]: true }));
    const res = await fetch("/api/admin/import-matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: id, liquipediaUrl: url, dryRun: !confirm }),
    });
    const data = await res.json();
    setImporting(i => ({ ...i, [id]: false }));
    if (!res.ok) {
      setMessages(m => ({ ...m, [id]: `Erreur import: ${data.error}` }));
      return;
    }
    if (!confirm) {
      // Dry-run → afficher le preview
      setImportPreview(p => ({ ...p, [id]: data.matches }));
    } else {
      // Confirmer l'import
      setImportPreview(p => ({ ...p, [id]: [] }));
      setMessages(m => ({ ...m, [id]: `${data.inserted} match(s) importés ✓` }));
      loadTournaments();
    }
  }

  async function calculatePoints(id: string) {
    setLoading(l => ({ ...l, [`calc_${id}`]: true }));
    const res = await fetch("/api/admin/calculate-points", {
      method: "POST", headers: { "Content-Type": "application/json" },
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: id }),
    });
    const data = await res.json();
    setMessages(m => ({ ...m, [id]: res.ok ? `Saison clôturée — ${data.credited} profil(s) crédités ✓` : `Erreur: ${data.error}` }));
    setLoading(l => ({ ...l, [`close_${id}`]: false }));
    loadTournaments();
  }

  if (allowed === null) return <div style={{ padding: 40, color: "var(--text3)" }}>Chargement…</div>;
  if (allowed === false) return <div style={{ padding: 40, color: "#F87171" }}>Accès refusé.</div>;

  // Groupes de matchs par round_label pour l'éditeur
  const matchGroups = matches.reduce<Record<string, Match[]>>((acc, m) => {
    (acc[m.round_label] = acc[m.round_label] ?? []).push(m);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 900, color: "var(--text)", textTransform: "uppercase" }}>
          Admin — Tournois
        </h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setShowNew(v => !v); setCreateError(null); }} style={{
            padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            background: showNew ? "#36D39920" : "#36D39930", color: "#36D399",
            fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13,
          }}>
            {showNew ? "✕ Annuler" : "+ Nouveau tournoi"}
          </button>
          <button onClick={syncNow} disabled={syncing} style={{
            padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            background: syncing ? "var(--bg2)" : "#3B82F6", color: "#fff",
            fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13,
          }}>
            {syncing ? "Sync en cours…" : "⟳ Sync Liquipedia"}
          </button>
        </div>
      </div>

      {/* ── Formulaire nouveau tournoi ───────────────────────────────────────── */}
      {showNew && (
        <div style={{
          border: "1px solid #36D39940", borderRadius: 12,
          background: "#36D39908", padding: 24, marginBottom: 24,
        }}>
          <p style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 13, color: "#36D399", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
            Nouveau tournoi
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {/* Nom */}
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Nom</label>
              <input type="text" placeholder="CDL 2026 Stage 5 Minor"
                value={newTournoi.name}
                onChange={e => {
                  const n = e.target.value;
                  setNewTournoi(v => ({ ...v, name: n, slug: toSlug(n) }));
                }}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Slug */}
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Slug (URL)</label>
              <input type="text" placeholder="cdl-2026-s5-minor"
                value={newTournoi.slug}
                onChange={e => setNewTournoi(v => ({ ...v, slug: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text3)", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Format */}
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Format</label>
              <select value={newTournoi.format} onChange={e => setNewTournoi(v => ({ ...v, format: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text)", fontSize: 13, outline: "none" }}>
                <option value="swiss">Swiss</option>
                <option value="bracket">Bracket (simple élimination)</option>
                <option value="double_elim">Bracket (double élimination)</option>
                <option value="roundrobin">Round Robin</option>
              </select>
            </div>

            {/* Jeu */}
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Jeu</label>
              <select value={newTournoi.game} onChange={e => setNewTournoi(v => ({ ...v, game: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text)", fontSize: 13, outline: "none" }}>
                <option value="cdl">CDL</option>
                <option value="vct">VCT</option>
              </select>
            </div>

            {/* Dates */}
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Date début</label>
              <input type="date" value={newTournoi.startDate} onChange={e => setNewTournoi(v => ({ ...v, startDate: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text)", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Date fin</label>
              <input type="date" value={newTournoi.endDate} onChange={e => setNewTournoi(v => ({ ...v, endDate: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text)", fontSize: 13, outline: "none" }} />
            </div>

            {/* URL Liquipedia (optionnel) */}
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>URL Liquipedia <span style={{ color: "var(--text3)", fontWeight: 400 }}>(optionnel)</span></label>
              <input type="url" placeholder="https://liquipedia.net/callofduty/..."
                value={newTournoi.liquipediaUrl}
                onChange={e => setNewTournoi(v => ({ ...v, liquipediaUrl: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {createError && (
            <p style={{ color: "#F87171", fontSize: 12, fontFamily: "var(--font-head)", marginBottom: 12 }}>{createError}</p>
          )}

          <button onClick={createTournament} disabled={creating || !newTournoi.name || !newTournoi.slug || !newTournoi.startDate || !newTournoi.endDate}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#36D399", color: "#000",
              fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 13,
              opacity: (!newTournoi.name || !newTournoi.slug || !newTournoi.startDate || !newTournoi.endDate) ? 0.4 : 1,
            }}>
            {creating ? "Création…" : "✓ Créer le tournoi"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {tournaments.map(t => (
          <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
            {/* Header */}
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 16, color: "var(--text)" }}>{t.name}</span>
                <span style={{
                  padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: t.status === "live" ? "#36D39920" : t.status === "finished" ? "#6B728020" : "#F5C84220",
                  color:      t.status === "live" ? "#36D399"   : t.status === "finished" ? "#9CA3AF"   : "#F5C842",
                  border: `1px solid ${t.status === "live" ? "#36D39940" : t.status === "finished" ? "#6B728040" : "#F5C84240"}`,
                }}>{t.status}</span>
                <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
                  {t.finished_count}/{t.match_count} terminés · {t.pred_count} prédictions · {t.uncalculated_count} non calculées
                </span>
              </div>

              {/* URL Liquipedia */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="url" placeholder="https://liquipedia.net/callofduty/..."
                  value={editUrl[t.id] ?? ""}
                  onChange={e => setEditUrl(u => ({ ...u, [t.id]: e.target.value }))}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 7,
                    border: "1px solid var(--border2)", background: "var(--bg2)",
                    color: "var(--text)", fontSize: 13, outline: "none",
                  }}
                />
                <button onClick={() => saveUrl(t.id)} disabled={loading[t.id]} style={{
                  padding: "8px 16px", borderRadius: 7, border: "none",
                  background: "var(--border2)", color: "var(--text)", cursor: "pointer",
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                }}>
                  {loading[t.id] ? "…" : "Sauver"}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {/* Éditeur scores */}
                <button onClick={() => toggleMatches(t.id)} style={{
                  padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: openMatches === t.id ? "#3B82F630" : "var(--border2)",
                  color: openMatches === t.id ? "#3B82F6" : "var(--text)",
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                }}>
                  {openMatches === t.id ? "▲ Fermer les scores" : "✏ Éditer les scores"}
                </button>

                {t.slug === "cdl-2026-s4" && (
                  <button onClick={() => fixSchedules(t.slug, t.id)}
                    disabled={!!loading[`fix_${t.id}`]}
                    title="Corrige les scheduled_at S2J3 + S3 (+25h)"
                    style={{
                      padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                      background: "#8B5CF620", color: "#8B5CF6",
                      fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                    }}>
                    {loading[`fix_${t.id}`] ? "…" : "🔧 Fix dates S2J3+S3"}
                  </button>
                )}

                {/* Import depuis Liquipedia */}
                {editUrl[t.id] && (
                  importPreview[t.id]?.length > 0 ? (
                    <button onClick={() => importMatches(t.id, editUrl[t.id], true)}
                      disabled={importing[t.id]}
                      style={{
                        padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "#36D39930", color: "#36D399",
                        fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                      }}>
                      {importing[t.id] ? "Import…" : `✓ Confirmer (${importPreview[t.id].length} matchs)`}
                    </button>
                  ) : (
                    <button onClick={() => importMatches(t.id, editUrl[t.id])}
                      disabled={importing[t.id]}
                      title="Parse le wikitext Liquipedia pour récupérer les dates/heures exactes"
                      style={{
                        padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "#06B6D420", color: "#06B6D4",
                        fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                      }}>
                      {importing[t.id] ? "Parsing…" : "📥 Importer depuis Liquipedia"}
                    </button>
                  )
                )}

                <button onClick={() => calculatePoints(t.id)}
                  disabled={!!loading[`calc_${t.id}`] || t.finished_count === 0}
                  style={{
                    padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                    background: "#F5C84220", color: "#F5C842",
                    fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                    opacity: t.finished_count === 0 ? 0.4 : 1,
                  }}>
                  {loading[`calc_${t.id}`] ? "Calcul…" : "Calculer les points"}
                </button>

                {confirmClose === t.id ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#F87171" }}>Confirmer ?</span>
                      <button onClick={() => closeSeason(t.id)} style={{
                        padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "#F8717130", color: "#F87171",
                        fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                      }}>Oui, clôturer</button>
                      <button onClick={() => setConfirmClose(null)} style={{
                        padding: "8px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "var(--border2)", color: "var(--text)",
                        fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                      }}>Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmClose(t.id)}
                      disabled={!!loading[`close_${t.id}`] || (t.uncalculated_count ?? 0) > 0}
                      title={(t.uncalculated_count ?? 0) > 0 ? "Calcule les points d'abord" : ""}
                      style={{
                        padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "#F8717120", color: "#F87171",
                        fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                        opacity: (t.uncalculated_count ?? 0) > 0 ? 0.4 : 1,
                      }}>
                      {t.status === "finished" ? "Re-clôturer" : "Clôturer la saison"}
                    </button>
                  )}
              </div>

              {messages[t.id] && (
                <p style={{ marginTop: 10, fontSize: 12, color: messages[t.id].startsWith("Erreur") ? "#F87171" : "#36D399" }}>
                  {messages[t.id]}
                </p>
              )}
            </div>

            {/* ── Prévisualisation import Liquipedia ── */}
            {(importPreview[t.id]?.length ?? 0) > 0 && (
              <div style={{ borderTop: "1px solid #06B6D430", padding: 20, background: "#06B6D408" }}>
                <p style={{ fontFamily: "var(--font-head)", fontSize: 11, color: "#06B6D4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                  Prévisualisation — {importPreview[t.id].length} matchs parsés depuis Liquipedia
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                  {importPreview[t.id].map(m => (
                    <div key={m.matchKey} style={{
                      display: "grid", gridTemplateColumns: "140px 1fr 8px 1fr 120px", alignItems: "center", gap: 8,
                      padding: "6px 10px", borderRadius: 6, background: "var(--bg2)", fontSize: 12,
                    }}>
                      <span style={{ color: "var(--text3)", fontFamily: "var(--font-head)", fontSize: 11 }}>
                        {new Date(m.scheduledAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} CEST
                      </span>
                      <span style={{ color: "var(--text)", fontFamily: "var(--font-head)", fontWeight: 700, textAlign: "right" }}>{m.teamA}</span>
                      <span style={{ color: "var(--text3)", textAlign: "center" }}>vs</span>
                      <span style={{ color: "var(--text)", fontFamily: "var(--font-head)", fontWeight: 700 }}>{m.teamB}</span>
                      <span style={{ color: "var(--text3)", fontSize: 11 }}>{m.roundLabel}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button onClick={() => importMatches(t.id, editUrl[t.id], true)} style={{
                    padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer",
                    background: "#36D399", color: "#000",
                    fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 12,
                  }}>
                    ✓ Importer {importPreview[t.id].length} matchs
                  </button>
                  <button onClick={() => setImportPreview(p => ({ ...p, [t.id]: [] }))} style={{
                    padding: "8px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                    background: "var(--border2)", color: "var(--text)",
                    fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                  }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* ── Éditeur de scores ── */}
            {openMatches === t.id && (
              <div style={{ borderTop: "1px solid var(--border)", padding: 20 }}>
                <p style={{ fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                  Scores — saisis puis clique Sauver par ligne
                </p>
                {Object.entries(matchGroups).map(([roundLabel, dayMatches]) => (
                  <div key={roundLabel} style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                      {roundLabel}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {dayMatches.map(m => {
                        const e = scoreEdits[m.id] ?? { a: "", b: "", status: "upcoming" };
                        const isSaving = loading[`m_${m.id}`];
                        return (
                          <div key={m.id} style={{
                            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                            padding: "8px 12px", borderRadius: 8, background: "var(--bg2)",
                            border: "1px solid var(--border2)",
                          }}>
                            {/* Équipes */}
                            <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12, color: "var(--text)", minWidth: 140, flex: 1 }}>
                              {m.team_a}
                            </span>

                            {/* Score A */}
                            <input type="number" min={0} max={3} value={e.a}
                              onChange={ev => setScoreEdits(s => ({ ...s, [m.id]: { ...s[m.id], a: ev.target.value } }))}
                              style={{ width: 44, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text)", textAlign: "center", fontSize: 14, fontFamily: "var(--font-head)", fontWeight: 700 }}
                            />
                            <span style={{ color: "var(--text3)", fontFamily: "var(--font-head)", fontWeight: 700 }}>–</span>
                            {/* Score B */}
                            <input type="number" min={0} max={3} value={e.b}
                              onChange={ev => setScoreEdits(s => ({ ...s, [m.id]: { ...s[m.id], b: ev.target.value } }))}
                              style={{ width: 44, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text)", textAlign: "center", fontSize: 14, fontFamily: "var(--font-head)", fontWeight: 700 }}
                            />

                            <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12, color: "var(--text)", minWidth: 140, flex: 1, textAlign: "right" }}>
                              {m.team_b}
                            </span>

                            {/* Statut */}
                            <select value={e.status}
                              onChange={ev => setScoreEdits(s => ({ ...s, [m.id]: { ...s[m.id], status: ev.target.value } }))}
                              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-head)" }}
                            >
                              <option value="upcoming">upcoming</option>
                              <option value="live">live</option>
                              <option value="finished">finished</option>
                            </select>

                            {/* Bouton sauver */}
                            <button onClick={() => saveMatch(m.id)} disabled={isSaving} style={{
                              padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                              background: "#36D39920", color: "#36D399",
                              fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                            }}>
                              {isSaving ? "…" : "Sauver"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
