import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  const { data: startsWith, error: startsWithError } = await supabaseAdmin
    .from("tracked_players")
    .select("riot_id, region, slug")
    .eq("is_active", true)
    .ilike("riot_id", `${query}%`)
    .order("riot_id", { ascending: true })
    .limit(8);

  if (startsWithError) {
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }

  const remaining = Math.max(0, 8 - (startsWith?.length ?? 0));
  let contains: typeof startsWith = [];

  if (remaining > 0) {
    const { data: containsData, error: containsError } = await supabaseAdmin
      .from("tracked_players")
      .select("riot_id, region, slug")
      .eq("is_active", true)
      .ilike("riot_id", `%${query}%`)
      .order("riot_id", { ascending: true })
      .limit(remaining);

    if (containsError) {
      return NextResponse.json({ suggestions: [] }, { status: 500 });
    }

    contains = containsData ?? [];
  }

  const seen = new Set<string>();
  const suggestions = [...(startsWith ?? []), ...contains].filter((row) => {
    if (seen.has(row.slug)) {
      return false;
    }
    seen.add(row.slug);
    return true;
  });

  return NextResponse.json({ suggestions });
}
