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
  needsRankedRefresh?: boolean;
  needsMatchesRefresh?: boolean;
  needsProfileRefresh?: boolean;
};

const UNKNOWN_UNIT_ICON = "/icons/unknown-unit.png";

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

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const cached = getPlayerCache<PlayerResponse>(slug);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
          "x-player-cache": "HIT"
        }
      });
    }

    const startedAt = Date.now();
    const dbStart = Date.now();
    const player = await getTrackedPlayerBySlug(slug);
    const dbMs = Date.now() - dbStart;

    if (!player || !player.is_active) {
      const empty: PlayerResponse = {
        player: null,
        ranked: null,
        rankIconUrl: null,
        rankedQueue: null,
        avgPlacement: null,
        live: { inGame: false, gameStartTime: null, participantCount: null },
        recentMatches: []
      };
      setPlayerCache(slug, empty);
      return NextResponse.json(empty, {
        headers: { "Cache-Control": "private, max-age=0, must-revalidate" }
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
      rankIconUrl: ranked ? getRankIconUrl(ranked.tier) : null,
      rankedQueue: player.ranked_queue ?? null,
      avgPlacement,
      live,
      recentMatches,
      needsRankedRefresh: ranked === null,
      needsMatchesRefresh: recentMatches.length === 0,
      needsProfileRefresh: !player.puuid
    };

    if (player.puuid && recentMatches.length > 0) {
      const matchIds = recentMatches.map((match) => match.matchId);
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
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[player] slug=%s db=%dms total=%dms",
        slug,
        dbMs,
        Date.now() - startedAt
      );
    }

    const shouldRefresh =
      payload.needsRankedRefresh ||
      payload.needsMatchesRefresh ||
      payload.needsProfileRefresh;
    if (shouldRefresh && shouldTriggerPlayerRefresh(slug, 5 * 60_000)) {
      void (async () => {
        try {
          await syncTrackedPlayerById(player.id, { force: true });
          invalidatePlayerCache(slug);
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.info("[player] refresh skipped", err instanceof Error ? err.message : err);
          }
        }
      })();
    }

    setPlayerCache(slug, payload);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "x-player-cache": "MISS"
      }
    });
  } catch (error) {
    console.error("[api/player] failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
