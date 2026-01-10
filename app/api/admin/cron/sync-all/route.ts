export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { acquireJobLock, releaseJobLock } from "@/lib/jobLock";
import { invalidateAllPlayerCache } from "@/lib/playerCache";
import { invalidateLeaderboardCache } from "@/lib/leaderboardCache";
import { cacheRecentMatchesForPuuid, syncTrackedPlayerById } from "@/lib/riotData";
import { getSummonerByPuuid, getRiotRateLimitFlag, resetRiotRateLimitFlag } from "@/lib/riot";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type CronResult = {
  id: string;
  riot_id: string;
  status: "updated" | "skipped" | "failed" | "rate_limited";
  warning?: string | null;
};

function getCronSecret() {
  return (
    process.env.CRON_SECRET ??
    process.env.CRON_SYNC_SECRET ??
    process.env.CRON_JOB_SECRET ??
    null
  )?.trim() ?? null;
}

function getProvidedSecret(request: Request) {
  const headerDirect =
    request.headers.get("x-cron-secret") ??
    request.headers.get("X-Cron-Secret") ??
    null;
  if (headerDirect?.trim()) {
    return { secret: headerDirect.trim(), usedAuthBearer: false };
  }
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) {
    return { secret: match[1].trim(), usedAuthBearer: true };
  }
  return { secret: null, usedAuthBearer: false };
}

function ensureCron(request: Request) {
  const expected = getCronSecret();
  const { secret: provided } = getProvidedSecret(request);
  return Boolean(expected && provided && expected === provided);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("debug") === "1") {
    const expected = (
      process.env.CRON_SECRET ??
      process.env.CRON_SYNC_SECRET ??
      process.env.CRON_JOB_SECRET ??
      ""
    ).trim();
    const header = (request.headers.get("x-cron-secret") ?? "").trim();
    const auth = (request.headers.get("authorization") ?? "").trim();
    const bearer = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
    const provided = header || bearer;
    return Response.json(
      {
        nodeEnv: process.env.NODE_ENV,
        hasExpected: Boolean(expected),
        expectedLength: expected ? expected.length : null,
        hasHeader: Boolean(header),
        headerLength: header ? header.length : null,
        hasAuth: Boolean(auth),
        used: header ? "x-cron-secret" : bearer ? "authorization-bearer" : "none",
        providedLength: provided ? provided.length : null,
        matched: Boolean(expected && provided && expected === provided)
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const expected = (
    process.env.CRON_SECRET ??
    process.env.CRON_SYNC_SECRET ??
    process.env.CRON_JOB_SECRET ??
    ""
  ).trim();
  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  const auth = (request.headers.get("authorization") ?? "").trim();
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const provided = (header || bearer).trim();
  const matched = Boolean(expected && provided && expected === provided);

  if (!matched) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const lock = await acquireJobLock("sync_all", 2 * 60_000);
  if (!lock.ok) {
    return NextResponse.json(
      { error: "Job locked", lockedUntil: lock.lockedUntil },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const startedAt = Date.now();
  const results: CronResult[] = [];
  let rateLimited = false;

  try {
    let body: { limit?: number } = {};
    try {
      body = (await request.json()) as { limit?: number };
    } catch {
      body = {};
    }

    const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : 10;

    const { data, error } = await supabaseAdmin
      .from("tracked_players")
      .select("id, riot_id, puuid, summoner_id, is_active, riot_data_updated_at")
      .eq("is_active", true)
      .order("riot_data_updated_at", { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const players = data ?? [];

    for (let index = 0; index < players.length; index += 1) {
      const player = players[index];
      resetRiotRateLimitFlag();

      try {
        const syncResult = await syncTrackedPlayerById(player.id, { force: true });
        if (!syncResult.updated) {
          results.push({
            id: player.id,
            riot_id: player.riot_id,
            status: "skipped",
            warning: syncResult.warning ?? null
          });
        } else {
          const { data: refreshed } = await supabaseAdmin
            .from("tracked_players")
            .select("puuid, summoner_id")
            .eq("id", player.id)
            .maybeSingle();

          if (refreshed?.puuid && !refreshed.summoner_id) {
            const summoner = await getSummonerByPuuid(refreshed.puuid);
            if (summoner?.id) {
              await supabaseAdmin
                .from("tracked_players")
                .update({ summoner_id: summoner.id })
                .eq("id", player.id);
            }
          }

          if (refreshed?.puuid) {
            await cacheRecentMatchesForPuuid(refreshed.puuid, 10);
          }

          results.push({
            id: player.id,
            riot_id: player.riot_id,
            status: "updated",
            warning: syncResult.warning ?? null
          });
        }
      } catch (err) {
        results.push({
          id: player.id,
          riot_id: player.riot_id,
          status: "failed",
          warning: err instanceof Error ? err.message : "Sync failed."
        });
      }

      if (getRiotRateLimitFlag()) {
        rateLimited = true;
        for (let remaining = index + 1; remaining < players.length; remaining += 1) {
          const skippedPlayer = players[remaining];
          results.push({
            id: skippedPlayer.id,
            riot_id: skippedPlayer.riot_id,
            status: "rate_limited"
          });
        }
        break;
      }

      if (index < players.length - 1) {
        await sleep(200);
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[cron sync-all] processed=%d rateLimited=%s totalMs=%d",
        results.length,
        rateLimited,
        Date.now() - startedAt
      );
    }

    invalidateLeaderboardCache();
    invalidateAllPlayerCache();

    return NextResponse.json(
      {
        total: results.length,
        results,
        rateLimited
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (err) {
    console.error("[cron sync-all] failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Sync failed."
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    try {
      await releaseJobLock("sync_all");
    } catch {
      // Best effort release.
    }
  }
}
