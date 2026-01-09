import Link from "next/link";
import { headers } from "next/headers";
import { RankIcon } from "@/components/RankIcon";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

type LeaderboardPreviewRow = {
  id: string;
  riot_id: string;
  slug: string;
  avgPlacement: number | null;
  ranked: { tier: string; rank: string; leaguePoints: number } | null;
};

function formatTier(
  tier: string | null | undefined,
  rank: string | null | undefined
) {
  if (!tier) {
    return "Unranked";
  }
  return rank ? `${tier} ${rank}` : tier;
}

export async function LeaderboardSection() {
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

  const topTen = await fetch(`${baseUrl}/api/leaderboard`, {
    cache: "no-store"
  })
    .then(async (response) =>
      response.ok
        ? ((await response.json()) as { results: LeaderboardPreviewRow[] })
            .results ?? []
        : []
    )
    .then((rows) => rows.slice(0, 10))
    .catch(() => []);

  return (
    <section className="py-12">
      <Container className="space-y-8">
        <SectionTitle
          title="Top 10"
          description="Top 10 player italiani."
        />
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-12 gap-4 text-xs uppercase tracking-[0.3em] text-slate-500">
              <span className="col-span-1">#</span>
              <span className="col-span-6">Player</span>
              <span className="col-span-3">Tier</span>
              <span className="col-span-2 text-right">LP</span>
            </div>
            <div className="divide-y divide-slate-800">
              {topTen.length === 0 ? (
                <div className="py-4 text-sm text-slate-400">
                  Nessun player sincronizzato.
                </div>
              ) : (
                topTen.map((player, index) => (
                  <Link
                    key={player.id}
                    href={`/player/${player.slug}`}
                    className="grid grid-cols-12 items-center gap-4 py-4 text-sm transition hover:bg-slate-950/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400/60"
                  >
                    <span className="col-span-1 text-slate-400">
                      {index + 1}
                    </span>
                    <span className="col-span-6 flex items-center gap-2 font-semibold text-white">
                      <RankIcon tier={player.ranked?.tier} size={18} />
                      {player.riot_id}
                    </span>
                    <span className="col-span-3 text-slate-200">
                      {formatTier(player.ranked?.tier, player.ranked?.rank)}
                    </span>
                    <span className="col-span-2 text-right text-slate-200">
                      {player.ranked?.leaguePoints ?? "—"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Link
          href="/leaderboard"
          className="inline-flex items-center rounded-full border border-slate-700 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-yellow-400 hover:text-yellow-300"
        >
          View leaderboard
        </Link>
      </Container>
    </section>
  );
}
