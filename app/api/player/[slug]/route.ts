export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { ensureAveragePlacement, getLiveGameStatus, getRankedInfo, getRecentMatches } from "@/lib/riotData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { data } = await supabaseAdmin
    .from("tracked_players")
    .select(
      "id, riot_id, region, slug, is_active, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at"
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!data || !data.is_active) {
    return NextResponse.json({ player: null });
  }

  const ranked = await getRankedInfo(data.summoner_id ?? null);
  const avgPlacement = await ensureAveragePlacement(data);
  const live = await getLiveGameStatus(data.puuid ?? null);
  const recentMatches = await getRecentMatches(data.puuid ?? null, 10);

  return NextResponse.json({
    player: data,
    ranked,
    avgPlacement,
    live,
    recentMatches
  });
}
