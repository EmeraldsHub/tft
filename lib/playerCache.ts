import "server-only";

type PlayerCacheEntry = {
  value: unknown;
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __playerCache: Map<string, PlayerCacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var __playerRefreshTracker: Map<string, number> | undefined;
}

function getCache() {
  if (!globalThis.__playerCache) {
    globalThis.__playerCache = new Map();
  }
  return globalThis.__playerCache;
}

function getRefreshTracker() {
  if (!globalThis.__playerRefreshTracker) {
    globalThis.__playerRefreshTracker = new Map();
  }
  return globalThis.__playerRefreshTracker;
}

export function getPlayerCache<T>(slug: string): T | null {
  const cache = getCache();
  const entry = cache.get(slug);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAt) {
    cache.delete(slug);
    return null;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info("[player-cache] hit", { slug });
  }
  return entry.value as T;
}

export function setPlayerCache<T>(slug: string, value: T, ttlMs = 30_000) {
  const cache = getCache();
  cache.set(slug, { value, expiresAt: Date.now() + ttlMs });
  if (process.env.NODE_ENV !== "production") {
    console.info("[player-cache] set", { slug });
  }
}

export function invalidatePlayerCache(slug: string) {
  const cache = getCache();
  cache.delete(slug);
  if (process.env.NODE_ENV !== "production") {
    console.info("[player-cache] invalidate", { slug });
  }
}

export function invalidateAllPlayerCache() {
  const cache = getCache();
  cache.clear();
  if (process.env.NODE_ENV !== "production") {
    console.info("[player-cache] invalidate-all");
  }
}

export function shouldTriggerPlayerRefresh(slug: string, ttlMs = 5 * 60_000) {
  const tracker = getRefreshTracker();
  const last = tracker.get(slug) ?? 0;
  const now = Date.now();
  if (now - last < ttlMs) {
    return false;
  }
  tracker.set(slug, now);
  return true;
}
