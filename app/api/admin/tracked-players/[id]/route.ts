export const dynamic = "force-dynamic";

import { deleteTrackedPlayer, updateTrackedPlayer } from "@/lib/riotData";
import { NextResponse } from "next/server";

function clearLeaderboardCache() {
  if (typeof globalThis !== "undefined") {
    // eslint-disable-next-line no-underscore-dangle
    (globalThis as typeof globalThis & { __leaderboardCache?: unknown })
      .__leaderboardCache = undefined;
  }
}

function ensureAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("admin_session=authenticated");
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    is_active?: boolean;
    profile_image_url?: string | null;
  };

  try {
    const result = await updateTrackedPlayer(params.id, body);
    clearLeaderboardCache();
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteTrackedPlayer(params.id);
    clearLeaderboardCache();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
