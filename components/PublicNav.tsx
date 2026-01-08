import Link from "next/link";
import { Container } from "@/components/ui/Container";

export function PublicNav() {
  return (
    <nav className="border-b border-slate-900 bg-slate-950/70">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold text-white">
          TFT Italia
        </Link>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          <Link
            href="/"
            className="rounded-full border border-slate-800 px-4 py-2 transition hover:border-yellow-400 hover:text-yellow-300"
          >
            Home
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-full border border-slate-800 px-4 py-2 transition hover:border-yellow-400 hover:text-yellow-300"
          >
            Leaderboard
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-slate-800 px-4 py-2 transition hover:border-yellow-400 hover:text-yellow-300"
          >
            Admin
          </Link>
        </div>
      </Container>
    </nav>
  );
}
