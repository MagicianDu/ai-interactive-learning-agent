import type { VisualSpec } from "../../schemas/lesson.schema";
import { DiagramFrame } from "./DiagramFrame";

type Props = {
  title: string;
  visualSpec: VisualSpec;
};

export function BookIndexComparison({ title, visualSpec }: Props) {
  return (
    <DiagramFrame title={title} description={visualSpec.description}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <section className="rounded-lg border border-line bg-slate-50 p-4">
          <h4 className="text-base font-semibold text-ink">没有索引</h4>
          <div
            className="mt-4 grid grid-cols-5 gap-2"
            aria-label="没有索引时，读者逐页扫描，直到第 16 页找到目标主题。"
          >
            {Array.from({ length: 20 }, (_, index) => (
              <div
                key={index}
                aria-label={index === 15 ? "第 16 页找到目标主题" : `已扫描第 ${index + 1} 页`}
                className={`h-12 rounded border text-center text-xs font-semibold leading-[3rem] ${
                  index === 15
                    ? "border-signal bg-amber-100 text-signal"
                    : "border-line bg-white text-slate-500"
                }`}
              >
                {index + 1}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            你可能需要逐页翻找，直到目标主题出现。
          </p>
        </section>

        <div className="flex items-center justify-center">
          <div
            className="rounded-full border border-accent bg-teal-50 px-4 py-2 text-sm font-semibold text-accent"
            aria-label="在索引中找到术语后跳转到页面"
          >
            跳到目标页
          </div>
        </div>

        <section className="rounded-lg border border-line bg-slate-50 p-4">
          <h4 className="text-base font-semibold text-ink">书后索引</h4>
          <div
            className="mt-4 overflow-hidden rounded-lg border border-line bg-white"
            aria-label="书后索引把技术术语映射到页码，例如索引对应第 118 页。"
          >
            {[
              ["B+ 树", "42"],
              ["缓存", "71"],
              ["索引", "118"],
              ["选择性", "134"]
            ].map(([term, page]) => (
              <div
                key={term}
                className={`grid grid-cols-[1fr_auto] gap-4 border-b border-line px-4 py-3 last:border-b-0 ${
                  term === "索引" ? "bg-teal-50" : ""
                }`}
              >
                <span className="font-semibold text-ink">{term}</span>
                <span className="text-sm font-semibold text-accent">第 {page} 页</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            有序查找结构会直接指向更小、更相关的内容区域。
          </p>
        </section>
      </div>
    </DiagramFrame>
  );
}
