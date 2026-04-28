import { useId } from "react";

import type { VisualSpec } from "../../schemas/lesson.schema";
import { DiagramFrame } from "./DiagramFrame";

type Props = {
  title: string;
  visualSpec: VisualSpec;
};

export function IndexTreeVisual({ title, visualSpec }: Props) {
  const titleId = useId();
  const descId = useId();

  return (
    <DiagramFrame title={title} description={visualSpec.description}>
      <div className="overflow-x-auto">
        <svg
          className="min-h-[340px] w-full min-w-[720px]"
          viewBox="0 0 820 360"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>B+ 树索引结构</title>
          <desc id={descId}>
            根节点把查询路由到分支节点和叶子 key，再通过行指针取回表行。
          </desc>

          <line x1="410" x2="250" y1="82" y2="150" stroke="#94a3b8" strokeWidth="2" />
          <line x1="410" x2="570" y1="82" y2="150" stroke="#94a3b8" strokeWidth="2" />
          <line x1="250" x2="150" y1="202" y2="262" stroke="#94a3b8" strokeWidth="2" />
          <line x1="250" x2="330" y1="202" y2="262" stroke="#94a3b8" strokeWidth="2" />
          <line x1="570" x2="500" y1="202" y2="262" stroke="#94a3b8" strokeWidth="2" />
          <line x1="570" x2="670" y1="202" y2="262" stroke="#94a3b8" strokeWidth="2" />

          <g>
            <rect x="342" y="34" width="136" height="58" rx="8" fill="#ecfeff" stroke="#0f766e" strokeWidth="2" />
            <text x="410" y="58" textAnchor="middle" className="fill-accent text-[15px] font-semibold">
              根节点
            </text>
            <text x="410" y="78" textAnchor="middle" className="fill-slate-700 text-[13px]">
              key &lt; 50？
            </text>
          </g>

          {[
            { x: 180, label: "分支节点", range: "10 | 25 | 40" },
            { x: 500, label: "分支节点", range: "60 | 75 | 90" }
          ].map((node) => (
            <g key={node.x}>
              <rect x={node.x} y="146" width="140" height="58" rx="8" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
              <text x={node.x + 70} y="170" textAnchor="middle" className="fill-ink text-[14px] font-semibold">
                {node.label}
              </text>
              <text x={node.x + 70} y="190" textAnchor="middle" className="fill-slate-600 text-[13px]">
                {node.range}
              </text>
            </g>
          ))}

          {[
            { x: 72, keys: "1  7  9", pointer: "行 A-C" },
            { x: 252, keys: "26  31  44", pointer: "行 D-F" },
            { x: 432, keys: "51  62  68", pointer: "行 G-I" },
            { x: 612, keys: "76  88  97", pointer: "行 J-L" }
          ].map((leaf) => (
            <g key={leaf.x}>
              <rect x={leaf.x} y="256" width="136" height="72" rx="8" fill="#fff7ed" stroke="#b45309" strokeWidth="2" />
              <text x={leaf.x + 68} y="280" textAnchor="middle" className="fill-signal text-[14px] font-semibold">
                叶子 key
              </text>
              <text x={leaf.x + 68} y="302" textAnchor="middle" className="fill-ink text-[13px]">
                {leaf.keys}
              </text>
              <text x={leaf.x + 68} y="320" textAnchor="middle" className="fill-slate-600 text-[12px]">
                行指针：{leaf.pointer}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </DiagramFrame>
  );
}
