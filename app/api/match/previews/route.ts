export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getChampionIconUrl,
  getItemIconUrl,
  sanitizeIconUrl
} from "@/lib/cdragonStatic";

const MATCH_ID_REGEX = /^[A-Z0-9]+_\d+$/;

type MatchParticipantUnit = {
  character_id?: string | null;
  tier?: number | null;
  itemNames?: string[] | null;
};

type MatchParticipantTrait = {
  name?: string | null;
  num_units?: number | null;
  style?: number | null;
  tier_current?: number | null;
  tier_total?: number | null;
};

type MatchParticipant = {
  placement?: number | null;
  puuid?: string | null;
  riotIdGameName?: string | null;
  riotIdTagline?: string | null;
  units?: MatchParticipantUnit[] | null;
  traits?: MatchParticipantTrait[] | null;
};

type MatchInfo = {
  participants?: MatchParticipant[];
  game_datetime?: number;
  queue_id?: number;
  queueId?: number;
};

type MatchPayload = {
  info?: MatchInfo;
};

type PlayerPreview = {
  puuid: string;
  riotIdGameName: string | null;
  riotIdTagline: string | null;
  placement: number | null;
  units: Array<{
    character_id: string;
    tier: number;
    itemNames: string[];
    champIconUrl: string | null;
    itemIconUrls: Array<string | null>;
  }>;
  traits: Array<{
    name: string;
    num_units: number;
    style: number;
    tier_current: number;
    tier_total: number;
  }>;
  reason?: "PLAYER_NOT_FOUND" | "no_puuid_match_fallback_top1" | "no_units_in_match";
};

type MatchPreviewResponse = {
  previews: Record<string, PlayerPreview>;
  error?: string;
};

const isDev = process.env.NODE_ENV !== "production";
const UNKNOWN_UNIT_ICON = "/icons/unknown-unit.png";
const UNKNOWN_ITEM_ICON = "/icons/unknown-item.png";

function devWarn(message: string, details?: Record<string, unknown>) {
  if (!isDev) {
    return;
  }
  if (details) {
    console.warn(message, details);
    return;
  }
  console.warn(message);
}

function normalizePuuid(value: string | null | undefined) {
  return value ? value.trim().toLowerCase() : "";
}

function mapShardToRoutingRegion(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (["EUW1", "EUN1", "RU", "TR1"].includes(normalized)) {
    return "EUROPE";
  }
  if (["NA1", "BR1", "LA1", "LA2", "OC1"].includes(normalized)) {
    return "AMERICAS";
  }
  if (["KR", "JP1"].includes(normalized)) {
    return "ASIA";
  }
  if (["EUROPE", "AMERICAS", "ASIA"].includes(normalized)) {
    return normalized;
  }
  return null;
}

function withReason(preview: PlayerPreview, reason: PlayerPreview["reason"]) {
  if (!isDev || !reason) {
    return preview;
  }
  return { ...preview, reason };
}

function buildMissingPreview(puuid: string): PlayerPreview {
  return withReason(
    {
      puuid,
      riotIdGameName: null,
      riotIdTagline: null,
      placement: null,
      units: [],
      traits: []
    },
    "PLAYER_NOT_FOUND"
  );
}

async function buildPreviewFromParticipant(
  participant: MatchParticipant,
  puuidOverride?: string | null,
  reason?: PlayerPreview["reason"]
): Promise<PlayerPreview | null> {
  const puuid = normalizePuuid(puuidOverride ?? participant.puuid ?? null);
  if (!puuid) {
    return null;
  }
  const unitsSource = Array.isArray(participant.units)
    ? participant.units
    : [];
  const units = await Promise.all(
    unitsSource.map(async (unit) => {
      const characterId = unit.character_id ?? "";
      const itemNames = Array.isArray(unit.itemNames) ? unit.itemNames : [];
      const champIconRaw = characterId
        ? await getChampionIconUrl(characterId)
        : null;
      if (!champIconRaw && isDev && characterId) {
        console.warn("[icons] missing champ icon", characterId);
      }
      const itemIconUrls = itemNames.length
        ? await Promise.all(
          itemNames.map(async (itemName) => {
            const url = await getItemIconUrl(itemName);
            if (!url && isDev) {
              console.warn("[icons] missing item icon", itemName);
            }
            return url;
          })
        )
        : [];
      const safeItemIconUrls = itemIconUrls.map((url) => {
        const sanitized = sanitizeIconUrl(url);
        return sanitized ?? UNKNOWN_ITEM_ICON;
      });
      const safeChampIconUrl =
        sanitizeIconUrl(champIconRaw) ?? UNKNOWN_UNIT_ICON;
      return {
        character_id: characterId,
        tier: typeof unit.tier === "number" ? unit.tier : 0,
        itemNames,
        champIconUrl: safeChampIconUrl,
        itemIconUrls: safeItemIconUrls
      };
    })
  );
  const traitsSource = Array.isArray(participant.traits)
    ? participant.traits
    : [];
  const traits = traitsSource.map((trait) => ({
    name: trait.name ?? "",
    num_units: trait.num_units ?? 0,
    style: trait.style ?? 0,
    tier_current: trait.tier_current ?? 0,
    tier_total: trait.tier_total ?? 0
  }));
  return withReason(
    {
      puuid,
      riotIdGameName: participant.riotIdGameName ?? null,
      riotIdTagline: participant.riotIdTagline ?? null,
      placement: participant.placement ?? null,
      units,
      traits
    },
    reason ?? (unitsSource.length === 0 ? "no_units_in_match" : undefined)
  );
}

function selectFallbackParticipant(
  participants: MatchParticipant[]
): MatchParticipant | null {
  if (participants.length === 0) {
    return null;
  }
  const withPlacement = participants.filter(
    (participant) => typeof participant.placement === "number"
  );
  if (withPlacement.length === 0) {
    return participants[0];
  }
  return withPlacement.reduce((best, current) => {
    if (best.placement == null) {
      return current;
    }
    if (current.placement == null) {
      return best;
    }
    return current.placement < best.placement ? current : best;
  });
}

function selectParticipantForPuuid(
  participants: MatchParticipant[],
  puuid: string
): MatchParticipant | null {
  const normalized = normalizePuuid(puuid);
  if (!normalized) {
    return null;
  }
  return (
    participants.find(
      (participant) => normalizePuuid(participant.puuid) === normalized
    ) ?? null
  );
}

function getUnitsCount(participant: MatchParticipant | null) {
  if (!participant) {
    return null;
  }
  const units = participant.units;
  return Array.isArray(units) ? units.length : null;
}

function getParticipantsCount(participants: MatchParticipant[] | undefined) {
  return Array.isArray(participants) ? participants.length : 0;
}

function findPreviewForPuuid(
  previews: Record<string, PlayerPreview>,
  puuid: string
) {
  const normalized = normalizePuuid(puuid);
  if (!normalized) {
    return null;
  }
  return (
    previews[puuid] ??
    Object.entries(previews).find(
      ([key]) => normalizePuuid(key) === normalized
    )?.[1] ??
    null
  );
}

type PreviewEntry = readonly [string, PlayerPreview];

function isPreviewEntry(entry: PreviewEntry | null): entry is PreviewEntry {
  return entry !== null;
}

async function buildPlayerPreviews(
  participants: MatchParticipant[]
): Promise<Record<string, PlayerPreview>> {
  const entries = await Promise.all(
    participants.map(async (participant) => {
      const preview = await buildPreviewFromParticipant(participant);
      if (!preview) {
        return null;
      }
      return [preview.puuid, preview] as const;
    })
  );

  const result: Record<string, PlayerPreview> = {};
  entries.filter(isPreviewEntry).forEach(([key, value]) => {
    result[key] = value;
  });
  return result;
}

async function fetchRiotMatch(
  matchId: string,
  apiKey: string
): Promise<MatchPayload | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://europe.api.riotgames.com/tft/match/v1/matches/${encodeURIComponent(
        matchId
      )}`,
      {
        headers: {
          "X-Riot-Token": apiKey
        },
        cache: "no-store",
        signal: controller.signal
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as MatchPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPreviewForMatch(
  matchId: string,
  puuid: string,
  apiKey: string | null,
  regionNormalized: string,
  regionReceived: string | null
): Promise<PlayerPreview> {
  if (!apiKey) {
    return buildMissingPreview(puuid);
  }

  const payload = await fetchRiotMatch(matchId, apiKey);
  if (!payload) {
    return buildMissingPreview(puuid);
  }

  const participants = payload.info?.participants ?? [];
  const participant = selectParticipantForPuuid(participants, puuid);
  devWarn("[api/match/previews] riot match", {
    matchId,
    regionReceived,
    regionNormalized,
    puuidReceived: puuid,
    participantsCount: getParticipantsCount(participants),
    participantFound: Boolean(participant),
    participantUnitsCount: getUnitsCount(participant)
  });
  const playerPreviews = await buildPlayerPreviews(participants);
  const gameMs =
    typeof payload.info?.game_datetime === "number"
      ? payload.info.game_datetime
      : null;
  const queueId = payload.info?.queue_id ?? payload.info?.queueId ?? null;
  const gameDatetimeISO = gameMs
    ? new Date(gameMs).toISOString()
    : new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("tft_match_cache")
    .upsert(
      {
        match_id: matchId,
        region: regionNormalized,
        game_datetime: gameDatetimeISO,
        queue_id: queueId,
        data: payload,
        player_previews: playerPreviews,
        fetched_at: new Date().toISOString()
      },
      { onConflict: "match_id" }
    );

  if (error) {
    console.warn("[tft_match_cache] upsert failed", error.message);
  }

  const preview =
    findPreviewForPuuid(playerPreviews, puuid) ??
    (participant
      ? await buildPreviewFromParticipant(
          participant,
          puuid,
          "no_puuid_match_fallback_top1"
        )
      : null);
  if (preview) {
    return preview;
  }
  if (participants.length > 0) {
    const fallback = selectFallbackParticipant(participants);
    const fallbackPreview = fallback
      ? await buildPreviewFromParticipant(
          fallback,
          puuid,
          "no_puuid_match_fallback_top1"
        )
      : null;
    if (fallbackPreview) {
      return fallbackPreview;
    }
  }
  return buildMissingPreview(puuid);
}

async function hydratePreviewIcons(
  preview: PlayerPreview
): Promise<{ preview: PlayerPreview; changed: boolean }> {
  let changed = false;
  const unitList = Array.isArray(preview.units) ? preview.units : [];
  const units = await Promise.all(
    unitList.map(async (unit) => {
      const itemNames = Array.isArray(unit.itemNames) ? unit.itemNames : [];
      const resolvedItemIconUrls = itemNames.length
        ? await Promise.all(
            itemNames.map(async (itemName) => {
              const url = await getItemIconUrl(itemName);
              if (!url && isDev) {
                console.warn("[icons] missing item icon", itemName);
              }
              return url;
            })
          )
        : [];
      const itemIconUrls = resolvedItemIconUrls.map((url) => {
        const sanitized = sanitizeIconUrl(url);
        return sanitized ?? UNKNOWN_ITEM_ICON;
      });

      const champIconRaw = unit.character_id
        ? await getChampionIconUrl(unit.character_id)
        : null;
      if (!champIconRaw && isDev && unit.character_id) {
        console.warn("[icons] missing champ icon", unit.character_id);
      }
      const champIconUrl =
        sanitizeIconUrl(champIconRaw) ?? UNKNOWN_UNIT_ICON;

      if (
        champIconUrl !== unit.champIconUrl ||
        JSON.stringify(itemIconUrls) !== JSON.stringify(unit.itemIconUrls ?? [])
      ) {
        changed = true;
      }

      return {
        ...unit,
        itemIconUrls,
        champIconUrl
      };
    })
  );

  return {
    preview: { ...preview, units },
    changed
  };
}

async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const currentIndex = index++;
        if (currentIndex >= items.length) {
          return;
        }
        results[currentIndex] = await worker(items[currentIndex]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function parseRequestBody(body: unknown): {
  matchIds: string[];
  puuid: string | null;
  region: string | null;
} {
  if (!body || typeof body !== "object") {
    return { matchIds: [], puuid: null, region: null };
  }

  const record = body as Record<string, unknown>;
  const matchIdsValue = record.matchIds;
  const puuidValue = record.puuid;
  const regionValue =
    (record.region ?? record.platform ?? record.routingRegion) ?? null;

  const puuid =
    typeof puuidValue === "string" && puuidValue.trim().length > 0
      ? puuidValue.trim().toLowerCase()
      : null;
  const region =
    typeof regionValue === "string" && regionValue.trim().length > 0
      ? regionValue.trim()
      : null;

  const matchIds: string[] = [];
  if (Array.isArray(matchIdsValue)) {
    matchIdsValue.forEach((matchId) => {
      if (typeof matchId !== "string") {
        return;
      }
      if (!MATCH_ID_REGEX.test(matchId)) {
        return;
      }
      matchIds.push(matchId);
    });
  }

  return {
    matchIds: matchIds.slice(0, 10),
    puuid,
    region
  };
}

export async function POST(request: Request) {
  try {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      const response: MatchPreviewResponse = {
        previews: {},
        error: "invalid_payload"
      };
      return NextResponse.json(response, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const { matchIds, puuid, region } = parseRequestBody(body);
    const regionNormalized = mapShardToRoutingRegion(region) ?? "EUROPE";
    const previews: Record<string, PlayerPreview> = {};

    if (!puuid || matchIds.length === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[api/match/previews] invalid payload", body);
      }
      const response: MatchPreviewResponse = {
        previews,
        error: "invalid_payload"
      };
      return NextResponse.json(response, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const { data: cacheRows } = await supabaseAdmin
      .from("tft_match_cache")
      .select("match_id, player_previews")
      .in("match_id", matchIds);

    const previewMap = new Map<string, Record<string, PlayerPreview> | null>();
    (cacheRows ?? []).forEach((row) => {
      previewMap.set(
        row.match_id,
        (row.player_previews as Record<string, PlayerPreview> | null) ?? null
      );
    });

    const missingMatchIds: string[] = [];

    for (const matchId of matchIds) {
      const cachedPreviews = previewMap.get(matchId) ?? null;
      const cachedPreview = cachedPreviews
        ? findPreviewForPuuid(cachedPreviews, puuid)
        : null;
      devWarn("[api/match/previews] cache lookup", {
        matchId,
        regionReceived: region ?? null,
        regionNormalized,
        puuidReceived: puuid,
        cacheHit: Boolean(cachedPreview)
      });
      if (cachedPreview) {
        const { preview, changed } = await hydratePreviewIcons(cachedPreview);
        previews[matchId] = preview;
        if (changed && cachedPreviews) {
          await supabaseAdmin
            .from("tft_match_cache")
            .update({
              player_previews: {
                ...cachedPreviews,
                [puuid]: preview
              }
            })
            .eq("match_id", matchId);
        }
      } else {
        missingMatchIds.push(matchId);
      }
    }

    const apiKey = process.env.RIOT_API_KEY ?? null;

    if (missingMatchIds.length > 0) {
      if (!apiKey) {
        missingMatchIds.forEach((matchId) => {
          previews[matchId] = buildMissingPreview(puuid);
        });
      } else {
        const fetched = await runWithLimit(
          missingMatchIds,
          2,
          async (matchId) => {
            const preview = await fetchPreviewForMatch(
              matchId,
              puuid,
              apiKey,
              regionNormalized,
              region ?? null
            );
            return { matchId, preview };
          }
        );

        fetched.forEach(({ matchId, preview }) => {
          previews[matchId] = preview ?? buildMissingPreview(puuid);
        });
      }
    }

    matchIds.forEach((matchId) => {
      if (!Object.prototype.hasOwnProperty.call(previews, matchId)) {
        previews[matchId] = buildMissingPreview(puuid);
      }
    });

    const response: MatchPreviewResponse = { previews };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("[api/match/previews] failed", error);
    return NextResponse.json(
      { previews: {}, error: "Internal Server Error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
