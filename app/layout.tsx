import type { Metadata } from "next";
import { PublicNav } from "@/components/PublicNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "TFT Italia | Statistiche e ranking",
  description: "Statistiche, rank e partite live per giocatori italiani di Teamfight Tactics.",
  metadataBase: new URL("https://tft-italia.vercel.app"),
  openGraph: {
    title: "TFT Italia",
    description: "Statistiche, rank e partite live per giocatori italiani.",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <PublicNav />
        {children}
      </body>
    </html>
  );
}
