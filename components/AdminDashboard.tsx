"use client";

import { useEffect, useState } from "react";

type TrackedPlayer = {
  id: string;
  riot_id: string;
  region: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  puuid: string | null;
  summoner_id: string | null;
  avg_placement_10: number | null;
  avg_placement_updated_at: string | null;
  riot_data_updated_at: string | null;
  profile_image_url: string | null;
};

type SyncResponse = {
  warning?: string | null;
  error?: string;
  statuses?: {
    ranked?: string;
    avgPlacement?: string;
    matchHistory?: string;
    leaderboard?: string;
    live?: string;
  };
};

export function AdminDashboard() {
  const [players, setPlayers] = useState<TrackedPlayer[]>([]);
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("EUW1");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [imageEdits, setImageEdits] = useState<Record<string, string>>({});

  const adminFetch = (input: RequestInfo, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" });

  const loadPlayers = async () => {
    try {
      const response = await adminFetch("/api/admin/tracked-players");
      if (!response.ok) {
        setStatus("Impossibile caricare i player.");
        return;
      }

      const data = (await response.json()) as { results: TrackedPlayer[] };
      setPlayers(data.results);
    } catch {
      setStatus("Impossibile caricare i player.");
    }
  };

  useEffect(() => {
    void loadPlayers();
  }, []);

  const handleAddPlayer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const trimmedImageUrl = profileImageUrl.trim();
    try {
      const response = await adminFetch("/api/admin/tracked-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riot_id: riotId,
          region,
          profile_image_url: trimmedImageUrl || null
        })
      });

      const data = (await response.json()) as {
        result?: TrackedPlayer;
        warning?: string | null;
        error?: string;
      };

      if (!response.ok) {
        setStatus(data.error ?? "Errore durante l'aggiunta.");
        return;
      }

      setRiotId("");
      setRegion("EUW1");
      setProfileImageUrl("");
      if (data.warning) {
        setStatus(`Player aggiunto. Sync Riot fallita: ${data.warning}`);
      } else {
        setStatus("Player aggiunto.");
      }
      await loadPlayers();
    } catch {
      setStatus("Errore durante l'aggiunta.");
    }
  };

  const togglePlayer = async (player: TrackedPlayer) => {
    try {
      const response = await adminFetch(`/api/admin/tracked-players/${player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !player.is_active })
      });

      if (!response.ok) {
        setStatus("Errore durante l'aggiornamento.");
        return;
      }

      await loadPlayers();
    } catch {
      setStatus("Errore durante l'aggiornamento.");
    }
  };

  const invalidateLeaderboardCache = async () => {
    await adminFetch("/api/admin/invalidate-cache", { method: "POST" });
  };

  const deletePlayer = async (player: TrackedPlayer) => {
    try {
      const response = await adminFetch(`/api/admin/tracked-players/${player.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        setStatus("Errore durante l'eliminazione.");
        return;
      }

      await invalidateLeaderboardCache();
      await loadPlayers();
    } catch {
      setStatus("Errore durante l'eliminazione.");
    }
  };

  const syncPlayer = async (player: TrackedPlayer) => {
    setStatus("Sync in corso...");
    try {
      const response = await adminFetch("/api/admin/sync-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: player.id })
      });

      const data = (await response.json()) as SyncResponse;

      if (!response.ok) {
        setStatus(data.error ?? "Errore durante il sync.");
        return;
      }

      const statusParts: string[] = [];
      if (data.statuses?.ranked) {
        statusParts.push(`Ranked: ${data.statuses.ranked}`);
      }
      if (data.statuses?.avgPlacement) {
        statusParts.push(`Avg: ${data.statuses.avgPlacement}`);
      }
      if (data.statuses?.live) {
        statusParts.push(`Live: ${data.statuses.live}`);
      }
      const statusDetail = statusParts.length > 0 ? ` (${statusParts.join(", ")})` : "";
      if (data.warning) {
        setStatus(`Sync completato con avviso: ${data.warning}${statusDetail}`);
      } else {
        setStatus(`Sync completato.${statusDetail}`);
      }
      await loadPlayers();
    } catch {
      setStatus("Errore durante il sync.");
    }
  };

  const batchSync = async () => {
    setStatus("Sync batch in corso...");
    try {
      const response = await adminFetch("/api/admin/sync-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 })
      });

      const data = (await response.json()) as {
        total?: number;
        results?: Array<{
          id: string;
          riot_id: string;
          status: string;
          warning?: string | null;
        }>;
        error?: string;
      };

      if (!response.ok) {
        setStatus(data.error ?? "Errore durante il sync.");
        return;
      }

      const warnings =
        data.results?.filter((entry) => entry.warning).length ?? 0;
      setStatus(
        `Sync batch completato: ${data.total ?? 0} player processati${
          warnings ? `, avvisi: ${warnings}` : ""
        }.`
      );
      await loadPlayers();
    } catch {
      setStatus("Errore durante il sync.");
    }
  };

  const syncAllPlayers = async () => {
    const limit = players.length;
    if (limit === 0) {
      setStatus("Nessun player da sincronizzare.");
      return;
    }

    setStatus("Sync completo in corso...");
    try {
      const response = await adminFetch("/api/admin/sync-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit })
      });

      const data = (await response.json()) as {
        total?: number;
        results?: Array<{
          id: string;
          riot_id: string;
          status: string;
          warning?: string | null;
        }>;
        error?: string;
      };

      if (!response.ok) {
        setStatus(data.error ?? "Errore durante il sync.");
        return;
      }

      const leaderboardResponse = await adminFetch("/api/admin/sync-leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concurrency: 5 })
      });
      const leaderboardData = (await leaderboardResponse.json()) as {
        total?: number;
        error?: string;
      };
      if (!leaderboardResponse.ok) {
        setStatus(
          leaderboardData.error ?? "Errore durante il sync leaderboard."
        );
        return;
      }

      const warnings =
        data.results?.filter((entry) => entry.warning).length ?? 0;
      setStatus(
        `Sync completo: ${data.total ?? limit} player + leaderboard (${leaderboardData.total ?? 0})${
          warnings ? `, avvisi: ${warnings}` : ""
        }.`
      );
      await loadPlayers();
    } catch {
      setStatus("Errore durante il sync.");
    }
  };

  const syncLeaderboard = async () => {
    setStatus("Leaderboard sync in corso...");
    try {
      const response = await adminFetch("/api/admin/sync-leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concurrency: 5 })
      });

      const data = (await response.json()) as {
        total?: number;
        results?: Array<{ id: string; riot_id: string; status: string }>;
        error?: string;
      };

      if (!response.ok) {
        setStatus(data.error ?? "Errore durante il sync leaderboard.");
        return;
      }

      setStatus(`Leaderboard sync completato: ${data.total ?? 0} player.`);
      await loadPlayers();
    } catch {
      setStatus("Errore durante il sync leaderboard.");
    }
  };

  const saveProfileImage = async (player: TrackedPlayer) => {
    const nextUrl = (imageEdits[player.id] ?? player.profile_image_url ?? "").trim();
    try {
      const response = await adminFetch(`/api/admin/tracked-players/${player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_image_url: nextUrl || null })
      });

      if (!response.ok) {
        setStatus("Errore durante il salvataggio immagine.");
        return;
      }

      setStatus("Immagine aggiornata.");
      await invalidateLeaderboardCache();
      await loadPlayers();
    } catch {
      setStatus("Errore durante il salvataggio immagine.");
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) {
      return "—";
    }
    return new Date(value).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white">Aggiungi player</h2>
        <form onSubmit={handleAddPlayer} className="mt-4 grid gap-4 md:grid-cols-4">
          <input
            value={riotId}
            onChange={(event) => setRiotId(event.target.value)}
            placeholder="Riot ID (nome#TAG)"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-tft-accent focus:ring-2 focus:ring-tft-accent/40"
            required
          />
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-tft-accent focus:ring-2 focus:ring-tft-accent/40"
            required
          >
            <option value="EUW1">EUW1</option>
          </select>
          <input
            value={profileImageUrl}
            onChange={(event) => setProfileImageUrl(event.target.value)}
            placeholder="Profile image URL (optional)"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-tft-accent focus:ring-2 focus:ring-tft-accent/40"
          />
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-tft-accent to-tft-accent-strong px-6 py-3 text-base font-semibold text-slate-900 shadow-glow transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tft-accent"
          >
            Salva
          </button>
        </form>
        {status ? <p className="mt-3 text-sm text-rose-400">{status}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white">Player tracciati</h2>
        {status ? <p className="mt-2 text-sm text-rose-400">{status}</p> : null}
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={batchSync}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent"
          >
            Batch sync
          </button>
          <button
            type="button"
            onClick={syncAllPlayers}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent"
          >
            Sync all
          </button>
          <button
            type="button"
            onClick={syncLeaderboard}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent"
          >
            Sync leaderboard
          </button>
          {players.length === 0 ? (
            <p className="text-sm text-slate-400">Nessun player inserito.</p>
          ) : (
            players.map((player) => (
              <div
                key={player.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {player.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.profile_image_url}
                      alt={player.riot_id}
                      className="h-12 w-12 rounded-full border border-slate-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs text-slate-400">
                      —
                    </div>
                  )}
                  <div>
                  <p className="text-sm font-semibold text-white">{player.riot_id}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    {player.region} · {player.slug}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Riot sync: {player.puuid ? "OK" : "Pending"} · Ultimo sync:{" "}
                    {formatDate(player.riot_data_updated_at)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Avg placement:{" "}
                    {player.avg_placement_10 !== null
                      ? player.avg_placement_10.toFixed(2)
                      : "—"}{" "}
                    · Aggiornato: {formatDate(player.avg_placement_updated_at)}
                  </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={imageEdits[player.id] ?? player.profile_image_url ?? ""}
                    onChange={(event) =>
                      setImageEdits((prev) => ({
                        ...prev,
                        [player.id]: event.target.value
                      }))
                    }
                    placeholder="Profile image URL"
                    className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-tft-accent focus:ring-2 focus:ring-tft-accent/40"
                  />
                  <button
                    type="button"
                    onClick={() => saveProfileImage(player)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => syncPlayer(player)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent"
                  >
                    Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePlayer(player)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent"
                  >
                    {player.is_active ? "Disattiva" : "Attiva"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePlayer(player)}
                    className="rounded-lg border border-rose-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
