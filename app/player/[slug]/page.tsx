import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface PlayerPageProps {
  params: {
    slug: string;
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { data } = await supabaseAdmin
    .from("tracked_players")
    .select("riot_id, region, is_active")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!data || !data.is_active) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-semibold text-white">Player not tracked</h1>
        <p className="text-slate-400">
          Questo profilo non è ancora disponibile.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-8 py-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Profilo</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{data.riot_id}</h1>
        <p className="mt-2 text-sm text-slate-400">{data.region}</p>
      </div>
      <div className="space-y-2 text-slate-400">
        <p>Rank coming soon</p>
        <p>Match history coming soon</p>
      </div>
    </main>
  );
}
