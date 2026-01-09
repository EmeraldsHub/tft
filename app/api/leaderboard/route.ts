export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getLeaderboardData } from "@/lib/riotData";
import { NextResponse } from "next/server";

type LeaderboardCache = {
  value: { results: unknown };
  expiresAt: number;
};

const CACHE_TTL_MS = 5_000;

declare global {
  // eslint-disable-next-line no-var
  var __leaderboardCache: LeaderboardCache | undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cacheControl = request.headers.get("cache-control") ?? "";
  const bypassCache =
    cacheControl.includes("no-cache") || url.searchParams.get("fresh") === "1";
  const now = Date.now();
  const cached = globalThis.__leaderboardCache;
  if (!bypassCache && cached && now < cached.expiresAt) {
    return NextResponse.json(cached.value, {
      headers: {
        "Cache-Control": "no-store",
        "x-leaderboard-cache": "HIT"
      }
    });
  }

  const results = await getLeaderboardData();
  const value = { results };
  globalThis.__leaderboardCache = {
    value,
    expiresAt: now + CACHE_TTL_MS
  };

  return NextResponse.json(value, {
    headers: {
      "Cache-Control": "no-store",
      "x-leaderboard-cache": bypassCache ? "BYPASS" : "MISS"
    }
  });
}
