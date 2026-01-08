import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .select("riot_id, region, slug")
    .eq("is_active", true)
    .or(`riot_id.ilike.%${query}%,slug.ilike.%${query}%`)
    .limit(8);

  if (error) {
    return NextResponse.json({ results: [] }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
