export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { invalidateLeaderboardCache } from "@/lib/leaderboardCache";
import { invalidateAllPlayerCache, invalidatePlayerCache } from "@/lib/playerCache";
import {
  cacheRecentMatchesForPuuid,
  createTrackedPlayer,
  listTrackedPlayers,
  syncTrackedPlayerById
} from "@/lib/riotData";
import { getSummonerByPuuid } from "@/lib/riot";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slugifyRiotId } from "@/lib/slugify";
import { NextResponse } from "next/server";

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

export async function GET(request: Request) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await listTrackedPlayers();
    return NextResponse.json({ results: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load players." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    riot_id?: string;
    region?: string;
    profile_image_url?: string;
  };

  if (!body.riot_id || !body.region) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const region = body.region.trim().toUpperCase();
  if (region !== "EUW1") {
    return NextResponse.json(
      { error: "Only EUW1 is supported for now." },
      { status: 400 }
    );
  }

  const slug = slugifyRiotId(body.riot_id, region);
  const profileImageUrl = body.profile_image_url?.trim() || null;
  try {
    const { result, warning } = await createTrackedPlayer({
      riotId: body.riot_id,
      region,
      slug,
      profileImageUrl
    });
    const syncResult = await syncTrackedPlayerById(result.id, { force: true });
    if (!syncResult.updated) {
      throw new Error(syncResult.warning ?? "Sync failed.");
    }
    if (syncResult.statuses?.ranked === "skipped") {
      throw new Error("Ranked fetch failed.");
    }

    const { data: updatedPlayer } = await supabaseAdmin
      .from("tracked_players")
      .select("id, slug, puuid, summoner_id")
      .eq("id", result.id)
      .maybeSingle();

    if (!updatedPlayer?.puuid) {
      throw new Error("PUUID resolution failed.");
    }

    if (!updatedPlayer.summoner_id) {
      const summoner = await getSummonerByPuuid(updatedPlayer.puuid);
      if (summoner?.id) {
        await supabaseAdmin
          .from("tracked_players")
          .update({ summoner_id: summoner.id })
          .eq("id", result.id);
      }
    }

    const matchCacheSummary = await cacheRecentMatchesForPuuid(
      updatedPlayer.puuid,
      10
    );

    if (process.env.NODE_ENV !== "production") {
      const updatedSlug =
        (updatedPlayer as { slug?: unknown } | null)?.slug;
      console.info("[admin] player bootstrap", {
        id: result.id,
        slug: typeof updatedSlug === "string" ? updatedSlug : null,
        puuid: updatedPlayer.puuid,
        summonerId: updatedPlayer.summoner_id ?? null,
        matchIds: matchCacheSummary.total,
        cached: matchCacheSummary.cached,
        avgPlacement: syncResult.avgPlacement ?? null,
        ranked: syncResult.ranked ?? null
      });
    }
    invalidateLeaderboardCache();
    const maybeSlug = (result as { slug?: unknown } | null)?.slug;
    const slugValue = typeof maybeSlug === "string" ? maybeSlug : null;
    if (slugValue) {
      invalidatePlayerCache(slugValue);
    } else {
      invalidateAllPlayerCache();
    }
    return NextResponse.json({
      result,
      warning,
      sync: {
        avgPlacement: syncResult.avgPlacement ?? null,
        matchCache: matchCacheSummary
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create player." },
      { status: 500 }
    );
  }
}
