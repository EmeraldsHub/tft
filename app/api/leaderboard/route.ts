export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getLeaderboardData } from "@/lib/riotData";
import { NextResponse } from "next/server";

export async function GET() {
  const results = await getLeaderboardData();
  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
