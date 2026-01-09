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
};

type MatchPreviewResponse = {
  previews: Record<string, PlayerPreview | null>;
  error?: string;
};

async function buildPlayerPreviews(
  participants: MatchParticipant[]
): Promise<Record<string, PlayerPreview>> {
  const entries = await Promise.all(
    participants.map(async (participant) => {
      const puuid = participant.puuid ?? null;
      if (!puuid) {
        return null;
      }
      const units = await Promise.all(
        (participant.units ?? []).map(async (unit) => {
          const characterId = unit.character_id ?? "";
          const itemNames = Array.isArray(unit.itemNames) ? unit.itemNames : [];
          const champIconUrl = characterId
            ? await getChampionIconUrl(characterId)
            : null;
          const itemIconUrls = itemNames.length
            ? await Promise.all(
                itemNames.map((itemName) => getItemIconUrl(itemName))
              )
            : [];
          const safeItemIconUrls = itemIconUrls.map((url) =>
            sanitizeIconUrl(url)
          );
          const safeChampIconUrl = sanitizeIconUrl(champIconUrl);
          return {
            character_id: characterId,
            tier: typeof unit.tier === "number" ? unit.tier : 0,
            itemNames,
            champIconUrl: safeChampIconUrl,
            itemIconUrls: safeItemIconUrls
          };
        })
      );
      const traits = (participant.traits ?? []).map((trait) => ({
        name: trait.name ?? "",
        num_units: trait.num_units ?? 0,
        style: trait.style ?? 0,
        tier_current: trait.tier_current ?? 0,
        tier_total: trait.tier_total ?? 0
      }));
      return [
        puuid,
        {
          puuid,
          riotIdGameName: participant.riotIdGameName ?? null,
          riotIdTagline: participant.riotIdTagline ?? null,
          placement: participant.placement ?? null,
          units,
          traits
        }
      ] as const;
    })
  );

  return Object.fromEntries(
    entries.filter((entry): entry is [string, PlayerPreview] => Boolean(entry))
  );
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
  apiKey: string | null
): Promise<PlayerPreview | null> {
  if (!apiKey) {
    return null;
  }

  const payload = await fetchRiotMatch(matchId, apiKey);
  if (!payload) {
    return null;
  }

  const participants = payload.info?.participants ?? [];
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
        region: "EUROPE",
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

  return playerPreviews[puuid] ?? null;
}

async function hydratePreviewIcons(
  preview: PlayerPreview
): Promise<{ preview: PlayerPreview; changed: boolean }> {
  let changed = false;
  const unitList = Array.isArray(preview.units) ? preview.units : [];
  const units = await Promise.all(
    unitList.map(async (unit) => {
      const itemNames = Array.isArray(unit.itemNames) ? unit.itemNames : [];
      let itemIconUrls = Array.isArray(unit.itemIconUrls)
        ? unit.itemIconUrls
        : [];
      itemIconUrls = itemIconUrls.map((url) => sanitizeIconUrl(url));
      if (
        itemIconUrls.length !== itemNames.length ||
        itemIconUrls.some((url) => url === null)
      ) {
        itemIconUrls = await Promise.all(
          itemNames.map((itemName) => getItemIconUrl(itemName))
        );
        itemIconUrls = itemIconUrls.map((url) => sanitizeIconUrl(url));
        changed = true;
      }

      let champIconUrl = sanitizeIconUrl(unit.champIconUrl);
      if (champIconUrl === null) {
        champIconUrl = unit.character_id
          ? await getChampionIconUrl(unit.character_id)
          : null;
        champIconUrl = sanitizeIconUrl(champIconUrl);
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
      ? puuidValue.trim()
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

    const { matchIds, puuid } = parseRequestBody(body);
    const previews: Record<string, PlayerPreview | null> = {};

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
        ? cachedPreviews[puuid] ?? null
        : null;
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
          previews[matchId] = null;
        });
      } else {
        const fetched = await runWithLimit(
          missingMatchIds,
          2,
          async (matchId) => {
            const preview = await fetchPreviewForMatch(matchId, puuid, apiKey);
            return { matchId, preview };
          }
        );

        fetched.forEach(({ matchId, preview }) => {
          previews[matchId] = preview ?? null;
        });
      }
    }

    matchIds.forEach((matchId) => {
      if (!Object.prototype.hasOwnProperty.call(previews, matchId)) {
        previews[matchId] = null;
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
