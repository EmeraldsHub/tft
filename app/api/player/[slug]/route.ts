export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getPlayerProfileBySlug } from "@/lib/riotData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getChampionIconUrl,
  getItemIconUrl,
  getTftTraitIconUrl,
  sanitizeIconUrl
} from "@/lib/cdragonStatic";
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

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const payload = await getPlayerProfileBySlug(params.slug);

    if (
      payload.player &&
      payload.player.puuid &&
      payload.recentMatches.length > 0
    ) {
      const matchIds = payload.recentMatches.map((match) => match.matchId);
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

      const puuid = payload.player.puuid;
      payload.recentMatches = await Promise.all(
        payload.recentMatches.map(async (match) => {
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

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[api/player] failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
