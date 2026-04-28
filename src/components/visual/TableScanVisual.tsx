import { useId } from "react";

import type { VisualSpec } from "../../schemas/lesson.schema";
import { DiagramFrame } from "./DiagramFrame";

type Props = {
  title: string;
  visualSpec: VisualSpec;
};

const rows = Array.from({ length: 14 }, (_, index) => index);

export function TableScanVisual({ title, visualSpec }: Props) {
  const titleId = useId();
  const descId = useId();
  const arrowId = useId();

  return (
    <DiagramFrame title={title} description={visualSpec.description}>
      <div className="overflow-x-auto">
        <svg
          className="min-h-[260px] w-full min-w-[680px]"
          viewBox="0 0 760 280"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>全表扫描访问路径</title>
          <desc id={descId}>
            查询从左到右逐行检查，直到找到目标行。
          </desc>
          <defs>
            <marker
              id={arrowId}
              markerHeight="10"
              markerWidth="10"
              orient="auto"
              refX="8"
              refY="3"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill="#0f766e" />
            </marker>
          </defs>

          <text x="40" y="34" className="fill-ink text-[18px] font-semibold">
            全表扫描
          </text>
          <text x="40" y="58" className="fill-slate-600 text-[13px]">
            没有可用快捷路径时，引擎只能逐行检查。
          </text>

          <line
            x1="70"
            x2="675"
            y1="116"
            y2="116"
            stroke="#0f766e"
            strokeDasharray="8 8"
            strokeWidth="4"
            markerEnd={`url(#${arrowId})`}
          />
          <text x="292" y="98" className="fill-accent text-[14px] font-semibold">
            已检查的行
          </text>

          {rows.map((row) => {
            const isTarget = row === 10;
            const x = 48 + row * 48;

            return (
              <g key={row}>
                <rect
                  x={x}
                  y="132"
                  width="38"
                  height="74"
                  rx="5"
                  fill={isTarget ? "#fef3c7" : "#f8fafc"}
                  stroke={isTarget ? "#b45309" : "#d9deea"}
                  strokeWidth={isTarget ? "3" : "2"}
                />
                <line x1={x + 6} x2={x + 32} y1="154" y2="154" stroke="#cbd5e1" />
                <line x1={x + 6} x2={x + 32} y1="174" y2="174" stroke="#cbd5e1" />
                <text
                  x={x + 19}
                  y="226"
                  textAnchor="middle"
                  className="fill-slate-600 text-[12px] font-semibold"
                >
                  R{row + 1}
                </text>
              </g>
            );
          })}

          <path d="M548 208 L548 238" stroke="#b45309" strokeWidth="3" />
          <rect x="488" y="238" width="120" height="30" rx="15" fill="#fff7ed" stroke="#b45309" />
          <text x="548" y="258" textAnchor="middle" className="fill-signal text-[13px] font-semibold">
            目标行
          </text>
        </svg>
      </div>
    </DiagramFrame>
  );
}
