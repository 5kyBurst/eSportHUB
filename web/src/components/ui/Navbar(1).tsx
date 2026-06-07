"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { href: "/predict",     label: "Prédictions" },
  { href: "/leaderboard", label: "Classement"  },
  { href: "/shop",        label: "Shop"        },
  { href: "/collection",  label: "Collection"  },
];

export default function Navbar({ username, points }: { username: string; points: number }) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 100, height: "var(--nav-h)", background: "rgba(10,13,21,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center gap-6 h-full px-6 max-w-screen-xl mx-auto">
        {/* Logo */}
        <Link href="/predict" className="flex items-center gap-1 shrink-0">
          <span style={{ fontFamily: "var(--font-head)", fontSize: 20, fontWeight: 900, color: "var(--accent)", letterSpacing: 2 }}>VCT</span>
          <span style={{ color: "var(--text3)", margin: "0 2px" }}>·</span>
          <span style={{ fontFamily: "var(--font-head)", fontSize: 20, fontWeight: 900, color: "var(--text)", letterSpacing: 2 }}>PREDICT</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1 flex-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className="px-3 py-1 rounded-md text-sm font-medium transition-all"
                style={{
                  fontFamily: "var(--font-head)", fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                  color: active ? "var(--text)" : "var(--text3)",
                  background: active ? "var(--surface2)" : "transparent",
                }}>
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Points */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12">
              <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" fill="#FF4655"/>
            </svg>
            <span style={{ fontFamily: "var(--font-head)", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
              {points.toLocaleString()} pts
            </span>
          </div>

          {/* Avatar + logout */}
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all cursor-pointer"
            style={{ background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text2)", fontSize: 13 }}
            title="Se déconnecter">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--accent)", color: "#fff" }}>
              {username[0]?.toUpperCase()}
            </div>
            <span style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600 }}>{username}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
