import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:pt-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.15),_transparent_55%)]" />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center">
        <div className="flex w-full justify-end">
          <Link
            href="/admin/login"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-tft-accent hover:text-tft-accent"
          >
            Admin
          </Link>
        </div>
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.4em] text-tft-accent">Esports Hub</p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            TFT Italia
          </h1>
          <p className="text-lg text-slate-300 sm:text-xl">
            Statistiche, rank e partite live per giocatori italiani.
          </p>
        </div>
        <SearchForm />
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-500">
          <span className="rounded-full border border-slate-700 px-4 py-2">
            Meta insight
          </span>
          <span className="rounded-full border border-slate-700 px-4 py-2">
            Live tracking
          </span>
          <span className="rounded-full border border-slate-700 px-4 py-2">
            Community focus
          </span>
        </div>
      </div>
    </section>
  );
}
