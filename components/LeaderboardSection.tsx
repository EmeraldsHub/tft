const leaderboardCards = [
  {
    title: "Top player",
    value: "In arrivo",
    description: "Leaderboard nazionale con filtri per regioni."
  },
  {
    title: "Rank",
    value: "In arrivo",
    description: "Progressione dettagliata di LP e divisioni."
  },
  {
    title: "Winrate",
    value: "In arrivo",
    description: "Andamento stagionale e insight sulle patch."
  }
];

export function LeaderboardSection() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-white">Leaderboard (in arrivo)</h2>
          <p className="text-slate-400">
            Stiamo preparando la classifica italiana con statistiche avanzate e
            aggiornamenti live.
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
      </div>
    </section>
  );
}
