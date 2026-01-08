"use client";

import { useState } from "react";

type Props = {
  playerId: string;
};

export function PlayerSyncButton({ playerId }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    setStatus(null);

    const response = await fetch("/api/admin/sync-player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: playerId })
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus(data.error ?? "Sync failed.");
      setIsLoading(false);
      return;
    }

    setStatus("Sync completato.");
    setIsLoading(false);
    window.location.reload();
  };

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Sync..." : "Refresh"}
      </button>
      {status ? <p className="text-xs text-slate-400">{status}</p> : null}
    </div>
  );
}
