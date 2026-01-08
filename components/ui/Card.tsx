type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  const classes = className
    ? `rounded-xl border border-slate-800 bg-slate-950/70 ${className}`
    : "rounded-xl border border-slate-800 bg-slate-950/70";

  return <div className={classes}>{children}</div>;
}

export function CardHeader({ children, className }: CardProps) {
  const classes = className ? `border-b border-slate-800 px-5 py-4 ${className}` : "border-b border-slate-800 px-5 py-4";
  return <div className={classes}>{children}</div>;
}

type CardTitleProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardTitle({ children, className }: CardTitleProps) {
  const classes = className ? `text-lg font-semibold text-white ${className}` : "text-lg font-semibold text-white";
  return <h3 className={classes}>{children}</h3>;
}

export function CardContent({ children, className }: CardProps) {
  const classes = className ? `px-5 py-4 ${className}` : "px-5 py-4";
  return <div className={classes}>{children}</div>;
}
