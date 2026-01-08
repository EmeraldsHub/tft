export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { ensureAveragePlacement, getLiveGameStatus } from "@/lib/riotData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type LeaderboardRow = {
  id: string;
  riot_id: string;
  slug: string;
  puuid: string | null;
  avg_placement_10: number | null;
  avg_placement_updated_at: string | null;
};

export async function GET() {
  const { data } = await supabaseAdmin
    .from("tracked_players")
    .select(
      "id, riot_id, slug, is_active, puuid, avg_placement_10, avg_placement_updated_at"
    )
    .eq("is_active", true)
    .not("puuid", "is", null);

  const players = (data ?? []) as LeaderboardRow[];

  const enriched = await Promise.all(
    players.map(async (player) => {
      const avgPlacement = await ensureAveragePlacement(player);
      const live = await getLiveGameStatus(player.puuid ?? null);
      return { ...player, avgPlacement, live };
    })
  );

  const sorted = enriched.sort((a, b) => {
    if (a.avgPlacement === null && b.avgPlacement === null) return 0;
    if (a.avgPlacement === null) return 1;
    if (b.avgPlacement === null) return -1;
    return a.avgPlacement - b.avgPlacement;
  });

  return NextResponse.json({ results: sorted });
}
