"use client";

import { useEffect, useMemo, useState } from "react";
import { TftIcon } from "@/components/TftIcon";

type MatchPreview = {
  matchId: string;
  placement?: number | null;
  gameDateTime?: number | null;
  preview?: PlayerPreview | null;
};

type MatchParticipantUnit = {
  character_id?: string | null;
  tier?: number | null;
  itemNames?: string[] | null;
  champIconUrl?: string | null;
  itemIconUrls?: Array<string | null> | null;
};

type MatchParticipant = {
  placement?: number | null;
  puuid?: string | null;
  riotIdGameName?: string | null;
  riotIdTagline?: string | null;
  units?: MatchParticipantUnit[] | null;
};

type MatchDetailResponse = {
  matchId: string;
  cached: boolean;
  gameDateTime: number | null;
  gameDatetimeISO: string | null;
  queueId: number | null;
  participants: MatchParticipant[];
};

type PlayerPreview = {
  placement: number | null;
  level?: number | null;
  units: Array<{
    character_id: string;
    tier: number;
    itemNames: string[];
    champIconUrl: string | null;
    itemIconUrls: Array<string | null>;
  }>;
  topTraits?: Array<{
    name: string;
    num_units: number;
    style: number;
    iconUrl: string | null;
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
};

type MatchPreviewsResponse = {
  previews: Record<string, PlayerPreview | null>;
  error?: string;
};

type MatchHistoryAccordionProps = {
  matches: MatchPreview[];
  playerPuuid: string | null;
  playerRiotId: string;
  playerRegion: string;
};

function formatPlayerName(participant: MatchParticipant) {
  const gameName = participant.riotIdGameName?.trim() ?? "";
  const tagLine = participant.riotIdTagline?.trim() ?? "";
  if (gameName && tagLine) {
    return `${gameName}#${tagLine}`;
  }
  if (gameName) {
    return gameName;
  }
  if (participant.puuid) {
    return participant.puuid.slice(0, 8);
  }
  return "Unknown";
}

function formatMatchTime(ms: number | null | undefined) {
  if (!ms) {
    return "—";
  }
  return new Date(ms).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isSameRiotId(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function UnitTile({ unit }: { unit: MatchParticipantUnit }) {
  const characterId = unit.character_id?.trim() ?? "";
  const itemNames = Array.isArray(unit.itemNames) ? unit.itemNames : [];
  const itemIconUrls = Array.isArray(unit.itemIconUrls)
    ? unit.itemIconUrls
    : [];
  const tier = unit.tier ?? 0;
  const champIconUrl = unit.champIconUrl ?? null;
  const champSize = 48;
  const itemSize = 16;

  if (!characterId || !champIconUrl) {
    return null;
  }

  return (
    <div className="relative" style={{ width: champSize, height: champSize }}>
      <TftIcon
        src={champIconUrl}
        alt={characterId}
        width={champSize}
        height={champSize}
        className="rounded border border-slate-800 bg-slate-900"
      />
      {tier > 1 ? (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-900 px-1 text-[11px] text-yellow-300">
          {tier}
        </span>
      ) : null}
      <div className="absolute -top-2 left-0 right-0 flex justify-center gap-0.5">
        {itemIconUrls.slice(0, 3).map((itemUrl, index) => {
          if (!itemUrl) {
            return null;
          }
          const itemName = itemNames[index] ?? itemUrl;
          return (
            <TftIcon
              key={`${itemUrl}-${index}`}
              src={itemUrl}
              alt={itemName}
              width={itemSize}
              height={itemSize}
              className="rounded border border-slate-800 bg-slate-950"
            />
          );
        })}
      </div>
    </div>
  );
}

function UnitRow({ units }: { units: MatchParticipantUnit[] }) {
  if (!Array.isArray(units) || units.length === 0) {
    return <span className="text-xs text-slate-500">No units</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {units.map((unit, index) => (
        <UnitTile key={`${unit.character_id ?? "unit"}-${index}`} unit={unit} />
      ))}
    </div>
  );
}

export function MatchHistoryAccordion({
  matches,
  playerPuuid,
  playerRiotId,
  playerRegion
}: MatchHistoryAccordionProps) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, MatchDetailResponse>>({});
  const [previewMap, setPreviewMap] = useState<
    Record<string, PlayerPreview | null>
  >({});
  const [isMounted, setIsMounted] = useState(false);

  const sortedMatches = useMemo(
    () =>
      matches.slice(0, 10).sort((a, b) => {
        const aTime = a.gameDateTime ?? 0;
        const bTime = b.gameDateTime ?? 0;
        return bTime - aTime;
      }),
    [matches]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setPreviewMap((prev) => {
      const next = { ...prev };
      matches.forEach((match) => {
        if (
          match.preview &&
          !Object.prototype.hasOwnProperty.call(next, match.matchId)
        ) {
          next[match.matchId] = match.preview;
        }
      });
      return next;
    });
  }, [matches]);

  useEffect(() => {
    if (!playerPuuid) {
      return;
    }

    const needsPreviewRefresh = (preview: PlayerPreview | null | undefined) => {
      if (!preview) {
        return true;
      }
      const hasLevel = typeof preview.level === "number";
      const hasTopTraits =
        Array.isArray(preview.topTraits) && preview.topTraits.length > 0;
      return !hasLevel || !hasTopTraits;
    };

    const missingMatchIds = sortedMatches
      .filter((match) => {
        const currentPreview =
          previewMap[match.matchId] ?? match.preview ?? null;
        return needsPreviewRefresh(currentPreview);
      })
      .map((match) => match.matchId);

    if (missingMatchIds.length === 0) {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    const fetchPreviews = async () => {
      try {
        const response = await fetch("/api/match/previews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            matchIds: missingMatchIds,
            puuid: playerPuuid,
            region: playerRegion
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as MatchPreviewsResponse;
        if (!isActive) {
          return;
        }
        if (data.previews && Object.keys(data.previews).length > 0) {
          setPreviewMap((prev) => {
            const next = { ...prev };
            Object.entries(data.previews).forEach(([matchId, preview]) => {
              next[matchId] = preview ?? null;
            });
            return next;
          });
        }
      } catch {
        // Ignore prefetch failures; rows will still hydrate on expand.
      }
    };

    void fetchPreviews();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [playerPuuid, previewMap, sortedMatches, playerRegion]);

  const handleToggle = async (matchId: string) => {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      return;
    }

    setExpandedMatchId(matchId);

    if (cache[matchId]) {
      return;
    }

    setLoadingMatchId(matchId);
    try {
      const response = await fetch(`/api/match/${matchId}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as MatchDetailResponse;
      setCache((prev) => ({ ...prev, [matchId]: data }));
    } finally {
      setLoadingMatchId(null);
    }
  };

  const findCurrentParticipant = (
    detail: MatchDetailResponse | null
  ): MatchParticipant | null => {
    if (!detail) {
      return null;
    }
    const byPuuid = playerPuuid
      ? detail.participants.find(
          (participant) => participant.puuid === playerPuuid
        )
      : null;
    if (byPuuid) {
      return byPuuid;
    }
    return (
      detail.participants.find((participant) => {
        const name = formatPlayerName(participant);
        return name !== "Unknown" && isSameRiotId(name, playerRiotId);
      }) ?? null
    );
  };

  return (
    <div className="space-y-3">
      {sortedMatches.map((match) => {
        const detail = cache[match.matchId] ?? null;
        const currentParticipant = findCurrentParticipant(detail);
        const hasPrefetchedPreview = Object.prototype.hasOwnProperty.call(
          previewMap,
          match.matchId
        );
        const preview = hasPrefetchedPreview
          ? previewMap[match.matchId] ?? null
          : match.preview ?? null;
        const previewUnits = Array.isArray(preview?.units) ? preview.units : [];
        const previewLevel =
          typeof preview?.level === "number" ? preview.level : null;
        const topTraits = Array.isArray(preview?.topTraits)
          ? preview.topTraits.filter((trait) => Boolean(trait.iconUrl))
          : [];
        const units = previewUnits.length > 0
          ? previewUnits
          : currentParticipant?.units ?? [];
        const renderableUnits = Array.isArray(units)
          ? units.filter((unit) => unit.character_id && unit.champIconUrl)
          : [];
        const matchTime = detail?.gameDateTime ?? match.gameDateTime ?? null;
        const isExpanded = expandedMatchId === match.matchId;
        const placementValue =
          preview?.placement ?? match.placement ?? null;

        return (
          <div
            key={match.matchId}
            className="rounded-lg border border-slate-800 bg-slate-950"
          >
            <button
              type="button"
              onClick={() => void handleToggle(match.matchId)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-900/60"
            >
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold text-white">
                  #{placementValue ?? "—"}
                </span>
                <span className="text-xs text-slate-400">
                  {isMounted ? formatMatchTime(matchTime) : "—"}
                </span>
                <div className="flex items-center gap-2">
                  {previewLevel ? (
                    <span className="rounded-full border border-slate-800 px-2 py-0.5 text-xs text-slate-200">
                      Lv {previewLevel}
                    </span>
                  ) : null}
                  {topTraits.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {topTraits.map((trait, index) => (
                        <TftIcon
                          key={`${trait.name}-${index}`}
                          src={trait.iconUrl ?? ""}
                          alt={trait.name}
                          width={20}
                          height={20}
                          title={trait.name}
                          className="rounded border border-slate-800 bg-slate-950"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-1 items-center justify-end gap-2">
                {renderableUnits.length > 0 ? (
                  <UnitRow units={renderableUnits} />
                ) : detail ? (
                  <span className="text-xs text-slate-500">No units</span>
                ) : (
                  <span className="text-xs text-slate-500">
                    {loadingMatchId === match.matchId ? "Loading..." : "Details"}
                  </span>
                )}
              </div>
            </button>
            {isExpanded ? (
              <div className="border-t border-slate-800 px-4 py-4">
                {detail ? (
                  <div className="space-y-3">
                    {detail.participants.map((participant, index) => (
                      <div
                        key={`${detail.matchId}-${index}`}
                        className={`flex flex-wrap items-center gap-3 rounded-md border border-slate-800 px-3 py-2 ${
                          participant.puuid === playerPuuid
                            ? "bg-white/5 text-slate-100 ring-1 ring-cyan-400/40"
                            : "bg-slate-950"
                        }`}
                      >
                        <span className="w-8 text-sm font-semibold text-white">
                          #{participant.placement ?? "—"}
                        </span>
                        <span className="text-sm text-slate-200">
                          {formatPlayerName(participant)}
                        </span>
                        <div className="ml-auto">
                          <UnitRow units={participant.units ?? []} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Loading match...</p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
