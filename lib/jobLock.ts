import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type JobLockResult =
  | { ok: true; lockedUntil: string }
  | { ok: false; lockedUntil: string | null };

export async function acquireJobLock(
  name: string,
  ttlMs: number
): Promise<JobLockResult> {
  const now = Date.now();
  const { data, error } = await supabaseAdmin
    .from("job_locks")
    .select("locked_until")
    .eq("name", name)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const lockedUntil = data?.locked_until ?? null;
  if (lockedUntil && new Date(lockedUntil).getTime() > now) {
    return { ok: false, lockedUntil };
  }

  const nextLockedUntil = new Date(now + ttlMs).toISOString();
  const { error: upsertError } = await supabaseAdmin
    .from("job_locks")
    .upsert({ name, locked_until: nextLockedUntil }, { onConflict: "name" });

  if (upsertError) {
    throw upsertError;
  }

  return { ok: true, lockedUntil: nextLockedUntil };
}

export async function releaseJobLock(name: string) {
  const { error } = await supabaseAdmin
    .from("job_locks")
    .update({ locked_until: new Date(0).toISOString() })
    .eq("name", name);

  if (error) {
    throw error;
  }
}
