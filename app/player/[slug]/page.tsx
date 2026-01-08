import { ensureAveragePlacement, getLiveGameStatus, getRankedInfo, syncTrackedPlayerById } from "@/lib/riotData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

interface PlayerPageProps {
  params: {
    slug: string;
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { data } = await supabaseAdmin
    .from("tracked_players")
    .select(
      "id, riot_id, region, is_active, puuid, summoner_id, avg_placement_10, avg_placement_updated_at"
    )
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

  const player = data;

  const rankedInfo = player.summoner_id
    ? await getRankedInfo(player.summoner_id)
    : null;

  const avgPlacement = await ensureAveragePlacement(player);
  const liveStatus = await getLiveGameStatus(player.puuid);

  const liveStart = liveStatus.inGame && liveStatus.gameStartTime
    ? new Date(liveStatus.gameStartTime).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  async function handleRefresh(formData: FormData) {
    "use server";
    const id = formData.get("id");
    if (typeof id !== "string") {
      return;
    }
    await syncTrackedPlayerById(id);
    revalidatePath(`/player/${params.slug}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-8 py-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Profilo</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{player.riot_id}</h1>
        <p className="mt-2 text-sm text-slate-400">{player.region}</p>
      </div>

      {!player.puuid ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-6 py-5 text-slate-300">
          <p>Player tracked but Riot data not synced yet.</p>
          <form action={handleRefresh} className="mt-4 flex justify-center">
            <input type="hidden" name="id" value={player.id} />
            <button
              type="submit"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent"
            >
              Refresh
            </button>
          </form>
        </div>
      ) : (
        <div className="grid w-full max-w-3xl gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-left">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Ranked
            </p>
            {rankedInfo ? (
              <p className="mt-3 text-lg font-semibold text-white">
                {rankedInfo.tier} {rankedInfo.rank} · {rankedInfo.leaguePoints} LP
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Unranked</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-left">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Avg placement (10)
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              {avgPlacement !== null ? avgPlacement.toFixed(2) : "—"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Lower is better.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-left">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Live game
            </p>
            {liveStatus.inGame ? (
              <div className="mt-3 space-y-1 text-sm text-slate-200">
                <p className="font-semibold text-white">In game</p>
                {liveStart ? <p>Start: {liveStart}</p> : null}
                {liveStatus.participantCount ? (
                  <p>Players: {liveStatus.participantCount}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Not in game</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
