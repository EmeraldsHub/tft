export const dynamic = "force-dynamic";
export const runtime = "nodejs";


import { syncTrackedPlayerById } from "@/lib/riotData";
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
  try {
    const body = (await request.json()) as { id?: string };
    id = body?.id ?? null;
  } catch {
    const { searchParams } = new URL(request.url);
    id = searchParams.get("id");
  }
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    const result = await syncTrackedPlayerById(id, { force: true });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
}
