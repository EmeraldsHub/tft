export const dynamic = "force-dynamic";

import Link from "next/link";
import { headers } from "next/headers";

export default async function LeaderboardPage() {
  const headerList = headers();
  const host = headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${protocol}://${host}` : "";

  const response = await fetch(`${baseUrl}/api/leaderboard`, {
    cache: "no-store"
  });
  const payload = response.ok
    ? ((await response.json()) as {
        results: Array<{
          id: string;
          riot_id: string;
          slug: string;
          avgPlacement: number | null;
          live: { inGame: boolean };
        }>;
      })
    : { results: [] };

  const sorted = payload.results ?? [];

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
                    {player.avgPlacement !== null
                      ? player.avgPlacement.toFixed(2)
                      : "—"}
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
