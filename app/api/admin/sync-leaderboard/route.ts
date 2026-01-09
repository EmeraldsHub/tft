export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { invalidateLeaderboardCache } from "@/lib/leaderboardCache";
import { listTrackedPlayers } from "@/lib/riotData";
import {
  getLeagueEntriesByPuuid,
  getSummonerByPuuid
} from "@/lib/riot";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const currentIndex = index++;
        if (currentIndex >= items.length) {
          return;
        }
        results[currentIndex] = await worker(items[currentIndex]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  let body: { limit?: number; concurrency?: number } = {};
  try {
    body = (await request.json()) as { limit?: number; concurrency?: number };
  } catch {
    body = {};
  }

  const limit = typeof body.limit === "number" && body.limit > 0
    ? body.limit
    : null;
  const concurrency =
    typeof body.concurrency === "number" && body.concurrency > 0
      ? Math.min(body.concurrency, 5)
      : 5;

  const allPlayers = (await listTrackedPlayers()) as Array<{
    id: string;
    riot_id: string;
    is_active: boolean;
    puuid: string | null;
    summoner_id: string | null;
  }>;
  const activePlayers = allPlayers.filter((player) => player.is_active);
  const targetPlayers = limit ? activePlayers.slice(0, limit) : activePlayers;

  let updated = 0;
  let skipped = 0;
  const results = await runWithLimit(targetPlayers, concurrency, async (player) => {
    if (!player.puuid) {
      skipped += 1;
      return {
        id: player.id,
        riot_id: player.riot_id,
        status: "skipped",
        ranked: null
      };
    }

    if (!player.summoner_id) {
      const summoner = await getSummonerByPuuid(player.puuid);
      if (summoner?.id) {
        await supabaseAdmin
          .from("tracked_players")
          .update({ summoner_id: summoner.id })
          .eq("id", player.id);
      }
    }

    const entries = await getLeagueEntriesByPuuid(player.puuid);
    if (!entries) {
      skipped += 1;
      return {
        id: player.id,
        riot_id: player.riot_id,
        status: "skipped",
        ranked: null
      };
    }

    const rankedEntry =
      entries.find((entry) => entry.queueType === "RANKED_TFT") ??
      entries.find((entry) => entry.queueType === "RANKED_TFT_DOUBLE_UP") ??
      entries.find((entry) => entry.queueType === "RANKED_TFT_TURBO") ??
      null;

    const tier = rankedEntry?.tier ?? null;
    const rank = rankedEntry?.rank ?? null;
    const leaguePoints = rankedEntry?.leaguePoints ?? null;
    const rankedQueue = rankedEntry?.queueType ?? null;

    await supabaseAdmin
      .from("tracked_players")
      .update({
        ranked_tier: tier,
        ranked_rank: rank,
        ranked_lp: leaguePoints,
        ranked_queue: rankedQueue,
        ranked_updated_at: new Date().toISOString()
      })
      .eq("id", player.id);

    updated += 1;
    return {
      id: player.id,
      riot_id: player.riot_id,
      status: "updated",
      ranked:
        tier && rank && leaguePoints !== null
          ? { tier, rank, leaguePoints }
          : null
    };
  });

  if (process.env.DEBUG_PERF === "1") {
    console.info(
      "[sync-leaderboard] total=%dms updated=%d skipped=%d",
      Date.now() - startedAt,
      updated,
      skipped
    );
  }

  invalidateLeaderboardCache();
  return NextResponse.json({
    total: targetPlayers.length,
    results
  });
}
