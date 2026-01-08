import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
            Admin
          </p>
          <h1 className="text-3xl font-semibold text-white">TFT Italia</h1>
          <p className="mt-2 text-slate-400">
            Gestisci i player tracciati del directory.
          </p>
        </div>
        <AdminDashboard />
      </div>
    </main>
  );
}
