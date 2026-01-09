import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getAccountByRiotId,
  getLeagueEntriesByPuuid,
  getLiveGameByPuuid,
  getMatchById,
  getMatchIdsByPuuid,
  parseRiotId
} from "@/lib/riot";
import type { RiotMatch, TftLeagueEntry } from "@/lib/riot";
import { slugifyRiotId } from "@/lib/slugify";

type TrackedPlayer = {
  id: string;
  riot_id: string;
  region: string;
  is_active: boolean;
  puuid: string | null;
  summoner_id: string | null;
  avg_placement_10: number | null;
  avg_placement_updated_at: string | null;
  riot_data_updated_at: string | null;
  profile_image_url: string | null;
  ranked_tier: string | null;
  ranked_rank: string | null;
  ranked_lp: number | null;
  ranked_queue: string | null;
  ranked_updated_at: string | null;
  live_in_game: boolean | null;
  live_game_start_time: number | null;
  live_updated_at: string | null;
};

type AvgPlacementSource = {
  id: string;
  puuid: string | null;
  avg_placement_10: number | null;
  avg_placement_updated_at: string | null;
};

export type RankedInfo = {
  tier: string;
  rank: string;
  leaguePoints: number;
} | null;

type RankedCacheStatus = "cached" | "skipped" | "updated";

type RankedCacheResult = {
  ranked: RankedInfo | null;
  rankIconUrl: string | null;
  rankedQueue: string | null;
  status: RankedCacheStatus;
};

export type LiveGameStatus = {
  inGame: boolean;
  gameStartTime: number | null;
  participantCount: number | null;
};

export type MatchSummary = {
  matchId: string;
  placement: number | null;
  gameStartTime: number | null;
  gameDateTime: number | null;
};

const rankCache = new Map<
  string,
  { value: RankedInfo | null; expiresAt: number }
>();

const tierOrder: Record<string, number> = {
  CHALLENGER: 9,
  GRANDMASTER: 8,
  MASTER: 7,
  DIAMOND: 6,
  EMERALD: 5,
  PLATINUM: 4,
  GOLD: 3,
  SILVER: 2,
  BRONZE: 1,
  IRON: 0
};

const divisionOrder: Record<string, number> = {
  I: 4,
  II: 3,
  III: 2,
  IV: 1
};

const rankTtlMs = 60 * 1000;
const liveTtlMs = 45 * 1000;

type CreateTrackedPlayerInput = {
  riotId: string;
  region: string;
  slug: string;
  profileImageUrl?: string | null;
};

type CreateTrackedPlayerResult = {
  result: TrackedPlayer;
  warning: string | null;
};

type TrackedPlayerUpdate = {
  is_active?: boolean;
  profile_image_url?: string | null;
};

// Summoner ID is no longer required for TFT ranked lookups.

export async function listTrackedPlayers() {
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

type ResolveResult = {
  puuid: string | null;
  summonerId: string | null;
  warning: string | null;
};

export async function resolveRiotDataWithWarning(
  riotId: string
): Promise<ResolveResult> {
  if (!parseRiotId(riotId)) {
    return {
      puuid: null,
      summonerId: null,
      warning: "Invalid Riot ID format."
    };
  }

  const account = await getAccountByRiotId(riotId);
  const puuid = account?.puuid ?? null;
  if (!puuid) {
    return {
      puuid: null,
      summonerId: null,
      warning: "Riot account not found or API unavailable."
    };
  }

  return { puuid, summonerId: null, warning: null };
}

export async function createTrackedPlayer({
  riotId,
  region,
  slug,
  profileImageUrl
}: CreateTrackedPlayerInput): Promise<CreateTrackedPlayerResult> {
  let puuid: string | null = null;
  let summonerId: string | null = null;
  let warning: string | null = null;

  const resolved = await resolveRiotDataWithWarning(riotId);
  puuid = resolved.puuid;
  summonerId = resolved.summonerId;
  warning = resolved.warning;

  const riotDataUpdatedAt = puuid ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .insert({
      riot_id: riotId,
      region,
      slug,
      puuid,
      summoner_id: summonerId,
      riot_data_updated_at: riotDataUpdatedAt,
      profile_image_url: profileImageUrl ?? null
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create tracked player.");
  }

  return { result: data, warning };
}

export async function updateTrackedPlayer(
  playerId: string,
  updates: TrackedPlayerUpdate
) {
  const payload: TrackedPlayerUpdate = {};
  if (typeof updates.is_active === "boolean") {
    payload.is_active = updates.is_active;
  }
  if (typeof updates.profile_image_url === "string") {
    payload.profile_image_url = updates.profile_image_url;
  }
  if (updates.profile_image_url === null) {
    payload.profile_image_url = null;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("Missing fields.");
  }

  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .update(payload)
    .eq("id", playerId)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to update player.");
  }

  return data;
}

export async function deleteTrackedPlayer(playerId: string) {
  const { error } = await supabaseAdmin
    .from("tracked_players")
    .delete()
    .eq("id", playerId);

  if (error) {
    throw error;
  }
}

export async function backfillSummonerIds(limit = 25) {
  return { updated: 0, skipped: 0, total: 0, limit };
}

export async function resolveRiotData(riotId: string) {
  const resolved = await resolveRiotDataWithWarning(riotId);
  if (!resolved.puuid) {
    return null;
  }
  return { puuid: resolved.puuid, summonerId: null };
}

export async function syncTrackedPlayerById(
  playerId: string,
  { force = false }: { force?: boolean } = {}
) {
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();

  if (error || !data) {
    return { updated: false, warning: "Tracked player not found." };
  }

  if (data.region !== "EUW1") {
    return { updated: false, warning: "Only EUW1 is supported." };
  }

  const resolved = await resolveRiotDataWithWarning(data.riot_id);
  if (!resolved.puuid) {
    return { updated: false, warning: resolved.warning ?? "Riot sync failed." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("tracked_players")
    .update({
      puuid: resolved.puuid,
      riot_data_updated_at: new Date().toISOString()
    })
    .eq("id", data.id);

  if (updateError) {
    return { updated: false, warning: updateError.message };
  }

  const player = { ...data, puuid: resolved.puuid };
  const rankedResult = await ensureRankedCache(player, force);
  const liveResult = await ensureLiveCache(player, force);
  const wasAvgFresh =
    player.avg_placement_updated_at &&
    isFresh(player.avg_placement_updated_at, 15 * 60 * 1000);
  const avgPlacement = await ensureAveragePlacement(player, force);

  const avgStatus =
    avgPlacement === null
      ? "skipped"
      : force || !wasAvgFresh
        ? "updated"
        : "cached";

  return {
    updated: true,
    warning: resolved.warning ?? null,
    ranked: rankedResult.ranked,
    live: {
      inGame: liveResult.inGame,
      gameStartTime: liveResult.gameStartTime,
      participantCount: liveResult.participantCount
    },
    avgPlacement,
    statuses: {
      ranked: rankedResult.status,
      live: liveResult.status,
      avgPlacement: avgStatus
    }
  };
}

export async function syncPlayersBatch(limit = 10) {
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select("id, riot_id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const results = [];

  for (const row of rows) {
    const result = await syncTrackedPlayerById(row.id, { force: true });
    results.push({
      id: row.id,
      riot_id: row.riot_id,
      status: result.updated
        ? result.warning
          ? "warning"
          : "success"
        : "failed",
      warning: result.warning ?? null,
      statuses: result.statuses ?? null
    });
  }

  return { total: rows.length, results };
}

export async function getRankedInfo(
  player: TrackedPlayer,
  force = false
): Promise<RankedCacheResult> {
  const cached = rankCache.get(player.id);
  const now = Date.now();
  if (!force && cached && cached.expiresAt > now) {
    return {
      ranked: cached.value,
      rankIconUrl: cached.value ? getRankIconUrl(cached.value.tier) : null,
      rankedQueue: player.ranked_queue ?? null,
      status: "cached"
    };
  }

  const result = await ensureRankedCache(player, force);
  rankCache.set(player.id, { value: result.ranked, expiresAt: now + rankTtlMs });
  return result;
}

function isFresh(timestamp: string | null, ttlMs: number) {
  if (!timestamp) {
    return false;
  }
  const last = new Date(timestamp).getTime();
  return Date.now() - last < ttlMs;
}

function getRankIconUrl(tier: string | null) {
  if (!tier) {
    return null;
  }
  const slug = tier.toLowerCase();
  return `https://cdn.communitydragon.org/latest/tft/ranked-icons/${slug}.png`;
}

function pickRankedEntry(entries: TftLeagueEntry[] | null): TftLeagueEntry | null {
  if (!entries) {
    return null;
  }
  return (
    entries.find((entry) => entry.queueType === "RANKED_TFT") ??
    entries.find((entry) => entry.queueType === "RANKED_TFT_DOUBLE_UP") ??
    entries.find((entry) => entry.queueType === "RANKED_TFT_TURBO") ??
    null
  );
}

async function ensureRankedCache(
  player: TrackedPlayer,
  force = false
): Promise<RankedCacheResult> {
  if (player.ranked_updated_at && !force && isFresh(player.ranked_updated_at, rankTtlMs)) {
    if (!player.ranked_tier || !player.ranked_rank || player.ranked_lp === null) {
      return {
        ranked: null,
        rankIconUrl: null,
        rankedQueue: player.ranked_queue ?? null,
        status: "cached"
      };
    }

    return {
      ranked: {
        tier: player.ranked_tier,
        rank: player.ranked_rank,
        leaguePoints: player.ranked_lp
      },
      rankIconUrl: getRankIconUrl(player.ranked_tier),
      rankedQueue: player.ranked_queue ?? null,
      status: "cached"
    };
  }

  if (!player.puuid) {
    return { ranked: null, rankIconUrl: null, rankedQueue: null, status: "skipped" };
  }

  const entries = await getLeagueEntriesByPuuid(player.puuid);
  if (!entries) {
    if (player.ranked_tier && player.ranked_rank && player.ranked_lp !== null) {
      return {
        ranked: {
          tier: player.ranked_tier,
          rank: player.ranked_rank,
          leaguePoints: player.ranked_lp
        },
        rankIconUrl: getRankIconUrl(player.ranked_tier),
        rankedQueue: player.ranked_queue ?? null,
        status: "cached"
      };
    }
    return {
      ranked: null,
      rankIconUrl: null,
      rankedQueue: player.ranked_queue ?? null,
      status: "skipped"
    };
  }

  const rankedEntry = pickRankedEntry(entries);
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
      ranked_updated_at: new Date().toISOString(),
      riot_data_updated_at: new Date().toISOString()
    })
    .eq("id", player.id);

  if (!tier || !rank || leaguePoints === null) {
    return { ranked: null, rankIconUrl: null, rankedQueue, status: "updated" };
  }

  return {
    ranked: { tier, rank, leaguePoints },
    rankIconUrl: getRankIconUrl(tier),
    rankedQueue,
    status: "updated"
  };
}

async function ensureLiveCache(player: TrackedPlayer, force = false) {
  if (player.live_updated_at && !force && isFresh(player.live_updated_at, liveTtlMs)) {
    return {
      inGame: Boolean(player.live_in_game),
      gameStartTime: player.live_game_start_time ?? null,
      participantCount: null,
      usedCache: true,
      status: "cached"
    };
  }

  if (!player.puuid) {
    return {
      inGame: false,
      gameStartTime: null,
      participantCount: null,
      usedCache: false,
      status: "skipped"
    };
  }

  const live = await getLiveGameByPuuid(player.puuid);
  const inGame = Boolean(live);
  const gameStartTime = live?.gameStartTime ?? null;
  const participantCount = live?.participants?.length ?? null;

  await supabaseAdmin
    .from("tracked_players")
    .update({
      live_in_game: inGame,
      live_game_start_time: gameStartTime,
      live_updated_at: new Date().toISOString(),
      riot_data_updated_at: new Date().toISOString()
    })
    .eq("id", player.id);

  return {
    inGame,
    gameStartTime,
    participantCount,
    usedCache: false,
    status: "updated"
  };
}

function getRankSortKey(
  player: TrackedPlayer & { ranked?: RankedInfo | null }
) {
  const tier = player.ranked?.tier ?? player.ranked_tier ?? "";
  const rank = player.ranked?.rank ?? player.ranked_rank ?? "";
  const lp = player.ranked?.leaguePoints ?? player.ranked_lp ?? -1;
  const tierScore = tierOrder[tier] ?? -1;
  const divisionScore = divisionOrder[rank] ?? 0;
  return { tierScore, divisionScore, lp };
}

export async function ensureAveragePlacement(
  player: AvgPlacementSource,
  force = false
) {
  if (!player.puuid) {
    return null;
  }

  if (!force && isFresh(player.avg_placement_updated_at, 15 * 60 * 1000)) {
    return player.avg_placement_10;
  }

  const matchIds = (await getMatchIdsByPuuid(player.puuid, 10)) ?? [];
  if (matchIds.length === 0) {
    return null;
  }

  const matches = await Promise.all(
    matchIds.map(async (matchId) => getMatchById(matchId))
  );

  const placements = matches
    .map((match) => {
      const participants = match?.info?.participants ?? [];
      const placement =
        participants.find((participant) => participant.puuid === player.puuid)
          ?.placement ?? null;
      return placement;
    })
    .filter((placement): placement is number => typeof placement === "number");

  if (placements.length === 0) {
    return null;
  }

  const avg =
    placements.reduce((sum, placement) => sum + placement, 0) / placements.length;
  const rounded = Number(avg.toFixed(2));

  await supabaseAdmin
    .from("tracked_players")
    .update({
      avg_placement_10: rounded,
      avg_placement_updated_at: new Date().toISOString()
    })
    .eq("id", player.id);

  return rounded;
}

export async function getPlayerProfileBySlug(slugOrRiotId: string) {
  let { data } = await supabaseAdmin
    .from("tracked_players")
    .select("*")
    .ilike("slug", slugOrRiotId)
    .maybeSingle();

  if (!data && slugOrRiotId.includes("#")) {
    const normalizedSlug = slugifyRiotId(slugOrRiotId, "EUW1");
    if (normalizedSlug !== slugOrRiotId) {
      const { data: slugMatch } = await supabaseAdmin
        .from("tracked_players")
        .select("*")
        .eq("slug", normalizedSlug)
        .maybeSingle();
      data = slugMatch ?? data;
    }

    if (!data) {
      const { data: riotIdMatch } = await supabaseAdmin
        .from("tracked_players")
        .select("*")
        .ilike("riot_id", slugOrRiotId)
        .maybeSingle();
      data = riotIdMatch ?? data;
    }
  }

  if (!data && !slugOrRiotId.includes("#")) {
    const { data: riotIdMatch } = await supabaseAdmin
      .from("tracked_players")
      .select("*")
      .ilike("riot_id", `${slugOrRiotId}#%`)
      .maybeSingle();
    data = riotIdMatch ?? data;
  }

  if (!data || !data.is_active) {
    return {
      player: null,
      ranked: null,
      avgPlacement: null,
      live: { inGame: false, gameStartTime: null, participantCount: null },
      recentMatches: []
    };
  }

  const rankedResult = await getRankedInfo(data);
  const ranked = rankedResult.ranked;
  const avgPlacement = await ensureAveragePlacement(data);
  const live = await getLiveGameStatus(data);
  const recentMatches = await getRecentMatches(data.puuid ?? null, 10);

  return {
    player: data,
    ranked,
    rankIconUrl: rankedResult.rankIconUrl,
    rankedQueue: rankedResult.rankedQueue,
    avgPlacement,
    live,
    recentMatches
  };
}

export async function getLeaderboardData() {
  const startedAt = Date.now();
  const supabaseStart = Date.now();
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select(
      [
        "id",
        "riot_id",
        "slug",
        "region",
        "avg_placement_10",
        "live_in_game",
        "ranked_tier",
        "ranked_rank",
        "ranked_lp",
        "ranked_queue"
      ].join(",")
    )
    .eq("is_active", true);
  const supabaseMs = Date.now() - supabaseStart;

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data)
    ? (data as unknown as TrackedPlayer[])
    : [];
  const enriched = rows.map((player) => {
    const ranked =
      player.ranked_tier && player.ranked_rank && player.ranked_lp !== null
        ? {
            tier: player.ranked_tier,
            rank: player.ranked_rank,
            leaguePoints: player.ranked_lp
          }
        : null;

    const rankScore = ranked
      ? (tierOrder[ranked.tier] ?? -1) * 1000 +
        (divisionOrder[ranked.rank] ?? 0) * 100 +
        (ranked.leaguePoints ?? 0)
      : -1;

    return {
      ...player,
      avgPlacement: player.avg_placement_10 ?? null,
      live: { inGame: Boolean(player.live_in_game) },
      ranked,
      rankIconUrl: ranked ? getRankIconUrl(ranked.tier) : null,
      rankedQueue: player.ranked_queue ?? null,
      __rankScore: rankScore
    };
  });

  const sorted = enriched
    .sort((a, b) => {
      if (a.__rankScore !== b.__rankScore) {
        return b.__rankScore - a.__rankScore;
      }
      return a.riot_id.localeCompare(b.riot_id);
    })
    .map(({ __rankScore, ...rest }) => rest);

  if (process.env.DEBUG_PERF === "1") {
    console.info(
      "[leaderboard] supabase=%dms total=%dms rows=%d",
      supabaseMs,
      Date.now() - startedAt,
      sorted.length
    );
  }

  return sorted;
}

export async function searchTrackedPlayers(query: string) {
  const { data: startsWith, error: startsWithError } = await supabaseAdmin
    .from("tracked_players")
    .select("riot_id, region, slug")
    .eq("is_active", true)
    .ilike("riot_id", `${query}%`)
    .order("riot_id", { ascending: true })
    .limit(8);

  if (startsWithError) {
    throw startsWithError;
  }

  const remaining = Math.max(0, 8 - (startsWith?.length ?? 0));
  let contains: typeof startsWith = [];

  if (remaining > 0) {
    const { data: containsData, error: containsError } = await supabaseAdmin
      .from("tracked_players")
      .select("riot_id, region, slug")
      .eq("is_active", true)
      .ilike("riot_id", `%${query}%`)
      .order("riot_id", { ascending: true })
      .limit(remaining);

    if (containsError) {
      throw containsError;
    }

    contains = containsData ?? [];
  }

  const seen = new Set<string>();
  const suggestions = [...(startsWith ?? []), ...contains].filter((row) => {
    if (seen.has(row.slug)) {
      return false;
    }
    seen.add(row.slug);
    return true;
  });

  return suggestions;
}

export async function getRecentMatches(
  puuid: string | null,
  count = 10
): Promise<MatchSummary[]> {
  if (!puuid) {
    return [];
  }

  const matchIds = (await getMatchIdsByPuuid(puuid, count)) ?? [];
  if (matchIds.length === 0) {
    const fallback = await getRecentMatchesFromCache(puuid, count);
    return fallback;
  }

  const matches = await Promise.all(
    matchIds.map(async (matchId) => getMatchById(matchId))
  );

  return matchIds.map((matchId, index) => {
    const match = matches[index];
    const info = match?.info;
    const participants = info?.participants ?? [];
    const placement =
      participants.find((participant) => participant.puuid === puuid)
        ?.placement ?? null;

    return {
      matchId,
      placement,
      gameStartTime: info?.game_start_time ?? null,
      gameDateTime: info?.game_datetime ?? null
    };
  });
}

type CachedPreview = {
  placement?: number | null;
};

type CachedMatchRow = {
  match_id: string;
  game_datetime: string | null;
  data: RiotMatch | null;
  player_previews: Record<string, CachedPreview> | null;
};

async function getRecentMatchesFromCache(
  puuid: string,
  count: number
): Promise<MatchSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("tft_match_cache")
    .select("match_id, game_datetime, data, player_previews")
    .contains("player_previews", { [puuid]: {} })
    .order("game_datetime", { ascending: false })
    .limit(count);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as CachedMatchRow[]).map((row) => {
    const preview = row.player_previews?.[puuid] ?? null;
    const placement =
      typeof preview?.placement === "number" ? preview.placement : null;
    const info = row.data?.info;
    return {
      matchId: row.match_id,
      placement,
      gameStartTime: info?.game_start_time ?? null,
      gameDateTime: row.game_datetime
        ? new Date(row.game_datetime).getTime()
        : info?.game_datetime ?? null
    };
  });
}

export async function getLiveGameStatus(
  player: TrackedPlayer,
  force = false
): Promise<LiveGameStatus> {
  const cached = await ensureLiveCache(player, force);
  if (!cached.inGame) {
    return { inGame: false, gameStartTime: null, participantCount: null };
  }

  return {
    inGame: true,
    gameStartTime: cached.gameStartTime,
    participantCount: cached.participantCount ?? null
  };
}

export type { TrackedPlayer };
