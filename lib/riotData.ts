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
  gameStartTime?: number;
  participantCount?: number;
};

export async function resolveRiotData(riotId: string) {
  const account = await getAccountByRiotId(riotId);
  if (!account) {
    throw new Error("Riot account not found.");
  }
  const summoner = await getSummonerByPuuid(account.puuid);

  return {
    puuid: account.puuid,
    summonerId: summoner.id ?? null,
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
  const ranked = entries.find(
    (entry) => entry.queueType === "RANKED_TFT"
  );

  if (!ranked) {
    return null;
  }

  return {
    tier: ranked.tier,
    rank: ranked.rank,
    leaguePoints: ranked.leaguePoints
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

  const matchIds = await getMatchIdsByPuuid(player.puuid, 10);
  if (matchIds.length === 0) {
    return null;
  }

  const matches = await Promise.all(
    matchIds.map(async (matchId) => getMatchById(matchId))
  );

  const placements = matches
    .map((match) =>
      match.info.participants.find(
        (participant) => participant.puuid === player.puuid
      )?.placement
    )
    .filter((placement): placement is number => Number.isFinite(placement));

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
    return { inGame: false };
  }

  const live = await getLiveGameByPuuid(puuid);
  if (!live) {
    return { inGame: false };
  }

  return {
    inGame: true,
    gameStartTime: live.gameStartTime,
    participantCount: live.participants.length
  };
}

export type { TrackedPlayer };
