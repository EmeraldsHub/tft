import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

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
    <section className="py-12">
      <Container className="space-y-8">
        <SectionTitle
          title="Leaderboard"
          description="Classifica pubblica dei player tracciati con media piazzamenti e live status."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {leaderboardCards.map((card) => (
            <Card key={card.title}>
              <CardContent>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {card.title}
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {card.value}
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Link
          href="/leaderboard"
          className="inline-flex items-center rounded-full border border-slate-700 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-yellow-400 hover:text-yellow-300"
        >
          View leaderboard
        </Link>
      </Container>
    </section>
  );
}
