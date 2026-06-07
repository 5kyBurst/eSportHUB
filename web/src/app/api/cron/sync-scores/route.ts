import { NextResponse } from "next/server";
import { syncScores } from "@/lib/sync-scores";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncScores();
  return NextResponse.json(result);
}
