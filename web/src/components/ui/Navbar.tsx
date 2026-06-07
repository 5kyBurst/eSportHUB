"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { href: "/predict",     label: "Prédictions", short: "Préd." },
  { href: "/leaderboard", label: "Classement",  short: "Class." },
  { href: "/shop",        label: "Shop",        short: "Shop"   },
  { href: "/collection",  label: "Collection",  short: "Coll."  },
];

export default function Navbar({ username, points }: { username: string; points: number }) {
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      height: "var(--nav-h)",
      background: "rgba(10,13,21,0.96)",
      backdropFilter: "blur(16px)",
      borderBottom: "1px solid var(--border)",
    }}>
      <div className="flex items-center gap-2 sm:gap-6 h-full w-full max-w-5xl mx-auto px-6 sm:px-10">

        {/* Logo */}
        <Link href="/predict" className="flex items-center gap-1 shrink-0">
          <span style={{ fontFamily: "var(--font-head)", fontSize: "clamp(16px, 3vw, 20px)", fontWeight: 900, color: "var(--accent)", letterSpacing: 2 }}>VCT</span>
          <span style={{ color: "var(--text3)", margin: "0 2px" }}>·</span>
          <span style={{ fontFamily: "var(--font-head)", fontSize: "clamp(16px, 3vw, 20px)", fontWeight: 900, color: "var(--text)", letterSpacing: 2 }}>PREDICT</span>
        </Link>

        {/* Nav links — scrollable on mobile */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {NAV_LINKS.map(({ href, label, short }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className="px-2 sm:px-3 py-1 rounded-md shrink-0 transition-all"
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "clamp(11px, 1.8vw, 14px)",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: active ? "var(--text)" : "var(--text3)",
                  background: active ? "var(--surface2)" : "transparent",
                  whiteSpace: "nowrap",
                }}
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="inline sm:hidden">{short}</span>
              </Link>
            );
          })}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Points */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
            <svg width="11" height="11" viewBox="0 0 12 12">
              <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" fill="#FF4655"/>
            </svg>
            <span style={{ fontFamily: "var(--font-head)", fontSize: "clamp(11px, 1.8vw, 14px)", fontWeight: 800, color: "var(--text)" }}>
              <span className="hidden sm:inline">{points.toLocaleString()} pts</span>
              <span className="inline sm:hidden">{points.toLocaleString()}</span>
            </span>
          </div>

          {/* Avatar + logout */}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-lg transition-all cursor-pointer"
            style={{ background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text2)" }}
            title="Se déconnecter"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--accent)", color: "#fff" }}>
              {username[0]?.toUpperCase()}
            </div>
            <span className="hidden sm:inline" style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600 }}>
              {username}
            </span>
          </button>
        </div>

      </div>
    </nav>
  );
}
