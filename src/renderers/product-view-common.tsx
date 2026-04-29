import type { ReactNode } from "react";

export function ModeHeader({ title, subtitle, meta }: { title: string; subtitle: string; meta?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase text-slate-500">学习产品</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2>
        {meta ? <p className="mt-2 text-sm leading-6 text-slate-600">{meta}</p> : null}
      </div>
      <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600">{subtitle}</p>
    </header>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}
