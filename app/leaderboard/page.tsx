export const dynamic = "force-dynamic";

import Link from "next/link";
import { headers } from "next/headers";
import { RankIcon } from "@/components/RankIcon";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default async function LeaderboardPage() {
  const headerList = headers();
  const host = headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const fallbackHost =
    process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const baseUrl = host
    ? `${protocol}://${host}`
    : fallbackHost
      ? `https://${fallbackHost.replace(/^https?:\/\//, "")}`
      : "";

  const sorted = await fetch(`${baseUrl}/api/leaderboard`, {
    cache: "no-store"
  })
    .then(async (response) =>
      response.ok
        ? ((await response.json()) as {
            results: Array<{
              id: string;
              riot_id: string;
              slug: string;
              avgPlacement: number | null;
              live: { inGame: boolean };
              ranked: {
                tier: string;
                rank: string;
                leaguePoints: number;
              } | null;
              rankIconUrl: string | null;
            }>;
          }).results ?? []
        : []
    )
    .catch(() => []);

  const formatTier = (
    tier: string | null | undefined,
    rank: string | null | undefined
  ) => {
    if (!tier) {
      return "Unranked";
    }
    return rank ? `${tier} ${rank}` : tier;
  };

  return (
    <main className="min-h-screen py-10">
      <Container className="space-y-8">
        <SectionTitle
          title="Leaderboard"
          description="Best average placement over the last 10 matches."
        />

        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-12 gap-4 text-xs uppercase tracking-[0.3em] text-slate-500">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Player</span>
              <span className="col-span-3">Tier</span>
              <span className="col-span-2">LP</span>
              <span className="col-span-1">Status</span>
            </div>
            <div className="divide-y divide-slate-800">
              {sorted.length === 0 ? (
                <div className="py-4 text-sm text-slate-400">
                  Nessun player sincronizzato.
                </div>
              ) : (
                sorted.map((player, index) => (
                  <div
                    key={player.id}
                    className="grid grid-cols-12 items-center gap-4 py-4 text-sm"
                  >
                    <span className="col-span-1 text-slate-400">
                      {index + 1}
                    </span>
                    <div className="col-span-5 flex items-center gap-3">
                      <RankIcon tier={player.ranked?.tier} size={18} />
                      <Link
                        href={`/player/${player.slug}`}
                        className="font-semibold text-white transition hover:text-yellow-300"
                      >
                        {player.riot_id}
                      </Link>
                    </div>
                    <span className="col-span-3 text-slate-200">
                      {formatTier(player.ranked?.tier, player.ranked?.rank)}
                    </span>
                    <span className="col-span-2 text-slate-200">
                      {player.ranked?.leaguePoints ?? "—"}
                    </span>
                    <div className="col-span-1">
                      {player.live.inGame ? (
                        <Badge variant="green">Live</Badge>
                      ) : (
                        <Badge variant="neutral">Offline</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </Container>
    </main>
  );
}
