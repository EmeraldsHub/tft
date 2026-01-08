import { ensureAveragePlacement, getLiveGameStatus } from "@/lib/riotData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LeaderboardRow = {
  id: string;
  riot_id: string;
  slug: string;
  puuid: string | null;
  avg_placement_10: number | null;
  avg_placement_updated_at: string | null;
};

export default async function LeaderboardPage() {
  const { data } = await supabaseAdmin
    .from("tracked_players")
    .select(
      "id, riot_id, slug, is_active, puuid, avg_placement_10, avg_placement_updated_at"
    )
    .eq("is_active", true)
    .not("puuid", "is", null);

  const players = (data ?? []) as LeaderboardRow[];

  const enriched = await Promise.all(
    players.map(async (player) => {
      const avg = await ensureAveragePlacement(player);
      const live = await getLiveGameStatus(player.puuid);
      return { ...player, avg, live };
    })
  );

  const sorted = enriched.sort((a, b) => {
    if (a.avg === null && b.avg === null) return 0;
    if (a.avg === null) return 1;
    if (b.avg === null) return -1;
    return a.avg - b.avg;
  });

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
            Leaderboard
          </p>
          <h1 className="text-3xl font-semibold text-white">
            Best average placement (last 10)
          </h1>
          <p className="text-slate-400">
            EUW-only MVP. Average placement updates every 15 minutes.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="grid grid-cols-12 gap-4 border-b border-slate-800 px-6 py-4 text-xs uppercase tracking-[0.3em] text-slate-500">
            <span className="col-span-2">Rank</span>
            <span className="col-span-6">Player</span>
            <span className="col-span-2">Avg</span>
            <span className="col-span-2">Status</span>
          </div>
          <div className="divide-y divide-slate-800">
            {sorted.length === 0 ? (
              <div className="px-6 py-6 text-sm text-slate-400">
                Nessun player sincronizzato.
              </div>
            ) : (
              sorted.map((player, index) => (
                <div
                  key={player.id}
                  className="grid grid-cols-12 items-center gap-4 px-6 py-4 text-sm"
                >
                  <span className="col-span-2 text-slate-400">
                    #{index + 1}
                  </span>
                  <div className="col-span-6">
                    <Link
                      href={`/player/${player.slug}`}
                      className="font-semibold text-white transition hover:text-tft-accent"
                    >
                      {player.riot_id}
                    </Link>
                  </div>
                  <span className="col-span-2 text-slate-200">
                    {player.avg !== null ? player.avg.toFixed(2) : "—"}
                  </span>
                  <span className="col-span-2 text-slate-400">
                    {player.live.inGame ? "In game" : "Offline"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
