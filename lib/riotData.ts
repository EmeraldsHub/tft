import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getAccountByRiotId,
  getLeagueEntriesBySummonerId,
  getLiveGameByPuuid,
  getMatchById,
  getMatchIdsByPuuid,
  getSummonerByPuuid,
  parseRiotId
} from "@/lib/riot";
import { slugifyRiotId } from "@/lib/slugify";

type TrackedPlayer = {
  id: string;
  riot_id: string;
  region: string;
  puuid: string | null;
  summoner_id: string | null;
  avg_placement_10: number | null;
  avg_placement_updated_at: string | null;
  riot_data_updated_at: string | null;
  profile_image_url: string | null;
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

const rankCache = new Map<string, { value: RankedInfo; expiresAt: number }>();

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

const rankTtlMs = 15 * 60 * 1000;

export async function listTrackedPlayers() {
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select(
      "id, riot_id, region, slug, is_active, created_at, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at, profile_image_url"
    )
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

  const summoner = await getSummonerByPuuid(puuid);
  const summonerId = summoner?.id ?? null;
  if (!summonerId) {
    return {
      puuid,
      summonerId: null,
      warning: "Riot summoner not found or API unavailable."
    };
  }

  return { puuid, summonerId, warning: null };
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
    .select(
      "id, riot_id, region, slug, is_active, created_at, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at, profile_image_url"
    )
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
    .select(
      "id, riot_id, region, slug, is_active, created_at, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at, profile_image_url"
    )
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

export async function resolveRiotData(riotId: string) {
  const resolved = await resolveRiotDataWithWarning(riotId);
  if (!resolved.puuid || !resolved.summonerId) {
    return null;
  }
  return { puuid: resolved.puuid, summonerId: resolved.summonerId };
}

export async function syncTrackedPlayerById(playerId: string) {
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select("id, riot_id, region, puuid, summoner_id")
    .eq("id", playerId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Tracked player not found.");
  }

  if (data.region !== "EUW1") {
    return { updated: false, warning: "Only EUW1 is supported." };
  }

  const resolved = await resolveRiotDataWithWarning(data.riot_id);
  if (!resolved.puuid || !resolved.summonerId) {
    return { updated: false, warning: resolved.warning ?? "Riot sync failed." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("tracked_players")
    .update({
      puuid: resolved.puuid,
      summoner_id: resolved.summonerId,
      riot_data_updated_at: new Date().toISOString()
    })
    .eq("id", data.id);

  if (updateError) {
    return { updated: false, warning: updateError.message };
  }

  return { updated: true, warning: null };
}

export async function getRankedInfo(
  summonerId: string | null
): Promise<RankedInfo> {
  if (!summonerId) {
    return null;
  }

  const cached = rankCache.get(summonerId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const entries = await getLeagueEntriesBySummonerId(summonerId);
  if (!entries) {
    return cached?.value ?? null;
  }

  const ranked = (entries ?? []).find(
    (entry) => entry.queueType === "RANKED_TFT"
  );

  const tier = ranked?.tier ?? null;
  const rank = ranked?.rank ?? null;
  const leaguePoints = ranked?.leaguePoints ?? null;

  if (!tier || !rank || leaguePoints === null) {
    rankCache.set(summonerId, { value: null, expiresAt: now + rankTtlMs });
    return null;
  }

  const result = {
    tier,
    rank,
    leaguePoints
  };
  rankCache.set(summonerId, { value: result, expiresAt: now + rankTtlMs });
  return result;
}

function isFresh(timestamp: string | null, ttlMs: number) {
  if (!timestamp) {
    return false;
  }
  const last = new Date(timestamp).getTime();
  return Date.now() - last < ttlMs;
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
    .select(
      "id, riot_id, region, slug, is_active, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at, profile_image_url"
    )
    .ilike("slug", slugOrRiotId)
    .maybeSingle();

  if (!data && slugOrRiotId.includes("#")) {
    const normalizedSlug = slugifyRiotId(slugOrRiotId, "EUW1");
    if (normalizedSlug !== slugOrRiotId) {
      const { data: slugMatch } = await supabaseAdmin
        .from("tracked_players")
        .select(
          "id, riot_id, region, slug, is_active, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at, profile_image_url"
        )
        .eq("slug", normalizedSlug)
        .maybeSingle();
      data = slugMatch ?? data;
    }

    if (!data) {
      const { data: riotIdMatch } = await supabaseAdmin
        .from("tracked_players")
        .select(
          "id, riot_id, region, slug, is_active, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at, profile_image_url"
        )
        .ilike("riot_id", slugOrRiotId)
        .maybeSingle();
      data = riotIdMatch ?? data;
    }
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

  const ranked = await getRankedInfo(data.summoner_id ?? null);
  const avgPlacement = await ensureAveragePlacement(data);
  const live = await getLiveGameStatus(data.puuid ?? null);
  const recentMatches = await getRecentMatches(data.puuid ?? null, 10);

  return {
    player: data,
    ranked,
    avgPlacement,
    live,
    recentMatches
  };
}

export async function getLeaderboardData() {
  const { data } = await supabaseAdmin
    .from("tracked_players")
    .select(
      "id, riot_id, slug, is_active, puuid, avg_placement_10, avg_placement_updated_at"
    )
    .eq("is_active", true)
    .not("puuid", "is", null);

  const players = (data ?? []) as Array<{
    id: string;
    riot_id: string;
    slug: string;
    puuid: string | null;
    avg_placement_10: number | null;
    avg_placement_updated_at: string | null;
  }>;

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
    return [];
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

export async function getLiveGameStatus(
  puuid: string | null
): Promise<LiveGameStatus> {
  if (!puuid) {
    return { inGame: false, gameStartTime: null, participantCount: null };
  }

  const live = await getLiveGameByPuuid(puuid);
  if (!live) {
    return { inGame: false, gameStartTime: null, participantCount: null };
  }

  return {
    inGame: true,
    gameStartTime: live.gameStartTime ?? null,
    participantCount: live.participants?.length ?? null
  };
}

export type { TrackedPlayer };
