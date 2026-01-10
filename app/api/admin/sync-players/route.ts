export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { invalidateLeaderboardCache } from "@/lib/leaderboardCache";
import { invalidateAllPlayerCache } from "@/lib/playerCache";
import { syncPlayersBatch } from "@/lib/riotData";
import { NextResponse } from "next/server";

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

export async function POST(request: Request) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { limit?: number };
  const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : 10;

  try {
    const result = await syncPlayersBatch(limit);
    invalidateLeaderboardCache();
    invalidateAllPlayerCache();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Batch sync failed." },
      { status: 500 }
    );
  }
}
