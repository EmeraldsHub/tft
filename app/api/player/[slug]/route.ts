export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import {
  getRecentMatchesFromCache,
  getTrackedPlayerBySlug,
  RankedInfo
} from "@/lib/riotData";
import {
  getPlayerCache,
  setPlayerCache,
  shouldTriggerPlayerRefresh,
  invalidatePlayerCache
} from "@/lib/playerCache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getChampionIconUrl,
  getItemIconUrl,
  getTftTraitIconUrl,
  sanitizeIconUrl
} from "@/lib/cdragonStatic";
import { syncTrackedPlayerById } from "@/lib/riotData";
import { NextResponse } from "next/server";

type PlayerPreview = {
  placement: number | null;
  level?: number | null;
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
  topTraits?: Array<{
    name: string;
    num_units: number;
    style: number;
    iconUrl: string | null;
  }>;
  riotIdGameName?: string | null;
  riotIdTagline?: string | null;
};

type PlayerResponse = {
  player: Record<string, unknown> | null;
  ranked: RankedInfo | null;
  rankIconUrl: string | null;
  rankedQueue: string | null;
  avgPlacement: number | null;
  live: { inGame: boolean; gameStartTime: number | null; participantCount: number | null };
  recentMatches: Array<{
    matchId: string;
    placement: number | null;
    gameStartTime: number | null;
    gameDateTime: number | null;
    preview?: PlayerPreview | null;
  }>;
  favoriteUnit: {
    characterId: string;
    champIconUrl: string | null;
    count: number;
  } | null;
  favoriteItems: Array<{
    itemName: string;
    itemIconUrl: string | null;
    count: number;
  }>;
  favoriteTraits: Array<{
    name: string;
    iconUrl: string | null;
    count: number;
  }>;
  needsRankedRefresh?: boolean;
  needsMatchesRefresh?: boolean;
  needsProfileRefresh?: boolean;
};

const UNKNOWN_UNIT_ICON = "/icons/unknown-unit.png";
type FavoriteUnit = {
  characterId: string;
  champIconUrl: string | null;
  count: number;
};

function isAdminRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

async function hydratePreviewIcons(
  preview: PlayerPreview
): Promise<PlayerPreview> {
  const unitList = Array.isArray(preview.units) ? preview.units : [];
  const topTraitsList = Array.isArray(preview.topTraits)
    ? preview.topTraits
    : [];
  const units = await Promise.all(
    unitList.map(async (unit) => {
      const itemNames = Array.isArray(unit.itemNames) ? unit.itemNames : [];
      const resolvedItemIconUrls = itemNames.length
        ? await Promise.all(itemNames.map((itemName) => getItemIconUrl(itemName)))
        : [];
      const champIconUrl = unit.character_id
        ? await getChampionIconUrl(unit.character_id)
        : null;
      return {
        ...unit,
        itemIconUrls: resolvedItemIconUrls.map((url) => sanitizeIconUrl(url)),
        champIconUrl: sanitizeIconUrl(champIconUrl) ?? UNKNOWN_UNIT_ICON
      };
    })
  );
  const topTraits = await Promise.all(
    topTraitsList.map(async (trait) => {
      const name = trait.name ?? "";
      const sanitized = sanitizeIconUrl(trait.iconUrl ?? null);
      const iconUrl =
        sanitized ??
        (name ? await getTftTraitIconUrl(name) : null);
      return {
        ...trait,
        iconUrl
      };
    })
  );

  return {
    ...preview,
    units,
    topTraits
  };
}

function getRankIconUrl(tier: string | null) {
  if (!tier) {
    return null;
  }
  return `https://cdn.communitydragon.org/latest/tft/ranked-icons/${tier.toLowerCase()}.png`;
}

function pickFavoriteUnit(
  counts: Map<string, { count: number; champIconUrl: string | null }>
): FavoriteUnit | null {
  let favorite: FavoriteUnit | null = null;
  counts.forEach((value, characterId) => {
    if (!favorite || value.count > favorite.count) {
      favorite = {
        characterId,
        champIconUrl: value.champIconUrl,
        count: value.count
      };
    }
  });
  return favorite;
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const isProd = (process.env.NODE_ENV ?? "") === "production";
    const slugParam = params.slug;
    const cacheKey = slugParam.trim().toLowerCase();
    const url = new URL(request.url);
    const bypassCache =
      url.searchParams.get("refresh") === "1" ||
      request.headers.get("x-bypass-cache") === "1";
    const wantsRefresh = url.searchParams.get("refresh") === "1";
    const isAdmin = isAdminRequest(request);
    if (!isProd) {
      console.info("[player] request", { slug: cacheKey, bypassCache });
    }
    const cached = bypassCache ? null : getPlayerCache<PlayerResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "x-player-cache": "HIT"
        }
      });
    }

    const startedAt = Date.now();
    const dbStart = Date.now();
    let player = await getTrackedPlayerBySlug(cacheKey);
    if (player && wantsRefresh && isAdmin) {
      try {
        await syncTrackedPlayerById(player.id, { force: true });
        invalidatePlayerCache(cacheKey);
        player = await getTrackedPlayerBySlug(cacheKey);
      } catch (err) {
        if (!isProd) {
          console.info(
            "[player] manual refresh failed",
            err instanceof Error ? err.message : err
          );
        }
      }
    }
    const dbMs = Date.now() - dbStart;

    if (!player || !player.is_active) {
      const empty: PlayerResponse = {
        player: null,
        ranked: null,
        rankIconUrl: null,
        rankedQueue: null,
        avgPlacement: null,
        live: { inGame: false, gameStartTime: null, participantCount: null },
        recentMatches: [],
        favoriteUnit: null,
        favoriteItems: [],
        favoriteTraits: []
      };
      setPlayerCache(cacheKey, empty);
      return NextResponse.json(empty, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" }
      });
    }

    const ranked =
      player.ranked_tier && player.ranked_rank && player.ranked_lp !== null
        ? {
            tier: player.ranked_tier,
            rank: player.ranked_rank,
            leaguePoints: player.ranked_lp
          }
        : null;
    const avgPlacement = player.avg_placement_10 ?? null;
    const live = {
      inGame: Boolean(player.live_in_game),
      gameStartTime: player.live_game_start_time ?? null,
      participantCount: null
    };

    const recentMatches =
      player.puuid ? await getRecentMatchesFromCache(player.puuid, 10) : [];

    const payload: PlayerResponse = {
      player,
      ranked,
      rankIconUrl: ranked ? getRankIconUrl(ranked.tier) : "/ranks/UNRANKED.png",
      rankedQueue: player.ranked_queue ?? null,
      avgPlacement,
      live,
      recentMatches,
      favoriteUnit: null,
      favoriteItems: [],
      favoriteTraits: [],
      needsRankedRefresh: ranked === null,
      needsMatchesRefresh: recentMatches.length === 0,
      needsProfileRefresh: !player.puuid
    };

    if (player.puuid && recentMatches.length > 0) {
      const matchIds = recentMatches.map((match) => match.matchId);
      const { data: cacheRows } = await supabaseAdmin
        .from("tft_match_cache")
        .select("match_id, player_previews, queue_id, data")
        .in("match_id", matchIds);

      const previewMap = new Map<string, Record<string, PlayerPreview> | null>();
      const queueMap = new Map<string, number | null>();
      const dataMap = new Map<string, { info?: { queue_id?: number | null } } | null>();
      (cacheRows ?? []).forEach((row) => {
        previewMap.set(
          row.match_id,
          (row.player_previews as Record<string, PlayerPreview> | null) ?? null
        );
        queueMap.set(row.match_id, row.queue_id ?? null);
        dataMap.set(
          row.match_id,
          (row.data as { info?: { queue_id?: number | null } } | null) ?? null
        );
      });

      const puuid = player.puuid;
      payload.recentMatches = await Promise.all(
        recentMatches.map(async (match) => {
          const previews = previewMap.get(match.matchId);
          const preview = previews ? previews[puuid] ?? null : null;
          if (!preview) {
            return match;
          }
          const hydratedPreview = await hydratePreviewIcons(preview);
          return {
            ...match,
            preview: hydratedPreview
          };
        })
      );

      const rankedQueueIds = new Set([1100]);
      const unitCounts = new Map<string, { count: number; champIconUrl: string | null }>();
      const itemCounts = new Map<string, { count: number; itemIconUrl: string | null }>();
      const traitCounts = new Map<string, { count: number; iconUrl: string | null }>();
      payload.recentMatches.forEach((match) => {
        const queueId =
          queueMap.get(match.matchId) ??
          dataMap.get(match.matchId)?.info?.queue_id ??
          null;
        if (queueId !== null && !rankedQueueIds.has(queueId)) {
          return;
        }
        const preview = match.preview ?? null;
        const units = Array.isArray(preview?.units) ? preview.units : [];
        const topTraits = Array.isArray(preview?.topTraits) ? preview.topTraits : [];
        units.forEach((unit) => {
          const characterId = unit.character_id?.trim();
          if (!characterId) {
            return;
          }
          const existing = unitCounts.get(characterId);
          const champIconUrl = unit.champIconUrl ?? null;
          if (existing) {
            unitCounts.set(characterId, {
              count: existing.count + 1,
              champIconUrl: existing.champIconUrl ?? champIconUrl
            });
          } else {
            unitCounts.set(characterId, { count: 1, champIconUrl });
          }

          const itemNames = Array.isArray(unit.itemNames) ? unit.itemNames : [];
          const itemIconUrls = Array.isArray(unit.itemIconUrls)
            ? unit.itemIconUrls
            : [];
          itemNames.forEach((itemName, index) => {
            const name = itemName?.trim();
            if (!name) {
              return;
            }
            const iconUrl = itemIconUrls[index] ?? null;
            const existingItem = itemCounts.get(name);
            if (existingItem) {
              itemCounts.set(name, {
                count: existingItem.count + 1,
                itemIconUrl: existingItem.itemIconUrl ?? iconUrl
              });
            } else {
              itemCounts.set(name, { count: 1, itemIconUrl: iconUrl });
            }
          });
        });

        topTraits.forEach((trait) => {
          const name = trait.name?.trim();
          if (!name) {
            return;
          }
          const iconUrl = trait.iconUrl ?? null;
          const existingTrait = traitCounts.get(name);
          if (existingTrait) {
            traitCounts.set(name, {
              count: existingTrait.count + 1,
              iconUrl: existingTrait.iconUrl ?? iconUrl
            });
          } else {
            traitCounts.set(name, { count: 1, iconUrl });
          }
        });
      });

      let favorite = pickFavoriteUnit(unitCounts);
      if (favorite && !favorite.champIconUrl) {
        favorite.champIconUrl = await getChampionIconUrl(favorite.characterId);
      }
      payload.favoriteUnit = favorite;

      const itemEntries = Array.from(itemCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);
      const favoriteItems = await Promise.all(
        itemEntries.map(async ([itemName, meta]) => {
          let itemIconUrl = sanitizeIconUrl(meta.itemIconUrl ?? null);
          if (!itemIconUrl) {
            itemIconUrl = sanitizeIconUrl(await getItemIconUrl(itemName));
          }
          return {
            itemName,
            itemIconUrl,
            count: meta.count
          };
        })
      );
      payload.favoriteItems = favoriteItems;

      const traitEntries = Array.from(traitCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);
      const favoriteTraits = await Promise.all(
        traitEntries.map(async ([name, meta]) => {
          let iconUrl = sanitizeIconUrl(meta.iconUrl ?? null);
          if (!iconUrl) {
            iconUrl = sanitizeIconUrl(await getTftTraitIconUrl(name));
          }
          return {
            name,
            iconUrl,
            count: meta.count
          };
        })
      );
      payload.favoriteTraits = favoriteTraits;
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[player] slug=%s db=%dms total=%dms",
        cacheKey,
        dbMs,
        Date.now() - startedAt
      );
    }

    const lastUpdatedMs = player.riot_data_updated_at
      ? new Date(player.riot_data_updated_at).getTime()
      : 0;
    const refreshTtlMs = 5 * 60_000;
    const isStale = !lastUpdatedMs || Date.now() - lastUpdatedMs > refreshTtlMs;
    const shouldRefresh =
      payload.needsRankedRefresh ||
      payload.needsMatchesRefresh ||
      payload.needsProfileRefresh ||
      isStale;
    if (!isProd && shouldRefresh && shouldTriggerPlayerRefresh(cacheKey, refreshTtlMs)) {
      if (!isProd) {
        console.info("[player] background refresh queued", {
          slug: cacheKey,
          stale: isStale
        });
      }
      void (async () => {
        try {
          await syncTrackedPlayerById(player.id, { force: true });
          invalidatePlayerCache(cacheKey);
          if (!isProd) {
            console.info("[player] background refresh completed", {
              slug: cacheKey
            });
          }
        } catch (err) {
          if (!isProd) {
            console.info("[player] refresh skipped", err instanceof Error ? err.message : err);
          }
        }
      })();
    }

    setPlayerCache(cacheKey, payload);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "x-player-cache": bypassCache ? "BYPASS" : "MISS"
      }
    });
  } catch (error) {
    console.error("[api/player] failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
