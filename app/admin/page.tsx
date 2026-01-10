import { AdminDashboard } from "@/components/AdminDashboard";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function AdminPage() {
  const session = cookies().get("admin_session")?.value ?? null;
  if (session !== "authenticated") {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
            Admin
          </p>
          <Link
            href="/"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-tft-accent hover:text-tft-accent"
          >
            Home
          </Link>
        </div>
        <div>
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
