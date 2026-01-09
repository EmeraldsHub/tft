import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

const CDRAGON_IT_URL =
  "https://raw.communitydragon.org/latest/cdragon/tft/it_it.json";
const CDRAGON_EN_URL =
  "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json";
const CDRAGON_ASSET_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/";
const LOCAL_CDRAGON_PATH = path.join(
  process.cwd(),
  "public",
  "cdragon",
  "tft-set.json"
);

type IconCache = {
  champIconByApiName: Record<string, string>;
  itemIconByApiName: Record<string, string>;
  loadedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __cdragonIconCache: IconCache | undefined;
  // eslint-disable-next-line no-var
  var __cdragonIconLoadPromise: Promise<IconCache> | undefined;
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

function toCDragonAssetUrl(pathValue?: string | null): string | null {
  if (!pathValue) {
    return null;
  }
  let normalized = pathValue.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  normalized = normalized.replace(/^\//, "");
  normalized = normalized.replace(/^lol-game-data\/assets\//, "assets/");
  normalized = normalized.replace(/^assets\//, "assets/");
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

async function fetchCdragonJson(): Promise<unknown> {
  try {
    const local = await readFile(LOCAL_CDRAGON_PATH, "utf-8");
    return JSON.parse(local) as unknown;
  } catch {
    // Fall through to remote fetch.
  }

  const response = await fetch(CDRAGON_IT_URL, { cache: "no-store" });
  if (response.ok) {
    return (await response.json()) as unknown;
  }
  const fallback = await fetch(CDRAGON_EN_URL, { cache: "no-store" });
  if (!fallback.ok) {
    throw new Error("Failed to load CDragon TFT JSON");
  }
  return (await fallback.json()) as unknown;
}

async function loadCdragonIcons(): Promise<IconCache> {
  if (globalThis.__cdragonIconCache) {
    return globalThis.__cdragonIconCache;
  }

  if (globalThis.__cdragonIconLoadPromise) {
    return globalThis.__cdragonIconLoadPromise;
  }

  globalThis.__cdragonIconLoadPromise = (async () => {
    const data = await fetchCdragonJson();
    const champIconByApiName: Record<string, string> = {};
    const itemIconByApiName: Record<string, string> = {};

    const root = toRecord(data);
    const setData = root && Array.isArray(root.setData) ? root.setData : [];
    const sets = root && typeof root.sets === "object" ? root.sets : null;
    const topLevelItems = root && Array.isArray(root.items) ? root.items : [];

    const upsertChamp = (apiName: string, iconPath: string | null) => {
      const url = sanitizeIconUrl(toCDragonAssetUrl(iconPath));
      if (!url) {
        return;
      }
      if (!champIconByApiName[apiName]) {
        champIconByApiName[apiName] = url;
      }
      const lower = apiName.toLowerCase();
      if (!champIconByApiName[lower]) {
        champIconByApiName[lower] = url;
      }
    };

    const upsertItem = (apiName: string, iconPath: string | null) => {
      const url = sanitizeIconUrl(toCDragonAssetUrl(iconPath));
      if (!url) {
        return;
      }
      if (!itemIconByApiName[apiName]) {
        itemIconByApiName[apiName] = url;
      }
      const lower = apiName.toLowerCase();
      if (!itemIconByApiName[lower]) {
        itemIconByApiName[lower] = url;
      }
    };

    const scanChampions = (entries: unknown) => {
      if (!Array.isArray(entries)) {
        return;
      }
      entries.forEach((entry) => {
        const record = toRecord(entry);
        if (!record) {
          return;
        }
        const apiName = toString(record.apiName) ?? toString(record.characterName);
        if (!apiName) {
          return;
        }
        const tileIcon = toString(record.tileIcon);
        const squareIcon = toString(record.squareIcon);
        const icon = toString(record.icon);
        const resolved = tileIcon ?? squareIcon ?? icon;
        upsertChamp(apiName, resolved ?? null);
      });
    };

    const scanItems = (entries: unknown) => {
      if (!Array.isArray(entries)) {
        return;
      }
      entries.forEach((entry) => {
        const record = toRecord(entry);
        if (!record) {
          return;
        }
        const apiName = toString(record.apiName);
        if (!apiName) {
          return;
        }
        const icon = toString(record.icon);
        upsertItem(apiName, icon ?? null);
      });
    };

    setData.forEach((setEntry) => {
      const setRecord = toRecord(setEntry);
      if (!setRecord) {
        return;
      }
      scanChampions(setRecord.champions);
      scanItems(setRecord.items);
    });

    if (sets && typeof sets === "object") {
      Object.values(sets).forEach((setEntry) => {
        const setRecord = toRecord(setEntry);
        if (!setRecord) {
          return;
        }
        scanChampions(setRecord.champions);
        scanItems(setRecord.items);
      });
    }

    scanItems(topLevelItems);

    const cache: IconCache = {
      champIconByApiName,
      itemIconByApiName,
      loadedAt: Date.now()
    };

    globalThis.__cdragonIconCache = cache;
    return cache;
  })();

  try {
    return await globalThis.__cdragonIconLoadPromise;
  } finally {
    globalThis.__cdragonIconLoadPromise = undefined;
  }
}

export async function getChampionIconUrl(
  characterId: string
): Promise<string | null> {
  const id = characterId.trim();
  if (!id) {
    return null;
  }
  const { champIconByApiName } = await loadCdragonIcons();
  return champIconByApiName[id] ?? champIconByApiName[id.toLowerCase()] ?? null;
}

export async function getItemIconUrl(apiName: string): Promise<string | null> {
  const id = apiName.trim();
  if (!id) {
    return null;
  }
  const { itemIconByApiName } = await loadCdragonIcons();
  return itemIconByApiName[id] ?? itemIconByApiName[id.toLowerCase()] ?? null;
}
