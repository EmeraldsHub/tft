type StatProps = {
  label: string;
  value: React.ReactNode;
  helper?: string;
  accent?: "yellow" | "none";
};

export function Stat({ label, value, helper, accent = "none" }: StatProps) {
  const valueClass =
    accent === "yellow"
      ? "mt-2 text-2xl font-semibold text-yellow-300"
      : "mt-2 text-2xl font-semibold text-white";

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <div className={valueClass}>{value}</div>
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}
