interface PlayerPageProps {
  params: {
    riotId: string;
  };
}

export default function PlayerPage({ params }: PlayerPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.4em] text-slate-500">
        Player lookup
      </p>
      <h1 className="text-3xl font-semibold text-white">{params.riotId}</h1>
      <p className="text-slate-400">Integrazione API in arrivo</p>
    </main>
  );
}
