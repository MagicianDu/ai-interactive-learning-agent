type CourseHeroProps = {
  title: string;
  sourceKind?: string;
  strategy?: string;
  unitCount: number;
  generatedCount: number;
  modeLabel: string;
};

export function CourseHero({ title, sourceKind, strategy, unitCount, generatedCount, modeLabel }: CourseHeroProps) {
  const progress = unitCount > 0 ? Math.round((generatedCount / unitCount) * 100) : 0;

  return (
    <section className="grid min-w-0 gap-4 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-slate-500">学习项目工作台</p>
        <h1 className="mt-1 truncate text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">先用总览课建立全局地图，再进入核心 topic。</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          {sourceKind ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{sourceKind}</span> : null}
          {strategy ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{strategy}</span> : null}
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-800">
            当前模式：{modeLabel}
          </span>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 rounded-lg bg-slate-50 p-4 sm:min-w-56">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-slate-950">{generatedCount}/{unitCount}</p>
            <p className="text-sm font-semibold text-slate-600">已生成单元</p>
          </div>
          <p className="text-sm font-bold text-sky-800">{progress}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-sky-600" style={{ width: `${progress}%` }} />
        </div>
        <button className="h-10 rounded-md bg-[#0e2f57] px-3 text-sm font-bold text-white hover:bg-[#16446f]" type="button">
          开始学习当前单元
        </button>
      </div>
    </section>
  );
}
