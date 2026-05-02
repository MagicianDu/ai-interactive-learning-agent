import type { CoursePack, CoursePackUnit } from "../schemas/course-pack.schema";
import { ConceptEdge } from "../components/canvas/ConceptEdge";
import { ConceptNode } from "../components/canvas/ConceptNode";
import { MapViewport } from "../components/canvas/MapViewport";

type CanvasMapRendererProps = {
  coursePack: CoursePack;
  selectedLessonId: string;
  onSelectLesson: (lessonId: string) => void;
};

export function CanvasMapRenderer({ coursePack, selectedLessonId, onSelectLesson }: CanvasMapRendererProps) {
  const conceptIds = collectConceptIds(coursePack);
  const sourceAnchorIds = collectSourceAnchorIds(coursePack);
  const generatedUnitCount = coursePack.units.filter((unit) => unit.lessonId).length;
  const plannedUnitCount = coursePack.units.length - generatedUnitCount;
  const edges = coursePack.units.flatMap((unit) => unit.conceptIds.map((conceptId) => ({ from: unit.title, to: conceptId })));
  const conceptCoverageById = new Map(coursePack.conceptCoverage?.map((entry) => [entry.conceptId, entry]) ?? []);
  const sourceCoverageById = new Map(coursePack.sourceCoverage?.map((entry) => [entry.sourceNodeId, entry]) ?? []);

  return (
    <MapViewport>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Canvas / Whiteboard</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">知识地图</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            从课程包视角查看学习单元、核心概念和来源锚点的关系。点击已生成单元可以回到 Web Deck。
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
          {coursePack.sourceKind ?? "unknown"} · {coursePack.strategy ?? "course"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="已生成单元" value={generatedUnitCount} />
        <MetricCard label="待生成单元" value={plannedUnitCount} />
        <MetricCard label="核心概念" value={conceptIds.length} />
        <MetricCard label="来源锚点" value={sourceAnchorIds.length} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.7fr)]">
        <div className="grid gap-5">
          <section>
            <h3 className="text-sm font-bold text-slate-700">学习单元</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {coursePack.units.map((unit) => (
                <ConceptNode
                  key={unit.unitId}
                  meta={`${unit.kind} · ${unit.targetPageCount} 页`}
                  selected={unit.lessonId === selectedLessonId}
                  title={unit.title}
                  tone="unit"
                >
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    {unit.chapterRefs?.map((chapterRef) => (
                      <span className="rounded-full bg-white px-2 py-1" key={chapterRef}>
                        {chapterRef}
                      </span>
                    ))}
                  </div>
                  {unit.lessonId ? (
                    <button
                      className="mt-3 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                      onClick={() => onSelectLesson(unit.lessonId!)}
                      type="button"
                    >
                      打开 {unit.title}
                    </button>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-slate-500">待生成</p>
                  )}
                </ConceptNode>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-700">关系</h3>
            <ul className="mt-3 grid gap-2">
              {edges.map((edge) => (
                <ConceptEdge from={edge.from} key={`${edge.from}-${edge.to}`} to={edge.to} />
              ))}
            </ul>
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <section>
            <h3 className="text-sm font-bold text-slate-700">核心概念明细</h3>
            <div className="mt-3 grid gap-3">
              {conceptIds.map((conceptId) => (
                <ConceptNode key={conceptId} meta="concept" title={conceptId}>
                  <div className="grid gap-2 text-xs text-slate-600">
                    <p className="font-semibold">
                      概念覆盖：{statusLabel(conceptCoverageById.get(conceptId)?.status)}
                    </p>
                    <p>关联单元：{relatedUnitTitles(coursePack.units, conceptId)}</p>
                    {firstGeneratedUnitForConcept(coursePack.units, conceptId) ? (
                      <button
                        aria-label={`打开概念 ${conceptId} 对应课程`}
                        className="w-fit rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                        onClick={() => {
                          const unit = firstGeneratedUnitForConcept(coursePack.units, conceptId);
                          if (unit?.lessonId) {
                            onSelectLesson(unit.lessonId);
                          }
                        }}
                        type="button"
                      >
                        打开对应课程
                      </button>
                    ) : (
                      <span className="font-semibold text-slate-500">暂无已生成课程</span>
                    )}
                  </div>
                </ConceptNode>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-700">来源锚点明细</h3>
            <div className="mt-3 grid max-h-[32rem] gap-2 overflow-auto pr-1">
              {sourceAnchorIds.map((anchorId) => (
                <ConceptNode key={anchorId} meta="source anchor" title={anchorId} tone="source">
                  <p className="text-xs font-semibold text-slate-600">
                    来源覆盖：{statusLabel(sourceCoverageById.get(anchorId)?.status)}
                  </p>
                </ConceptNode>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </MapViewport>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function collectConceptIds(coursePack: CoursePack): string[] {
  const fromCoverage = coursePack.conceptCoverage?.map((entry) => entry.conceptId) ?? [];
  const fromUnits = coursePack.units.flatMap((unit) => unit.conceptIds);
  return Array.from(new Set([...fromCoverage, ...fromUnits]));
}

function collectSourceAnchorIds(coursePack: CoursePack): string[] {
  const fromCoverage = coursePack.sourceCoverage?.map((entry) => entry.sourceNodeId) ?? [];
  const fromUnits = coursePack.units.flatMap((unit) => unit.sourceAnchorIds);
  return Array.from(new Set([...fromCoverage, ...fromUnits]));
}

function relatedUnitTitles(units: CoursePackUnit[], conceptId: string): string {
  const titles = units.filter((unit) => unit.conceptIds.includes(conceptId)).map((unit) => unit.title);
  return titles.length > 0 ? titles.join("、") : "未分配";
}

function firstGeneratedUnitForConcept(units: CoursePackUnit[], conceptId: string): CoursePackUnit | undefined {
  return units.find((unit) => unit.conceptIds.includes(conceptId) && unit.lessonId);
}

function statusLabel(status: "covered" | "partial" | "deferred" | "omitted" | undefined): string {
  if (status === "covered") {
    return "已覆盖";
  }
  if (status === "partial") {
    return "部分覆盖";
  }
  if (status === "deferred") {
    return "延后";
  }
  if (status === "omitted") {
    return "省略";
  }
  return "未标注";
}
