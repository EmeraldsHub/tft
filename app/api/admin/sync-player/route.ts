export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { syncTrackedPlayerById } from "@/lib/riotData";

export async function POST(req: Request) {
  const body = (await req.json()) as { id?: string };
  const id = body?.id ?? null;

  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  await syncTrackedPlayerById(id);

  return NextResponse.json({ ok: true });
}
