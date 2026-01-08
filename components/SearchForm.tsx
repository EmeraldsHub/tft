"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();

    const hashIndex = trimmed.indexOf("#");
    const lastHashIndex = trimmed.lastIndexOf("#");

    if (
      hashIndex <= 0 ||
      hashIndex === trimmed.length - 1 ||
      hashIndex !== lastHashIndex
    ) {
      setError("Inserisci un Riot ID nel formato nome#TAG.");
      return;
    }

    setError("");
    router.push(`/player/${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-xl flex-col gap-3"
    >
      <label htmlFor="riot-id" className="text-sm font-medium text-slate-200">
        Cerca giocatore
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="riot-id"
          name="riotId"
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="nome#TAG"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) {
              setError("");
            }
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "riot-id-error" : undefined}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-base text-slate-100 shadow-sm outline-none transition focus:border-tft-accent focus:ring-2 focus:ring-tft-accent/40"
        />
        <button
          type="submit"
          className="rounded-lg bg-gradient-to-r from-tft-accent to-tft-accent-strong px-6 py-3 text-base font-semibold text-slate-900 shadow-glow transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tft-accent"
        >
          Cerca giocatore
        </button>
      </div>
      {error ? (
        <p id="riot-id-error" className="text-sm text-rose-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
