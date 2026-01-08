export const dynamic = "force-dynamic";

import { searchTrackedPlayers } from "@/lib/riotData";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await searchTrackedPlayers(query);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}
