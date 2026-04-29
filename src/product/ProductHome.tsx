import { ArrowRight, BookOpen, FileText, Layers3, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";

import { GuidedStartPanel } from "./GuidedStartPanel";
import { productCopy } from "./product-copy";

type ProductHomeProps = {
  courseCount: number;
  lessonCount: number;
  onStart: () => void;
  onOpenSamples: () => void;
};

export function ProductHome({ courseCount, lessonCount, onStart, onOpenSamples }: ProductHomeProps) {
  const [showStart, setShowStart] = useState(false);

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-5 text-slate-950 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="grid gap-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)] lg:p-7">
          <div className="grid content-start gap-5">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                <Sparkles aria-hidden="true" className="size-3.5 text-sky-600" />
                {productCopy.name}
              </p>
              <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">{productCopy.headline}</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{productCopy.subtitle}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {productCopy.supportedSources.map((source) => (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700" key={source}>
                  {source}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#0e2f57] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#16446f]"
                onClick={() => {
                  setShowStart(true);
                  onStart();
                }}
                type="button"
              >
                {productCopy.primaryAction}
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:border-sky-300 hover:text-sky-800"
                onClick={onOpenSamples}
                type="button"
              >
                <BookOpen aria-hidden="true" className="size-4" />
                {productCopy.secondaryAction}
              </button>
            </div>
          </div>

          <div className="grid content-start gap-3">
            <StatCard icon={<Layers3 aria-hidden="true" className="size-5" />} label="学习项目" value={courseCount} />
            <StatCard icon={<FileText aria-hidden="true" className="size-5" />} label="课程单元" value={lessonCount} />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">产品流程</p>
              <ol className="mt-3 grid gap-2">
                {productCopy.workflow.map((step, index) => (
                  <li className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={step}>
                    <span className="grid size-6 place-items-center rounded-full bg-white text-xs font-bold text-sky-700">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {showStart ? <GuidedStartPanel /> : null}
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-sky-700">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-slate-950">{value}</p>
        <p className="text-sm font-semibold text-slate-600">{label}</p>
      </div>
    </div>
  );
}
