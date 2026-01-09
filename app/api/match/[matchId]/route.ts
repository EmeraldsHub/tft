export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getChampionIconUrl,
  getItemIconUrl,
  getTftTraitIconUrl,
  sanitizeIconUrl
} from "@/lib/cdragonStatic";

const MATCH_ID_REGEX = /^[A-Z0-9]+_\d+$/;

type MatchParticipantUnit = {
  character_id?: string | null;
  tier?: number | null;
  itemNames?: string[] | null;
  champIconUrl?: string | null;
  itemIconUrls?: Array<string | null> | null;
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
  level?: number | null;
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
  level: number | null;
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
  topTraits: Array<{
    name: string;
    num_units: number;
    style: number;
    iconUrl: string | null;
  }>;
};

const UNKNOWN_UNIT_ICON = "/icons/unknown-unit.png";

function getPlacement(value: MatchParticipant) {
  const placement = value.placement;
  return typeof placement === "number" ? placement : 999;
}

function previewNeedsIcons(preview: PlayerPreview) {
  const unitList = Array.isArray(preview.units) ? preview.units : [];
  return unitList.some((unit) => {
    const itemNames = Array.isArray(unit.itemNames) ? unit.itemNames : [];
    const itemIconUrls = Array.isArray(unit.itemIconUrls)
      ? unit.itemIconUrls.map((url) => sanitizeIconUrl(url))
      : [];
    const champIconUrl = sanitizeIconUrl(unit.champIconUrl);
    if (champIconUrl === null) {
      return true;
    }
    if (itemIconUrls.length !== itemNames.length) {
      return true;
    }
    return itemIconUrls.some((url) => url === null);
  });
}

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
        (Array.isArray(participant.units) ? participant.units : []).map(
          async (unit) => {
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
          const safeChampIconUrl =
            sanitizeIconUrl(champIconUrl) ?? UNKNOWN_UNIT_ICON;
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
      const topTraitsSource = traitsSource
        .filter(
          (trait) =>
            (trait.style ?? 0) > 0 || (trait.tier_current ?? 0) > 0
        )
        .sort((a, b) => {
          const styleDiff = (b.style ?? 0) - (a.style ?? 0);
          if (styleDiff !== 0) {
            return styleDiff;
          }
          return (b.num_units ?? 0) - (a.num_units ?? 0);
        })
        .slice(0, 5);
      const topTraits = await Promise.all(
        topTraitsSource.map(async (trait) => {
          const name = trait.name ?? "";
          const iconUrl = name ? await getTftTraitIconUrl(name) : null;
          return {
            name,
            num_units: trait.num_units ?? 0,
            style: trait.style ?? 0,
            iconUrl
          };
        })
      );
      return [
        puuid,
        {
          puuid,
          riotIdGameName: participant.riotIdGameName ?? null,
          riotIdTagline: participant.riotIdTagline ?? null,
          placement: participant.placement ?? null,
          level: typeof participant.level === "number" ? participant.level : null,
          units,
          traits,
          topTraits
        }
      ] as const;
    })
  );

  type PreviewEntry = readonly [string, PlayerPreview];
  const validEntries: PreviewEntry[] = [];
  for (const entry of entries as unknown[]) {
    if (
      Array.isArray(entry) &&
      entry.length >= 2 &&
      typeof entry[0] === "string" &&
      entry[1] != null
    ) {
      const key = entry[0];
      const value = entry[1] as PlayerPreview;
      validEntries.push([key, value] as const);
    }
  }
  return Object.fromEntries(validEntries);
}

async function enrichParticipants(
  participants: MatchParticipant[]
): Promise<MatchParticipant[]> {
  return Promise.all(
    participants.map(async (participant) => {
      const units = await Promise.all(
        (Array.isArray(participant.units) ? participant.units : []).map(
          async (unit) => {
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
          const safeChampIconUrl =
            sanitizeIconUrl(champIconUrl) ?? UNKNOWN_UNIT_ICON;
          return {
            ...unit,
            character_id: characterId,
            itemNames,
            champIconUrl: safeChampIconUrl,
            itemIconUrls: safeItemIconUrls
          };
        })
      );
      return {
        ...participant,
        units
      };
    })
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { matchId: string } }
) {
  try {
    const matchId = params.matchId;
    if (!MATCH_ID_REGEX.test(matchId)) {
      return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
    }

    const { data: cached } = await supabaseAdmin
      .from("tft_match_cache")
      .select("match_id, region, game_datetime, queue_id, data, player_previews")
      .eq("match_id", matchId)
      .maybeSingle();

    if (cached) {
      const payload = cached.data as MatchPayload | null;
      const participants = payload?.info?.participants ?? [];
      const participantsSorted = participants
        .slice()
        .sort((a, b) => getPlacement(a) - getPlacement(b));
      const participantsWithIcons = await enrichParticipants(participantsSorted);
      const gameDateTime =
        typeof payload?.info?.game_datetime === "number"
          ? payload.info.game_datetime
          : null;
      const previews = cached.player_previews as
        | Record<string, PlayerPreview>
        | null;
      const needsPreviewRefresh =
        !previews ||
        Object.keys(previews).length === 0 ||
        Object.values(previews).some((preview) =>
          preview ? previewNeedsIcons(preview) : true
        );

      if (needsPreviewRefresh) {
        const built = await buildPlayerPreviews(participants);
        if (Object.keys(built).length > 0) {
          await supabaseAdmin
            .from("tft_match_cache")
            .update({ player_previews: built })
            .eq("match_id", matchId);
        }
      }

      return NextResponse.json({
        matchId,
        cached: true,
        gameDateTime,
        gameDatetimeISO: cached.game_datetime
          ? new Date(cached.game_datetime).toISOString()
          : null,
        queueId: cached.queue_id ?? null,
        participants: participantsWithIcons
      });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing RIOT_API_KEY" },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let payload: MatchPayload | null = null;

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
        return NextResponse.json(
          { error: "Riot API unavailable" },
          { status: 502 }
        );
      }

      payload = (await response.json()) as MatchPayload;
    } catch {
      return NextResponse.json(
        { error: "Riot API unavailable" },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    const ms =
      typeof payload?.info?.game_datetime === "number"
        ? payload.info.game_datetime
        : null;
    const queueId =
      payload?.info?.queue_id ?? payload?.info?.queueId ?? null;
    const gameDatetimeISO = ms
      ? new Date(ms).toISOString()
      : new Date().toISOString();
    const previewParticipants = payload?.info?.participants ?? [];
    const playerPreviews = await buildPlayerPreviews(previewParticipants);

    const { error: insertError } = await supabaseAdmin
      .from("tft_match_cache")
      .insert({
        match_id: matchId,
        region: "EUROPE",
        game_datetime: gameDatetimeISO,
        queue_id: queueId,
        data: payload,
        player_previews: playerPreviews,
        fetched_at: new Date().toISOString()
      });

    if (insertError && insertError.code !== "23505") {
      console.warn("[tft_match_cache] insert failed", insertError.message);
    }

    const participants = payload?.info?.participants ?? [];
    const participantsSorted = participants
      .slice()
      .sort((a, b) => getPlacement(a) - getPlacement(b));
    const participantsWithIcons = await enrichParticipants(participantsSorted);

    return NextResponse.json({
      matchId,
      cached: false,
      gameDateTime: ms,
      gameDatetimeISO: ms ? gameDatetimeISO : null,
      queueId,
      participants: participantsWithIcons
    });
  } catch (error) {
    console.error("[api/match] failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
