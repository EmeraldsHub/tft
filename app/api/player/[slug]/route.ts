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

  return NextResponse.json(payload);
}
