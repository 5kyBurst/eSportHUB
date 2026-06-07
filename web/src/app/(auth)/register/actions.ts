"use server";

import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createProfile(userId: string, username: string) {
  const { error } = await adminClient
    .from("profiles")
    .insert({ id: userId, username, points: 0 });

  if (error) return { error: error.message };
  return { error: null };
}
