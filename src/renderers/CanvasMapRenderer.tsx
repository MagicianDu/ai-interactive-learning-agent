import type { CoursePack } from "../schemas/course-pack.schema";
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
  const sourceAnchorIds = Array.from(new Set(coursePack.units.flatMap((unit) => unit.sourceAnchorIds)));
  const edges = coursePack.units.flatMap((unit) => unit.conceptIds.map((conceptId) => ({ from: unit.title, to: conceptId })));

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
            <h3 className="text-sm font-bold text-slate-700">核心概念</h3>
            <div className="mt-3 grid gap-3">
              {conceptIds.map((conceptId) => (
                <ConceptNode key={conceptId} meta="concept" title={conceptId} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-700">来源锚点</h3>
            <div className="mt-3 grid gap-2">
              {sourceAnchorIds.map((anchorId) => (
                <ConceptNode key={anchorId} meta="source anchor" title={anchorId} tone="source" />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </MapViewport>
  );
}

function collectConceptIds(coursePack: CoursePack): string[] {
  const fromCoverage = coursePack.conceptCoverage?.map((entry) => entry.conceptId) ?? [];
  const fromUnits = coursePack.units.flatMap((unit) => unit.conceptIds);
  return Array.from(new Set([...fromCoverage, ...fromUnits]));
}
