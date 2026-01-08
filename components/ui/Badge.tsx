type BadgeVariant = "neutral" | "yellow" | "green" | "red";

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  neutral: "border-slate-700 text-slate-300",
  yellow: "border-yellow-500/40 text-yellow-300",
  green: "border-emerald-500/40 text-emerald-300",
  red: "border-rose-500/40 text-rose-300"
};

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const classes = className
    ? `inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${variantStyles[variant]} ${className}`
    : `inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${variantStyles[variant]}`;

  return <span className={classes}>{children}</span>;
}
