"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createProfile } from "./actions";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (username.length < 3) { setError("Pseudo : 3 caractères minimum"); return; }
    if (password.length < 6) { setError("Mot de passe : 6 caractères minimum"); return; }
    setLoading(true);

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (data.user) {
      const { error: profileError } = await createProfile(data.user.id, username);
      if (profileError) { setError("Pseudo déjà pris : " + profileError); setLoading(false); return; }
    }

    window.location.href = "/predict";
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-2">
          <span style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 900, color: "var(--accent)", letterSpacing: 2 }}>VCT</span>
          <span style={{ color: "var(--text3)" }}>·</span>
          <span style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 900, color: "var(--text)", letterSpacing: 2 }}>PREDICT</span>
        </div>
        <p style={{ color: "var(--text3)", fontSize: 14 }}>Crée ton compte</p>
      </div>

      <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1 }}>Pseudo</label>
            <input
              type="text" required value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="monpseudo"
              className="rounded-lg px-3 h-10 outline-none"
              style={{ background: "var(--bg3)", border: "1px solid var(--border2)", color: "var(--text)", fontSize: 14 }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1 }}>Email</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com"
              className="rounded-lg px-3 h-10 outline-none"
              style={{ background: "var(--bg3)", border: "1px solid var(--border2)", color: "var(--text)", fontSize: 14 }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1 }}>Mot de passe</label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-lg px-3 h-10 outline-none"
              style={{ background: "var(--bg3)", border: "1px solid var(--border2)", color: "var(--text)", fontSize: 14 }}
            />
          </div>

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(255,70,85,.1)", border: "1px solid rgba(255,70,85,.3)", color: "var(--accent)" }}>
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            className="h-10 rounded-lg font-semibold transition-all cursor-pointer disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff", fontFamily: "var(--font-head)", fontSize: 16, letterSpacing: 1 }}
          >
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>
      </div>

      <p className="text-center mt-4" style={{ fontSize: 14, color: "var(--text3)" }}>
        Déjà un compte ?{" "}
        <Link href="/login" style={{ color: "var(--accent)" }} className="hover:underline">

          Se connecter
        </Link>
      </p>
    </div>
  );
}
