import { NextResponse } from "next/server";
import { syncScores } from "@/lib/sync-scores";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get("secret");
  const secret = process.env.CRON_SECRET;

  const authorized =
    auth === `Bearer ${secret}` ||
    (querySecret && querySecret === secret);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncScores();
  return NextResponse.json(result);
}
