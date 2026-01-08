import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getAccountByRiotId,
  getLeagueEntriesBySummonerId,
  getLiveGameByPuuid,
  getMatchById,
  getMatchIdsByPuuid,
  getSummonerByPuuid
} from "@/lib/riot";

type TrackedPlayer = {
  id: string;
  riot_id: string;
  region: string;
  puuid: string | null;
  summoner_id: string | null;
  avg_placement_10: number | null;
  avg_placement_updated_at: string | null;
  riot_data_updated_at: string | null;
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

type CreateTrackedPlayerInput = {
  riotId: string;
  region: string;
  slug: string;
};

type CreateTrackedPlayerResult = {
  result: TrackedPlayer;
  warning: string | null;
};

export async function listTrackedPlayers() {
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select(
      "id, riot_id, region, slug, is_active, created_at, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createTrackedPlayer({
  riotId,
  region,
  slug
}: CreateTrackedPlayerInput): Promise<CreateTrackedPlayerResult> {
  let puuid: string | null = null;
  let summonerId: string | null = null;
  let warning: string | null = null;

  try {
    const resolved = await resolveRiotData(riotId);
    puuid = resolved.puuid;
    summonerId = resolved.summonerId;
  } catch (err) {
    warning = err instanceof Error ? err.message : "Riot sync failed.";
  }

  const riotDataUpdatedAt = puuid ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .insert({
      riot_id: riotId,
      region,
      slug,
      puuid,
      summoner_id: summonerId,
      riot_data_updated_at: riotDataUpdatedAt
    })
    .select(
      "id, riot_id, region, slug, is_active, created_at, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at"
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create tracked player.");
  }

  return { result: data, warning };
}

export async function resolveRiotData(riotId: string) {
  const account = await getAccountByRiotId(riotId);
  const puuid = account?.puuid ?? null;
  if (!puuid) {
    throw new Error("Riot account not found.");
  }
  const summoner = await getSummonerByPuuid(puuid);
  const summonerId = summoner?.id ?? null;
  if (!summonerId) {
    throw new Error("Riot summoner not found.");
  }

  return {
    puuid,
    summonerId
  };
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

  try {
    const { puuid, summonerId } = await resolveRiotData(data.riot_id);
    const { error: updateError } = await supabaseAdmin
      .from("tracked_players")
      .update({
        puuid,
        summoner_id: summonerId,
        riot_data_updated_at: new Date().toISOString()
      })
      .eq("id", data.id);

    if (updateError) {
      throw updateError;
    }

    return { updated: true, warning: null };
  } catch (err) {
    return {
      updated: false,
      warning: err instanceof Error ? err.message : "Riot sync failed."
    };
  }
}

export async function getRankedInfo(
  summonerId: string | null
): Promise<RankedInfo> {
  if (!summonerId) {
    return null;
  }

  const entries = await getLeagueEntriesBySummonerId(summonerId);
  const ranked = (entries ?? []).find(
    (entry) => entry.queueType === "RANKED_TFT"
  );

  const tier = ranked?.tier ?? null;
  const rank = ranked?.rank ?? null;
  const leaguePoints = ranked?.leaguePoints ?? null;

  if (!tier || !rank || leaguePoints === null) {
    return null;
  }

  return {
    tier,
    rank,
    leaguePoints
  };
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
