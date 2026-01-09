export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getPlayerProfileBySlug } from "@/lib/riotData";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  console.log("[riot] RIOT_API_KEY present?", Boolean(process.env.RIOT_API_KEY));
  const payload = await getPlayerProfileBySlug(params.slug);
  return NextResponse.json(payload);
}
