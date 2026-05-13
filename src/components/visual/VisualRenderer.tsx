import type { VisualSpec } from "../../schemas/lesson.schema";
import { AccessPathFlow } from "./AccessPathFlow";
import { BookIndexComparison } from "./BookIndexComparison";
import { DiagramFrame } from "./DiagramFrame";
import { IndexTreeVisual } from "./IndexTreeVisual";
import { TableScanVisual } from "./TableScanVisual";
import { TradeoffVisual } from "./TradeoffVisual";

type VisualRendererProps = {
  title: string;
  visualSpec?: VisualSpec;
};

export function VisualRenderer({ title, visualSpec }: VisualRendererProps) {
  if (!visualSpec) {
    return (
      <DiagramFrame title={title} description="内容页">
        <p className="text-sm leading-6 text-slate-500">
          这一页以文字说明为主；后续页面会补充结构图、过程图或例子。
        </p>
      </DiagramFrame>
    );
  }

  switch (visualSpec.component) {
    case "table_scan":
      return <TableScanVisual title={title} visualSpec={visualSpec} />;
    case "book_index":
      return <BookIndexComparison title={title} visualSpec={visualSpec} />;
    case "index_tree":
      return <IndexTreeVisual title={title} visualSpec={visualSpec} />;
    case "access_path":
      return <AccessPathFlow title={title} visualSpec={visualSpec} />;
    case "tradeoff":
      return <TradeoffVisual title={title} visualSpec={visualSpec} />;
    default:
      return (
        <DiagramFrame title={title} description={visualSpec.description}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.9fr)]">
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                关键节点
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {visualSpec.keyElements.map((element, index) => (
                  <li
                    key={`${element}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-slate-800"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-extrabold text-accent">
                      {index + 1}
                    </span>
                    {element}
                  </li>
                ))}
              </ul>
            </section>

            {visualSpec.states?.length ? (
              <section className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-accent">
                  关键链路
                </p>
                <ol className="mt-3 grid gap-2">
                  {visualSpec.states.map((state, index) => (
                    <li
                      className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2 text-sm font-semibold leading-5 text-slate-800"
                      key={`${state}-${index}`}
                    >
                      <span className="grid size-7 place-items-center rounded-full bg-accent text-xs font-extrabold text-white">
                        {index + 1}
                      </span>
                      <span className="rounded-md bg-white/80 px-3 py-2">{state}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              <section className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-accent">
                  阅读线索
                </p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                  先看清这些元素之间的关系，再回到页面主题判断它们如何构成知识链路。
                </p>
              </section>
            )}
          </div>
        </DiagramFrame>
      );
  }
}
