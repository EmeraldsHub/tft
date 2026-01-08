"use client";

import { useEffect, useState } from "react";

type TrackedPlayer = {
  id: string;
  riot_id: string;
  region: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

export function AdminDashboard() {
  const [players, setPlayers] = useState<TrackedPlayer[]>([]);
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const loadPlayers = async () => {
    const response = await fetch("/api/admin/tracked-players");
    if (!response.ok) {
      setStatus("Impossibile caricare i player.");
      return;
    }

    const data = (await response.json()) as { results: TrackedPlayer[] };
    setPlayers(data.results);
  };

  useEffect(() => {
    void loadPlayers();
  }, []);

  const handleAddPlayer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const response = await fetch("/api/admin/tracked-players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riot_id: riotId, region })
    });

    if (!response.ok) {
      setStatus("Errore durante l'aggiunta.");
      return;
    }

    setRiotId("");
    setRegion("");
    await loadPlayers();
  };

  const togglePlayer = async (player: TrackedPlayer) => {
    const response = await fetch(`/api/admin/tracked-players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !player.is_active })
    });

    if (!response.ok) {
      setStatus("Errore durante l'aggiornamento.");
      return;
    }

    await loadPlayers();
  };

  const deletePlayer = async (player: TrackedPlayer) => {
    const response = await fetch(`/api/admin/tracked-players/${player.id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      setStatus("Errore durante l'eliminazione.");
      return;
    }

    await loadPlayers();
  };

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white">Aggiungi player</h2>
        <form onSubmit={handleAddPlayer} className="mt-4 grid gap-4 md:grid-cols-3">
          <input
            value={riotId}
            onChange={(event) => setRiotId(event.target.value)}
            placeholder="Riot ID (nome#TAG)"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-tft-accent focus:ring-2 focus:ring-tft-accent/40"
            required
          />
          <input
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="Region (EUW1)"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-tft-accent focus:ring-2 focus:ring-tft-accent/40"
            required
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
        <div className="mt-4 space-y-3">
          {players.length === 0 ? (
            <p className="text-sm text-slate-400">Nessun player inserito.</p>
          ) : (
            players.map((player) => (
              <div
                key={player.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{player.riot_id}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    {player.region} · {player.slug}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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
