export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { PlayerSyncButton } from "@/components/PlayerSyncButton";
import { RankIcon } from "@/components/RankIcon";
import { MatchHistoryAccordion } from "@/components/MatchHistoryAccordion";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Stat } from "@/components/ui/Stat";
import Image from "next/image";
import { headers } from "next/headers";

interface PlayerPageProps {
  params: {
    slug: string;
  };
  searchParams?: {
    refresh?: string;
  };
}

export default async function PlayerPage({
  params,
  searchParams
}: PlayerPageProps) {
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

  const refreshQuery = searchParams?.refresh === "1" ? "?refresh=1" : "";
  const payload = await fetch(
    `${baseUrl}/api/player/${encodeURIComponent(params.slug)}${refreshQuery}`,
    {
      cache: "no-store",
      headers: refreshQuery ? { "x-bypass-cache": "1" } : undefined
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
        rankIconUrl: string | null;
        rankedQueue: string | null;
        avgPlacement: number | null;
        live: {
          inGame: boolean;
          gameStartTime: number | null;
          participantCount: number | null;
        };
        favoriteUnit: {
          characterId: string;
          champIconUrl: string | null;
          count: number;
        } | null;
        favoriteItems: Array<{
          itemName: string;
          itemIconUrl: string | null;
          count: number;
        }>;
        favoriteTraits: Array<{
          name: string;
          iconUrl: string | null;
          count: number;
        }>;
            recentMatches: Array<{
              matchId: string;
              placement: number | null;
              gameStartTime: number | null;
              gameDateTime: number | null;
              preview?: {
                placement: number | null;
                units: Array<{
                  character_id: string;
                  tier: number;
                  itemNames: string[];
                  champIconUrl: string | null;
                  itemIconUrls: Array<string | null>;
                }>;
                traits: Array<{
                  name: string;
                  num_units: number;
                  style: number;
                  tier_current: number;
                  tier_total: number;
                }>;
                riotIdGameName?: string | null;
                riotIdTagline?: string | null;
              } | null;
            }>;
          })
        : {
        player: null,
        ranked: null,
        avgPlacement: null,
        live: { inGame: false, gameStartTime: null, participantCount: null },
        recentMatches: [],
        rankIconUrl: null,
        rankedQueue: null,
        favoriteUnit: null,
        favoriteItems: [],
        favoriteTraits: []
      }
    )
    .catch(() => ({
      player: null,
      ranked: null,
      avgPlacement: null,
      live: { inGame: false, gameStartTime: null, participantCount: null },
      recentMatches: [],
      favoriteUnit: null,
      favoriteItems: [],
      favoriteTraits: []
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
  const favoriteUnit = payload.favoriteUnit;
  const favoriteItems = payload.favoriteItems ?? [];
  const favoriteTraits = payload.favoriteTraits ?? [];
  const formatTraitLabel = (name: string) =>
    name
      .replace(/^tft\d+[^a-z0-9]*/i, "")
      .replace(/^tft[^a-z0-9]*/i, "")
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim();
  const favoriteUnitLabel = favoriteUnit?.characterId
    ? favoriteUnit.characterId
        .replace(/^tft/i, "")
        .replace(/^[^a-z]+/i, "")
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim()
    : null;

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

  const hasPuuid = Boolean(player.puuid);

  return (
    <main className="min-h-screen py-10">
      <Container className="space-y-8">
        <div className="flex flex-col gap-4">
          <SectionTitle title="Player Profile" />
          <div className="flex flex-wrap items-center gap-4">
            {profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
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
                <PlayerSyncButton
                  playerId={player.id}
                  className="flex items-center gap-2"
                />
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Last updated: {lastUpdatedLabel}
          </p>
        </div>

        {!hasPuuid ? (
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
                    helper={
                      rankedInfo
                        ? undefined
                        : "No ranked TFT data found. Play ranked to appear."
                    }
                  />
                  {rankedInfo ? (
                    <div className="mt-3">
                      <RankIcon tier={rankedInfo.tier} size={20} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Stat
                    label="Favorite unit"
                    value={favoriteUnitLabel ?? "—"}
                    helper={
                      favoriteUnit
                        ? `Most played in last 10 ranked matches (${favoriteUnit.count}x).`
                        : "Not enough ranked match data yet."
                    }
                  />
                  {favoriteUnit?.champIconUrl ? (
                    <div className="mt-3 flex items-center">
                      <Image
                        src={favoriteUnit.champIconUrl}
                        alt={favoriteUnit.characterId}
                        width={48}
                        height={48}
                        className="rounded border border-slate-800 bg-slate-950"
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Stat
                    label="Favorite items"
                    value={favoriteItems.length > 0 ? "Top 3 items" : "—"}
                    helper={
                      favoriteItems.length > 0
                        ? "Most played in last 10 ranked matches."
                        : "Not enough ranked match data yet."
                    }
                  />
                  {favoriteItems.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {favoriteItems.map((item) =>
                        item.itemIconUrl ? (
                          <div key={item.itemName} className="flex items-center gap-1">
                            <Image
                              src={item.itemIconUrl}
                              alt={item.itemName}
                              title={item.itemName}
                              width={28}
                              height={28}
                              className="rounded border border-slate-800 bg-slate-950"
                            />
                            <span className="text-xs text-slate-400">
                              {item.count}x
                            </span>
                          </div>
                        ) : null
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Favorite traits</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300">
                {favoriteTraits.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {favoriteTraits.map((trait) =>
                      trait.iconUrl ? (
                        <div key={trait.name} className="flex items-center gap-2">
                          <Image
                            src={trait.iconUrl}
                            alt={trait.name}
                            title={trait.name}
                            width={24}
                            height={24}
                            className="rounded border border-slate-800 bg-slate-950"
                          />
                          <span className="text-xs text-slate-300">
                            {formatTraitLabel(trait.name)}
                          </span>
                        </div>
                      ) : (
                        <span key={trait.name} className="text-xs text-slate-400">
                          {formatTraitLabel(trait.name)}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <p>Not enough ranked match data yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Match history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.recentMatches.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No match data available yet.
                  </p>
                ) : (
                  <MatchHistoryAccordion
                    matches={payload.recentMatches.map((match) => ({
                      matchId: match.matchId,
                      placement: match.placement ?? null,
                      gameDateTime: match.gameDateTime ?? match.gameStartTime ?? null,
                      preview: match.preview ?? null
                    }))}
                    playerPuuid={player.puuid ?? null}
                    playerRiotId={player.riot_id}
                    playerRegion={player.region}
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </main>
  );
}
