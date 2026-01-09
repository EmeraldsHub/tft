import "server-only";

const TFT_CHAMPIONS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/tftchampions.json";
const TFT_ITEMS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/tftitems.json";
const CDRAGON_ASSET_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/";
const CDRAGON_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type CdragonCache = {
  loadedAt: number;
  loadMs: number;
  championsByApiName: Map<string, CdragonChampion>;
  itemsByApiName: Map<string, CdragonItem>;
};

type CdragonChampion = {
  apiName?: string;
  characterName?: string;
  squareIconPath?: string;
  tileIconPath?: string;
  iconPath?: string;
};

type CdragonItem = {
  apiName?: string;
  iconPath?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __tftCdragonCache: CdragonCache | undefined;
  // eslint-disable-next-line no-var
  var __tftCdragonLoadPromise: Promise<CdragonCache> | undefined;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function toString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toCdragonAssetUrl(pathValue?: string | null): string | null {
  if (!pathValue) {
    return null;
  }
  let normalized = pathValue.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  normalized = normalized.replace(/^\//, "");
  normalized = normalized.replace(/^lol-game-data\/assets\//, "assets/");
  if (!normalized.startsWith("assets/")) {
    return null;
  }
  normalized = normalized.replace(/\.tex$/i, ".png");
  return `${CDRAGON_ASSET_BASE}${normalized}`;
}

export function sanitizeIconUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const lower = url.toLowerCase();
  if (lower.includes(".tex")) {
    return null;
  }
  if (lower.endsWith(".png") || lower.endsWith(".webp")) {
    return url;
  }
  return null;
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number
): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCdragonCache(): Promise<CdragonCache> {
  const cached = globalThis.__tftCdragonCache;
  if (cached && Date.now() - cached.loadedAt < CDRAGON_CACHE_TTL_MS) {
    return cached;
  }

  if (globalThis.__tftCdragonLoadPromise) {
    return globalThis.__tftCdragonLoadPromise;
  }

  globalThis.__tftCdragonLoadPromise = (async () => {
    const startedAt = Date.now();
    const [championsData, itemsData] = await Promise.all([
      fetchJsonWithTimeout(TFT_CHAMPIONS_URL, 5000),
      fetchJsonWithTimeout(TFT_ITEMS_URL, 5000)
    ]);

    const championsByApiName = new Map<string, CdragonChampion>();
    const itemsByApiName = new Map<string, CdragonItem>();

    if (Array.isArray(championsData)) {
      championsData.forEach((entry) => {
        const record = toRecord(entry);
        if (!record) {
          return;
        }
        const apiName = toString(record.apiName) ?? toString(record.characterName);
        if (!apiName) {
          return;
        }
        const normalized = apiName.toLowerCase();
        const champ: CdragonChampion = {
          apiName: toString(record.apiName) ?? undefined,
          characterName: toString(record.characterName) ?? undefined,
          squareIconPath: toString(record.squareIconPath) ?? undefined,
          tileIconPath: toString(record.tileIconPath) ?? undefined,
          iconPath: toString(record.iconPath) ?? undefined
        };
        championsByApiName.set(apiName, champ);
        championsByApiName.set(normalized, champ);
      });
    }

    if (Array.isArray(itemsData)) {
      itemsData.forEach((entry) => {
        const record = toRecord(entry);
        if (!record) {
          return;
        }
        const apiName = toString(record.apiName);
        if (!apiName) {
          return;
        }
        const normalized = apiName.toLowerCase();
        const item: CdragonItem = {
          apiName: toString(record.apiName) ?? undefined,
          iconPath: toString(record.iconPath) ?? undefined
        };
        itemsByApiName.set(apiName, item);
        itemsByApiName.set(normalized, item);
      });
    }

    const cache: CdragonCache = {
      loadedAt: Date.now(),
      loadMs: Date.now() - startedAt,
      championsByApiName,
      itemsByApiName
    };

    globalThis.__tftCdragonCache = cache;
    return cache;
  })();

  try {
    return await globalThis.__tftCdragonLoadPromise;
  } finally {
    globalThis.__tftCdragonLoadPromise = undefined;
  }
}

export async function getChampionIconUrl(
  characterId: string
): Promise<string | null> {
  const id = characterId.trim();
  if (!id) {
    return null;
  }
  const cache = await loadCdragonCache();
  const champ = cache.championsByApiName.get(id) ??
    cache.championsByApiName.get(id.toLowerCase());
  if (!champ) {
    return null;
  }
  const path = champ.squareIconPath ?? champ.tileIconPath ?? champ.iconPath ?? null;
  return sanitizeIconUrl(toCdragonAssetUrl(path));
}

export async function getItemIconUrl(apiName: string): Promise<string | null> {
  const id = apiName.trim();
  if (!id) {
    return null;
  }
  const cache = await loadCdragonCache();
  const item = cache.itemsByApiName.get(id) ??
    cache.itemsByApiName.get(id.toLowerCase());
  if (!item) {
    return null;
  }
  return sanitizeIconUrl(toCdragonAssetUrl(item.iconPath ?? null));
}

export async function getCdragonCacheInfo() {
  const cache = globalThis.__tftCdragonCache;
  if (!cache) {
    return null;
  }
  return { loadedAt: cache.loadedAt, loadMs: cache.loadMs };
}
