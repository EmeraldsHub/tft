import { SearchForm } from "@/components/SearchForm";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

export function HeroSection() {
  return (
    <section className="border-b border-slate-900 py-12 sm:py-16">
      <Container className="space-y-8">
        <SectionTitle
          title="TFT Italia"
          description="Statistiche, rank e partite live per giocatori italiani."
        />
        <Card>
          <CardContent className="space-y-4">
            <SearchForm />
            <p className="text-xs text-slate-500">
              Only curated players are available. Start typing to see suggestions.
            </p>
          </CardContent>
        </Card>
      </Container>
    </section>
  );
}
