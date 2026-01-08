"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Suggestion = { riot_id: string; region: string; slug: string };

export function SearchForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const normalizedValue = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    const q = normalizedValue;
    setError("");

    if (!q) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // debounce
    const t = setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });

        if (!res.ok) {
          setSuggestions([]);
          setOpen(false);
          return;
        }

        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen((data.suggestions ?? []).length > 0);
      } catch {
        // ignore aborted/failed requests
      }
    }, 250);

    return () => clearTimeout(t);
  }, [normalizedValue]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = normalizedValue;

    if (!trimmed) {
      setError("Type a Riot ID first (Name#TAG).");
      return;
    }

    const match = suggestions.find(
      (s) => s.riot_id.toLowerCase() === trimmed.toLowerCase()
    );

    if (!match) {
      setError("Player not tracked yet. Pick one from the suggestions.");
      return;
    }

    setError("");
    setOpen(false);
    router.push(`/player/${match.slug}`);
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <div className="relative">
          <label htmlFor="riotId" className="sr-only">
            Search player
          </label>
          <input
            id="riotId"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setOpen(suggestions.length > 0)}
            placeholder="Name#TAG"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-yellow-500"
            autoComplete="off"
          />

          {open && suggestions.length > 0 && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-md border border-neutral-700 bg-neutral-950 shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => router.push(`/player/${s.slug}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-900"
                >
                  <span className="text-white">{s.riot_id}</span>
                  <span className="text-xs text-neutral-400">{s.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          className="rounded-md bg-yellow-500 px-6 py-3 font-semibold text-black hover:bg-yellow-400"
        >
          Search player
        </button>
      </form>
    </div>
  );
}
