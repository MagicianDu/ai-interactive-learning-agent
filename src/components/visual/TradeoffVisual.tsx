import type { VisualSpec } from "../../schemas/lesson.schema";
import { DiagramFrame } from "./DiagramFrame";

type Props = {
  title: string;
  visualSpec: VisualSpec;
};

const tradeoffs = [
  {
    label: "读查询收益",
    detail: "选择性强的查找会检查更少行，返回结果更快。",
    value: "查询按索引列过滤时最高",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900"
  },
  {
    label: "写入维护成本",
    detail: "插入、更新、删除时也要维护索引结构。",
    value: "写入越重，成本越明显",
    className: "border-amber-200 bg-amber-50 text-signal"
  },
  {
    label: "存储成本",
    detail: "每个索引都要额外保存 key 和行指针。",
    value: "随行数和索引列增加",
    className: "border-slate-200 bg-slate-50 text-slate-800"
  },
  {
    label: "工作负载匹配",
    detail: "好的索引要匹配高频、选择性强的查询模式。",
    value: "不匹配时索引可能闲置",
    className: "border-teal-200 bg-teal-50 text-accent"
  }
];

export function TradeoffVisual({ title, visualSpec }: Props) {
  return (
    <DiagramFrame title={title} description={visualSpec.description}>
      <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <h4 className="text-lg font-semibold text-emerald-900">读查询收益</h4>
          <div className="mt-4 space-y-2">
            {["定位 key", "沿指针取行", "返回匹配结果"].map((step) => (
              <div
                key={step}
                className="rounded border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900"
              >
                {step}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-emerald-950">
            当索引能显著缩小搜索空间，避免扫描大部分行时，它才真正划算。
          </p>
        </section>

        <div className="flex justify-center">
          <div className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
            工作负载匹配
          </div>
        </div>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h4 className="text-lg font-semibold text-signal">写入维护 + 存储成本</h4>
          <div className="mt-4 grid gap-2">
            <div className="rounded border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-signal">
              每次写入都要维护索引
            </div>
            <div className="rounded border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-signal">
              额外保存 key 和行指针
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-amber-950">
            额外索引不是免费的：它们会增加写入时的工作，并消耗更多存储。
          </p>
        </section>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tradeoffs.map((item) => (
          <section key={item.label} className={`rounded-lg border p-4 ${item.className}`}>
            <h4 className="text-sm font-semibold">{item.label}</h4>
            <p className="mt-2 text-sm leading-5 text-slate-700">{item.detail}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.value}
            </p>
          </section>
        ))}
      </div>
    </DiagramFrame>
  );
}
