import type { ReactNode } from "react";
import { HelpCircle, Target } from "lucide-react";

import type { LessonPage } from "../../schemas/lesson.schema";

type DeckPageProps = {
  page: LessonPage;
  pageNumber: number;
  totalPages: number;
  children?: ReactNode;
};

const pageTypeLabels: Record<LessonPage["type"], string> = {
  problem_scene: "问题",
  intuition_visual: "直觉",
  structure_diagram: "结构",
  process_animation: "过程",
  interactive_model: "互动",
  code_walkthrough: "代码",
  quiz: "测验",
  misconception_check: "误区",
  transfer_challenge: "迁移",
  summary_card: "总结"
};

export function DeckPage({ page, pageNumber, totalPages, children }: DeckPageProps) {
  const pageType = pageTypeLabels[page.type];

  return (
    <article className="mx-auto grid h-full max-w-[1500px] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-line bg-white shadow-lesson">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent text-2xl font-extrabold leading-none text-white shadow-lg shadow-accent/20">
            {String(pageNumber).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">
              第 {pageNumber} / {totalPages} 页
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-2xl font-bold leading-tight text-ink">
              {page.title}
            </h2>
          </div>
        </div>

        <span className="w-fit rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-600">
          {pageType}
        </span>
      </header>

      <div className="px-4 py-3 sm:px-5">
        <section className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white">
            <HelpCircle aria-hidden="true" className="size-5" />
          </span>
          <p className="line-clamp-3 text-lg font-bold leading-7 text-ink">{page.narrative}</p>
        </section>
      </div>

      {children ? <div className="min-h-0 overflow-hidden px-4 pb-3 sm:px-5">{children}</div> : <div />}

      <footer className="mx-4 mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 sm:mx-5">
        <Target aria-hidden="true" className="size-6 shrink-0 text-accent" />
        <p className="line-clamp-2 text-base font-bold text-accent">学习目标：{page.learningGoal}</p>
      </footer>
    </article>
  );
}
