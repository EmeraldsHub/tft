export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { invalidateLeaderboardCache } from "@/lib/leaderboardCache";
import { invalidateAllPlayerCache, invalidatePlayerCache } from "@/lib/playerCache";
import { syncTrackedPlayerById } from "@/lib/riotData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

export async function POST(request: Request) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[riot] RIOT_API_KEY present?", Boolean(process.env.RIOT_API_KEY));

  let id: string | null = null;
  let slug: string | null = null;
  try {
    const body = (await request.json()) as { id?: string; slug?: string };
    id = body?.id ?? null;
    slug = body?.slug ?? null;
  } catch {
    const { searchParams } = new URL(request.url);
    id = searchParams.get("id");
    slug = searchParams.get("slug");
  }
  if (!id && !slug) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    let targetId = id;
    let playerRow:
      | {
          id: string;
          slug: string | null;
        }
      | null = null;

    if (targetId) {
      const { data } = await supabaseAdmin
        .from("tracked_players")
        .select("id, slug")
        .eq("id", targetId)
        .maybeSingle();
      playerRow = data ?? null;
    }

    if (!playerRow && slug) {
      const { data } = await supabaseAdmin
        .from("tracked_players")
        .select("id, slug")
        .eq("slug", slug)
        .maybeSingle();
      playerRow = data ?? null;
      targetId = playerRow?.id ?? null;
    }

    if (!targetId) {
      return NextResponse.json(
        { updated: false, warning: "Tracked player not found." },
        { status: 200 }
      );
    }

    const result = await syncTrackedPlayerById(targetId, { force: true });
    invalidateLeaderboardCache();
    if (playerRow?.slug) {
      invalidatePlayerCache(playerRow.slug);
    } else {
      invalidateAllPlayerCache();
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
}
