interface AdminLoginPageProps {
  searchParams?: {
    error?: string;
  };
}

export default function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const hasError = Boolean(searchParams?.error);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-white">Admin login</h1>
        <p className="mt-2 text-sm text-slate-400">
          Accedi per gestire i player tracciati.
        </p>
        <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
          <label htmlFor="password" className="text-sm text-slate-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 shadow-sm outline-none transition focus:border-tft-accent focus:ring-2 focus:ring-tft-accent/40"
            required
          />
          {hasError ? (
            <p className="text-sm text-rose-400">Password non valida.</p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-tft-accent to-tft-accent-strong px-6 py-3 text-base font-semibold text-slate-900 shadow-glow transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tft-accent"
          >
            Accedi
          </button>
        </form>
      </div>
    </main>
  );
}
