import type { ReactNode } from "react";

type ConceptNodeProps = {
  title: string;
  meta: string;
  tone?: "unit" | "concept" | "source";
  selected?: boolean;
  children?: ReactNode;
};

export function ConceptNode({ title, meta, tone = "concept", selected = false, children }: ConceptNodeProps) {
  const toneClass =
    tone === "unit"
      ? "border-sky-200 bg-sky-50"
      : tone === "source"
        ? "border-amber-200 bg-amber-50"
        : "border-emerald-200 bg-emerald-50";

  return (
    <article className={`rounded-lg border p-4 ${toneClass} ${selected ? "ring-2 ring-sky-400" : ""}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{meta}</p>
      <h3 className="mt-1 text-base font-bold text-slate-950">{title}</h3>
      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}
