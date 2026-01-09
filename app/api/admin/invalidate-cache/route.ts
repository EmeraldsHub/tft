export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { invalidateLeaderboardCache } from "@/lib/leaderboardCache";
import { NextResponse } from "next/server";

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

export async function POST(request: Request) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  invalidateLeaderboardCache();
  return NextResponse.json({ ok: true });
}
