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
      <DiagramFrame title={title} description="先聚焦这一页的问题">
        <p className="text-sm leading-6 text-slate-500">
          先用这页的问题建立方向，再通过后续页面的结构图、互动或检查题验证理解。
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
          <ul className="grid gap-3 sm:grid-cols-2">
            {visualSpec.keyElements.map((element) => (
              <li
                key={element}
                className="rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                {element}
              </li>
            ))}
          </ul>
        </DiagramFrame>
      );
  }
}
