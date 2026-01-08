import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveRiotData } from "@/lib/riotData";
import { slugifyRiotId } from "@/lib/slugify";
import { NextResponse } from "next/server";

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

export async function GET(request: Request) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select(
      "id, riot_id, region, slug, is_active, created_at, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}

export async function POST(request: Request) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    riot_id?: string;
    region?: string;
  };

  if (!body.riot_id || !body.region) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const region = body.region.trim().toUpperCase();
  if (region !== "EUW1") {
    return NextResponse.json(
      { error: "Only EUW1 is supported for now." },
      { status: 400 }
    );
  }

  const slug = slugifyRiotId(body.riot_id, region);
  let puuid: string | null = null;
  let summonerId: string | null = null;
  let warning: string | null = null;

  try {
    const resolved = await resolveRiotData(body.riot_id);
    puuid = resolved.puuid;
    summonerId = resolved.summonerId;
  } catch (err) {
    warning = err instanceof Error ? err.message : "Riot sync failed.";
  }

  const riotDataUpdatedAt = puuid ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .insert({
      riot_id: body.riot_id,
      region,
      slug,
      puuid,
      summoner_id: summonerId,
      riot_data_updated_at: riotDataUpdatedAt
    })
    .select(
      "id, riot_id, region, slug, is_active, created_at, puuid, summoner_id, avg_placement_10, avg_placement_updated_at, riot_data_updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ result: data, warning });
}
