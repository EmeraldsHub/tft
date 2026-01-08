export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

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
  };

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("tracked_players")
    .update({ is_active: body.is_active })
    .eq("id", params.id)
    .select("id, riot_id, region, slug, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ result: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("tracked_players")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
