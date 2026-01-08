export function Footer() {
  return (
    <footer className="border-t border-slate-800 px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center text-sm text-slate-500 sm:flex-row sm:text-left">
        <p>© {new Date().getFullYear()} TFT Italia</p>
        <p>Non affiliato a Riot Games.</p>
      </div>
    </footer>
  );
}
