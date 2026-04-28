import { useId } from "react";

import type { VisualSpec } from "../../schemas/lesson.schema";
import { DiagramFrame } from "./DiagramFrame";

type Props = {
  title: string;
  visualSpec: VisualSpec;
};

const flowNodes = [
  { label: "查询条件", detail: "WHERE email = ...", tone: "neutral" },
  { label: "规划器判断", detail: "索引能缩小范围吗？", tone: "accent" },
  { label: "全表扫描", detail: "读取大量表行", tone: "warning" },
  { label: "索引查找", detail: "先搜索有序 key", tone: "success" },
  { label: "取回匹配行", detail: "沿指针返回数据行", tone: "neutral" }
] as const;

const toneClasses: Record<(typeof flowNodes)[number]["tone"], string> = {
  neutral: "border-line bg-white text-ink",
  accent: "border-teal-200 bg-teal-50 text-accent",
  warning: "border-amber-200 bg-amber-50 text-signal",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800"
};

export function AccessPathFlow({ title, visualSpec }: Props) {
  const titleId = useId();
  const descId = useId();

  return (
    <DiagramFrame title={title} description={visualSpec.description}>
      <div
        className="overflow-x-auto"
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <h4 id={titleId} className="sr-only">
          查询访问路径流程
        </h4>
        <p id={descId} className="sr-only">
          查询条件进入规划器判断，然后选择全表扫描或索引查找，最后取回匹配行。
        </p>
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
            <FlowCard node={flowNodes[0]} />
            <Arrow />
            <FlowCard node={flowNodes[1]} />
            <Arrow />
            <FlowCard node={flowNodes[4]} />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 px-[154px] py-5">
            <div className="h-10 border-l-2 border-dashed border-slate-300" aria-hidden="true" />
            <div className="h-10 border-l-2 border-dashed border-slate-300" aria-hidden="true" />
            <div className="h-10 border-l-2 border-dashed border-slate-300" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-[1fr_1fr] gap-4 px-24">
            <FlowCard node={flowNodes[2]} />
            <FlowCard node={flowNodes[3]} />
          </div>

          <p className="mt-5 rounded-lg border border-line bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            同样是 WHERE 条件，实际工作量可能完全不同。选择性强且匹配索引的条件通常走索引查找；
            过宽或没有对应索引的条件仍可能走全表扫描。
          </p>
        </div>
      </div>
    </DiagramFrame>
  );
}

function FlowCard({ node }: { node: (typeof flowNodes)[number] }) {
  return (
    <section className={`min-h-24 rounded-lg border p-4 ${toneClasses[node.tone]}`}>
      <h4 className="text-base font-semibold">{node.label}</h4>
      <p className="mt-2 text-sm leading-5 text-slate-600">{node.detail}</p>
    </section>
  );
}

function Arrow() {
  return (
    <span className="text-2xl font-semibold text-slate-400" aria-hidden="true">
      →
    </span>
  );
}
