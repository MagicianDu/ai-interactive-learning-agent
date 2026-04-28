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
    <article className="mx-auto max-w-[1500px] overflow-hidden rounded-lg border border-line bg-white shadow-lesson">
      <header className="flex flex-col gap-5 border-b border-line px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-accent text-4xl font-extrabold leading-none text-white shadow-lg shadow-accent/25">
            {String(pageNumber).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-500">
              第 {pageNumber} / {totalPages} 页
            </p>
            <h2 className="mt-1 text-3xl font-bold leading-tight text-ink sm:text-4xl">
              {page.title}
            </h2>
          </div>
        </div>

        <span className="w-fit rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-lg font-bold text-red-600">
          {pageType}
        </span>
      </header>

      <div className="px-5 py-5 sm:px-7">
        <section className="flex items-start gap-4 rounded-lg border border-blue-200 bg-blue-50/60 px-5 py-4">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white">
            <HelpCircle aria-hidden="true" className="size-6" />
          </span>
          <p className="text-xl font-bold leading-8 text-ink">{page.narrative}</p>
        </section>
      </div>

      {children ? <div className="px-5 pb-5 sm:px-7">{children}</div> : null}

      <footer className="mx-5 mb-5 flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50/70 px-5 py-4 sm:mx-7">
        <Target aria-hidden="true" className="size-9 shrink-0 text-accent" />
        <p className="text-xl font-bold text-accent">学习目标：{page.learningGoal}</p>
      </footer>
    </article>
  );
}
