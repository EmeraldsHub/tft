"use client";

import { useState } from "react";

type Props = {
  playerId: string;
  className?: string;
};

export function PlayerSyncButton({ playerId, className }: Props) {
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

    const data = (await response.json()) as {
      warning?: string | null;
      error?: string;
      statuses?: {
        ranked: string;
        live: string;
        avgPlacement: string;
      };
    };

    if (!response.ok) {
      setStatus(data.error ?? "Sync failed.");
      setIsLoading(false);
      return;
    }

    if (data.warning) {
      setStatus(`Sync completato con avviso: ${data.warning}`);
    } else {
      setStatus("Sync completato.");
    }
    if (data.statuses) {
      setStatus(
        `Sync ${data.statuses.ranked}/${data.statuses.live}/${data.statuses.avgPlacement}`
      );
    }
    setIsLoading(false);
    const current = new URL(window.location.href);
    current.searchParams.set("refresh", "1");
    window.location.href = current.toString();
  };

  return (
    <div className={className ?? "mt-4 flex flex-col items-center gap-2"}>
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
