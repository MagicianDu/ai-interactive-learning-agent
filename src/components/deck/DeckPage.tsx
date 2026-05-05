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
    <article className="mx-auto grid max-w-[1500px] grid-rows-[auto_auto_minmax(0,1fr)] rounded-lg border border-line bg-white shadow-lesson">
      <header className="flex flex-col gap-2 border-b border-line px-3 py-2 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-xl font-extrabold leading-none text-white shadow-lg shadow-accent/20 lg:size-12 lg:text-2xl">
            {String(pageNumber).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">
              第 {pageNumber} / {totalPages} 页
            </p>
            <h2 className="mt-0.5 text-xl font-bold leading-tight text-ink lg:text-2xl">
              {page.title}
            </h2>
          </div>
        </div>

        <span className="w-fit rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-600">
          {pageType}
        </span>
      </header>

      <div className="border-b border-line bg-slate-50/70 px-3 py-2 sm:px-4 lg:px-5 lg:py-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:gap-3">
          <section className="flex min-w-0 items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 lg:px-4 lg:py-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white">
              <HelpCircle aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-bold leading-6 text-ink lg:text-base">{page.narrative}</p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white px-3 py-2 lg:px-4 lg:py-3">
            <div className="flex items-center gap-2">
              <Target aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <p className="text-sm font-extrabold text-ink">本页要抓住</p>
            </div>
            <div className="mt-2 grid gap-1.5 text-xs font-semibold leading-5 text-slate-700 lg:text-sm">
              <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-accent">
                {page.learningGoal}
              </p>
            </div>
          </section>
        </div>
      </div>

      {children ? <div className="min-h-0 px-3 pb-3 sm:px-4 lg:px-5">{children}</div> : <div />}
    </article>
  );
}
