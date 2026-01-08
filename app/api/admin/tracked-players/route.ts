import { supabaseAdmin } from "@/lib/supabaseAdmin";
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
    .select("id, riot_id, region, slug, is_active, created_at")
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

  const slug = slugifyRiotId(body.riot_id, body.region);
  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .insert({
      riot_id: body.riot_id,
      region: body.region,
      slug
    })
    .select("id, riot_id, region, slug, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ result: data });
}
