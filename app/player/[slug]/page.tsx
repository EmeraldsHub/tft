export const dynamic = "force-dynamic";

import { PlayerSyncButton } from "@/components/PlayerSyncButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Stat } from "@/components/ui/Stat";
import { headers } from "next/headers";

interface PlayerPageProps {
  params: {
    slug: string;
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const headerList = headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const fallbackHost =
    process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const baseUrl = host
    ? `${protocol}://${host}`
    : fallbackHost
      ? `https://${fallbackHost.replace(/^https?:\/\//, "")}`
      : "";

  const payload = await fetch(
    `${baseUrl}/api/player/${encodeURIComponent(params.slug)}`,
    {
    cache: "no-store"
    }
  )
    .then(async (response) =>
      response.ok
        ? ((await response.json()) as {
        player: {
          id: string;
          riot_id: string;
          region: string;
          puuid: string | null;
          summoner_id?: string | null;
          profile_image_url?: string | null;
          avg_placement_updated_at?: string | null;
          riot_data_updated_at?: string | null;
        } | null;
        ranked: {
          tier: string;
          rank: string;
          leaguePoints: number;
        } | null;
        avgPlacement: number | null;
        live: {
          inGame: boolean;
          gameStartTime: number | null;
          participantCount: number | null;
        };
        recentMatches: Array<{
          matchId: string;
          placement: number | null;
          gameStartTime: number | null;
          gameDateTime: number | null;
        }>;
      })
        : {
        player: null,
        ranked: null,
        avgPlacement: null,
        live: { inGame: false, gameStartTime: null, participantCount: null },
        recentMatches: []
      }
    )
    .catch(() => ({
      player: null,
      ranked: null,
      avgPlacement: null,
      live: { inGame: false, gameStartTime: null, participantCount: null },
      recentMatches: []
    }));

  if (!payload.player) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-semibold text-white">Player not tracked</h1>
        <p className="text-slate-400">
          Questo profilo non è ancora disponibile.
        </p>
      </main>
    );
  }

  const player = payload.player;
  const rankedInfo = payload.ranked;
  const avgPlacement = payload.avgPlacement;
  const liveStatus = payload.live;

  const liveStart = liveStatus.inGame && liveStatus.gameStartTime
    ? new Date(liveStatus.gameStartTime).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  const lastUpdated =
    player.avg_placement_updated_at ?? player.riot_data_updated_at ?? null;
  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleString("it-IT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";

  const profileImageUrl = player.profile_image_url ?? null;

  const isSynced = Boolean(player.puuid && player.summoner_id);

  return (
    <main className="min-h-screen py-10">
      <Container className="space-y-8">
        <div className="flex flex-col gap-4">
          <SectionTitle title="Player Profile" />
          <div className="flex flex-wrap items-center gap-4">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={player.riot_id}
                className="h-16 w-16 rounded-full border border-slate-800 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-sm text-slate-500">
                —
              </div>
            )}
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-white">
                {player.riot_id}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="neutral">{player.region}</Badge>
                {liveStatus.inGame ? <Badge variant="green">Live</Badge> : null}
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Last updated: {lastUpdatedLabel}
          </p>
        </div>

        {!isSynced ? (
          <Card>
            <CardHeader>
              <CardTitle>Not synced yet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <p>
                Riot data is not available yet for this player. Run a sync to
                fetch ranked and match stats.
              </p>
              <PlayerSyncButton playerId={player.id} />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent>
                  <Stat
                    label="Avg placement (10)"
                    value={avgPlacement !== null ? avgPlacement.toFixed(2) : "—"}
                    helper={
                      avgPlacement !== null
                        ? "Lower is better."
                        : "Not enough matches yet."
                    }
                    accent="yellow"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Stat
                    label="Rank"
                    value={
                      rankedInfo
                        ? `${rankedInfo.tier} ${rankedInfo.rank} · ${rankedInfo.leaguePoints} LP`
                        : "Unranked / No ranked data"
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Stat
                    label="Matches analyzed"
                    value={payload.recentMatches.length}
                    helper="Last 10 matches."
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Stat label="Last updated" value={lastUpdatedLabel} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Live game</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300">
                {liveStatus.inGame ? (
                  <div className="space-y-2">
                    <p className="text-white">In game</p>
                    <p>Start: {liveStart ?? "—"}</p>
                    <p>Participants: {liveStatus.participantCount ?? "—"}</p>
                  </div>
                ) : (
                  <p>Not in game</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Last 10 matches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.recentMatches.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No match data available yet.
                  </p>
                ) : (
                  payload.recentMatches.map((match) => {
                    const placement = match.placement ?? null;
                    const shortId = match.matchId.slice(-6);
                    const timestamp = match.gameStartTime ?? match.gameDateTime;
                    const timeLabel = timestamp
                      ? new Date(timestamp).toLocaleString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : "—";

                    return (
                      <div
                        key={match.matchId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-semibold text-white">
                            {placement ?? "—"}
                          </span>
                          <div className="text-xs text-slate-400">
                            Match {shortId} · {timeLabel}
                          </div>
                        </div>
                        {placement !== null && placement <= 4 ? (
                          <Badge variant="yellow">Top 4</Badge>
                        ) : (
                          <Badge variant="neutral">Result</Badge>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </main>
  );
}
