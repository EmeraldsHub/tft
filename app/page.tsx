import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { LeaderboardSection } from "@/components/LeaderboardSection";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <HeroSection />
      <LeaderboardSection />
      <Footer />
    </main>
  );
}
