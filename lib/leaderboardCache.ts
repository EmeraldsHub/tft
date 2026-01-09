import "server-only";

type LeaderboardCache = {
  value: { results: unknown };
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __leaderboardCache: LeaderboardCache | undefined;
}

export function invalidateLeaderboardCache() {
  globalThis.__leaderboardCache = undefined;
}

export async function getLeaderboardCached<T>(
  fetcher: () => Promise<T>,
  ttlMs = 60_000
): Promise<{ value: { results: T }; status: "cached" | "updated" }> {
  const now = Date.now();
  const cached = globalThis.__leaderboardCache;
  if (cached && now < cached.expiresAt) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[leaderboard] cache hit");
    }
    return { value: cached.value as { results: T }, status: "cached" };
  }

  const results = await fetcher();
  const value = { results };
  globalThis.__leaderboardCache = {
    value,
    expiresAt: now + ttlMs
  };

  if (process.env.NODE_ENV !== "production") {
    console.info("[leaderboard] cache miss");
  }

  return { value, status: "updated" };
}
