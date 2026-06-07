import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/ui/Navbar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, points")
    .eq("id", user.id)
    .single() as { data: { username: string; points: number } | null };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Navbar username={profile?.username ?? "…"} points={profile?.points ?? 0} />
      <main className="flex-1 w-full">{children}</main>
    </div>
  );
}
