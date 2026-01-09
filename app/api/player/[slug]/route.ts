export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getPlayerProfileBySlug } from "@/lib/riotData";
import { NextResponse } from "next/server";

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const payload = await getPlayerProfileBySlug(params.slug);

  const {
    debugEnsuredSummonerId,
    debugEnsureSummonerIdError,
    ...publicPayload
  } = payload as {
    debugEnsuredSummonerId?: string | null;
    debugEnsureSummonerIdError?: string | null;
  };

  console.log(
    "[debug] ensuredSummonerId",
    debugEnsuredSummonerId ?? null,
    "hasKey",
    Boolean(process.env.RIOT_API_KEY)
  );

  if (!ensureAdmin(request)) {
    return NextResponse.json(publicPayload);
  }

  return NextResponse.json({
    ...publicPayload,
    debugEnsuredSummonerId: debugEnsuredSummonerId ?? null,
    debugHasRiotKey: Boolean(process.env.RIOT_API_KEY),
    debugEnsureSummonerIdError: debugEnsureSummonerIdError ?? null
  });
}
