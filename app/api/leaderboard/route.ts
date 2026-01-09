export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getLeaderboardData } from "@/lib/riotData";
import { NextResponse } from "next/server";

type LeaderboardCache = {
  value: { results: unknown };
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __leaderboardCache: LeaderboardCache | undefined;
}

export async function GET() {
  const now = Date.now();
  const cached = globalThis.__leaderboardCache;
  if (cached && now < cached.expiresAt) {
    return NextResponse.json(cached.value, {
      headers: { "x-leaderboard-cache": "HIT" }
    });
  }

  const results = await getLeaderboardData();
  const value = { results };
  globalThis.__leaderboardCache = {
    value,
    expiresAt: now + 30_000
  };

  return NextResponse.json(value, {
    headers: { "x-leaderboard-cache": "MISS" }
  });
}
