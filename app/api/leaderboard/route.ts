export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getLeaderboardCached } from "@/lib/leaderboardCache";
import { getLeaderboardData } from "@/lib/riotData";
import { NextResponse } from "next/server";

export async function GET() {
  const { value, status } = await getLeaderboardCached(
    () => getLeaderboardData(),
    60_000
  );
  return NextResponse.json(value, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "x-leaderboard-cache": status
    }
  });
}
