import "server-only";

import { promises as fs } from "fs";
import path from "path";

const CDRAGON_JSON_PATH = path.join(
  process.cwd(),
  "public",
  "cdragon",
  "tft-set.json"
);
const CDRAGON_ASSET_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/";
const CDRAGON_CDN_ASSET_BASE =
  "https://cdn.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/";
const CDRAGON_RAW_ASSET_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/";

export type CdragonCache = {
  loadedAt: number;
  loadMs: number;
  championsByApiName: Map<string, string>;
  itemsByApiName: Map<string, string>;
  traitsByName: Map<string, string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __tftCdragonCache: CdragonCache | undefined;
  // eslint-disable-next-line no-var
  var __tftCdragonLoadPromise: Promise<CdragonCache> | undefined;
}

type CdragonSetData = {
  champions?: unknown;
  traits?: unknown;
};

type CdragonRoot = {
  setData?: unknown;
  items?: unknown;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function toString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function toCdragonAssetUrl(pathValue?: string | null): string | null {
  if (!pathValue) {
    return null;
  }
  let normalized = pathValue.trim();
  if (!normalized) {
    return null;
  }
  normalized = normalized.replace(/^\/+/, "");
  normalized = normalized.replace(/^lol-game-data\/assets\//i, "");
  normalized = normalized.toLowerCase();
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
  if (url === "/icons/unknown-unit.png" || url === "/icons/unknown-item.png") {
    return url;
  }
  const lower = url.toLowerCase();
  if (
    !lower.startsWith(CDRAGON_ASSET_BASE) &&
    !lower.startsWith(CDRAGON_CDN_ASSET_BASE) &&
    !lower.startsWith(CDRAGON_RAW_ASSET_BASE)
  ) {
    return null;
  }
  if (lower.includes(".tex")) {
    return null;
  }
  if (lower.endsWith(".png") || lower.endsWith(".webp")) {
    return url;
  }
  return null;
}

async function loadCdragonCache(): Promise<CdragonCache> {
  const cached = globalThis.__tftCdragonCache;
  if (cached) {
    return cached;
  }

  if (globalThis.__tftCdragonLoadPromise) {
    return globalThis.__tftCdragonLoadPromise;
  }

  globalThis.__tftCdragonLoadPromise = (async () => {
    const startedAt = Date.now();
    const raw = await fs.readFile(CDRAGON_JSON_PATH, "utf-8");
    const data = JSON.parse(raw) as CdragonRoot;

    const championsByApiName = new Map<string, string>();
    const itemsByApiName = new Map<string, string>();
    const traitsByName = new Map<string, string>();

    const setData = Array.isArray(data.setData) ? data.setData : [];
    setData.forEach((entry) => {
      const record = toRecord(entry) as CdragonSetData | null;
      if (!record) {
        return;
      }
      const champions = Array.isArray(record.champions)
        ? record.champions
        : [];
      champions.forEach((champion) => {
        const champRecord = toRecord(champion);
        if (!champRecord) {
          return;
        }
        const apiName =
          toString(champRecord.apiName) ?? toString(champRecord.characterName);
        if (!apiName) {
          return;
        }
        const iconPath =
          toString(champRecord.tileIcon) ?? toString(champRecord.squareIcon);
        if (!iconPath) {
          return;
        }
        championsByApiName.set(apiName.toLowerCase(), iconPath);
      });

      const traits = Array.isArray(record.traits) ? record.traits : [];
      traits.forEach((trait) => {
        const traitRecord = toRecord(trait);
        if (!traitRecord) {
          return;
        }
        const apiName = toString(traitRecord.apiName);
        const name = toString(traitRecord.name);
        const iconPath = toString(traitRecord.icon);
        if (!iconPath) {
          return;
        }
        if (apiName) {
          traitsByName.set(apiName.toLowerCase(), iconPath);
        }
        if (name) {
          traitsByName.set(name.toLowerCase(), iconPath);
        }
      });
    });

    const items = Array.isArray(data.items) ? data.items : [];
    items.forEach((entry) => {
      const itemRecord = toRecord(entry);
      if (!itemRecord) {
        return;
      }
      const apiName = toString(itemRecord.apiName);
      const iconPath = toString(itemRecord.icon);
      if (!apiName || !iconPath) {
        return;
      }
      itemsByApiName.set(apiName.toLowerCase(), iconPath);
    });

    const cache: CdragonCache = {
      loadedAt: Date.now(),
      loadMs: Date.now() - startedAt,
      championsByApiName,
      itemsByApiName,
      traitsByName
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
  const pathValue = cache.championsByApiName.get(id.toLowerCase());
  if (!pathValue) {
    return null;
  }
  return sanitizeIconUrl(toCdragonAssetUrl(pathValue));
}

export async function getItemIconUrl(apiName: string): Promise<string | null> {
  const id = apiName.trim();
  if (!id) {
    return null;
  }
  const cache = await loadCdragonCache();
  const pathValue = cache.itemsByApiName.get(id.toLowerCase());
  if (!pathValue) {
    return null;
  }
  return sanitizeIconUrl(toCdragonAssetUrl(pathValue));
}

export async function getTftTraitIconUrl(
  name: string
): Promise<string | null> {
  const id = name.trim();
  if (!id) {
    return null;
  }
  const cache = await loadCdragonCache();
  const pathValue = cache.traitsByName.get(id.toLowerCase());
  if (!pathValue) {
    return null;
  }
  return sanitizeIconUrl(toCdragonAssetUrl(pathValue));
}

export async function getCdragonCacheInfo() {
  const cache = globalThis.__tftCdragonCache;
  if (!cache) {
    return null;
  }
  return { loadedAt: cache.loadedAt, loadMs: cache.loadMs };
}
