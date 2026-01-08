import Link from "next/link";

const leaderboardCards = [
  {
    title: "Avg placement",
    value: "Top 10",
    description: "Media piazzamenti ultimi 10 match."
  },
  {
    title: "Live status",
    value: "EUW1",
    description: "Stato live con spettatore attivo."
  },
  {
    title: "Ranked",
    value: "TFT",
    description: "Tier, divisione e LP aggiornati."
  }
];

export function LeaderboardSection() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-white">Leaderboard</h2>
          <p className="text-slate-400">
            Classifica pubblica dei player tracciati con media piazzamenti e live
            status.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {leaderboardCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg"
            >
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                {card.title}
              </p>
              <p className="mt-4 text-2xl font-semibold text-white">
                {card.value}
              </p>
              <p className="mt-3 text-sm text-slate-400">{card.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/leaderboard"
            className="inline-flex items-center rounded-full border border-slate-700 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-tft-accent hover:text-tft-accent"
          >
            View leaderboard
          </Link>
        </div>
      </div>
    </section>
  );
}
