export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createTrackedPlayer, listTrackedPlayers } from "@/lib/riotData";
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

  try {
    const data = await listTrackedPlayers();
    return NextResponse.json({ results: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load players." },
      { status: 500 }
    );
  }
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
  try {
    const { result, warning } = await createTrackedPlayer({
      riotId: body.riot_id,
      region,
      slug
    });
    return NextResponse.json({ result, warning });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create player." },
      { status: 500 }
    );
  }
}
