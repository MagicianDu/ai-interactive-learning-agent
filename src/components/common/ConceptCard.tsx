type ConceptCardProps = {
  title: string;
  items: string[];
};

export function ConceptCard({ title, items }: ConceptCardProps) {
  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/70 p-5">
      <h3 className="text-xl font-bold text-ink">{title}</h3>
      <ul className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex gap-3 text-sm leading-6 text-slate-700">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
