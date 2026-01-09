import "server-only";

const REGIONAL_BASE = "https://europe.api.riotgames.com";
const PLATFORM_BASE = "https://euw1.api.riotgames.com";

type FetchOptions = {
  allow404?: boolean;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function riotFetch<T>(url: string, options: FetchOptions = {}) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return null;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "X-Riot-Token": apiKey
        },
        cache: "no-store"
      });
    } catch {
      return null;
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      const backoff = retryAfter || 500 * attempt;
      await sleep(backoff);
      continue;
    }

    if (response.status === 404 && options.allow404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  return null;
}

export function parseRiotId(riotId: string) {
  const trimmed = riotId.trim();
  const hashIndex = trimmed.indexOf("#");

  if (hashIndex <= 0 || hashIndex === trimmed.length - 1) {
    return null;
  }

  const gameName = trimmed.slice(0, hashIndex);
  const tagLine = trimmed.slice(hashIndex + 1);

  return { gameName, tagLine };
}

export type RiotAccount = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type RiotSummoner = {
  id: string;
  puuid: string;
  name: string;
};

export type RiotLeagueEntry = {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
};

export type RiotMatch = {
  info?: {
    participants?: Array<{
      puuid: string;
      placement: number;
    }>;
    game_datetime?: number;
    game_start_time?: number;
  };
};

type LiveGame = {
  gameStartTime?: number;
  participants?: Array<unknown>;
};

const liveGameCache = new Map<
  string,
  { value: LiveGame | null; expiresAt: number }
>();

export async function getAccountByRiotId(riotId: string) {
  const parsed = parseRiotId(riotId);
  if (!parsed) {
    return null;
  }

  const { gameName, tagLine } = parsed;
  const url = `${REGIONAL_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
    gameName
  )}/${encodeURIComponent(tagLine)}`;

  return riotFetch<RiotAccount>(url);
}

export async function getSummonerByPuuid(puuid: string) {
  const url = `${PLATFORM_BASE}/tft/summoner/v1/summoners/by-puuid/${encodeURIComponent(
    puuid
  )}`;

  return riotFetch<RiotSummoner>(url);
}

// LoL Summoner-V4 is not used for TFT ranked lookups.

export async function getLeagueEntriesBySummonerId(summonerId: string) {
  const url = `${PLATFORM_BASE}/tft/league/v1/entries/by-summoner/${encodeURIComponent(
    summonerId
  )}`;

  return riotFetch<RiotLeagueEntry[]>(url);
}

export async function getLeagueEntriesByPuuid(puuid: string) {
  const url = `${PLATFORM_BASE}/tft/league/v1/by-puuid/${encodeURIComponent(
    puuid
  )}`;

  return riotFetch<RiotLeagueEntry[]>(url);
}

export async function getMatchIdsByPuuid(puuid: string, count = 10) {
  const url = `${REGIONAL_BASE}/tft/match/v1/matches/by-puuid/${encodeURIComponent(
    puuid
  )}/ids?count=${count}`;

  return riotFetch<string[]>(url);
}

export async function getMatchById(matchId: string) {
  const url = `${REGIONAL_BASE}/tft/match/v1/matches/${encodeURIComponent(
    matchId
  )}`;

  return riotFetch<RiotMatch>(url);
}

export async function getLiveGameByPuuid(puuid: string) {
  const cached = liveGameCache.get(puuid);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const url = `${PLATFORM_BASE}/tft/spectator/v5/active-games/by-puuid/${encodeURIComponent(
    puuid
  )}`;

  const data = await riotFetch<LiveGame>(url, { allow404: true });
  liveGameCache.set(puuid, { value: data, expiresAt: now + 30_000 });
  return data;
}
