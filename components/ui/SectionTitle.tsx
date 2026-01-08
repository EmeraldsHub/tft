type SectionTitleProps = {
  title: string;
  description?: string;
};

export function SectionTitle({ title, description }: SectionTitleProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      {description ? (
        <p className="text-sm text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}
