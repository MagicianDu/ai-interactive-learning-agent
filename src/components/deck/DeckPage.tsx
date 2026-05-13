import type { ReactNode } from "react";

import type { LessonPage } from "../../schemas/lesson.schema";

type DeckPageProps = {
  page: LessonPage;
  pageNumber: number;
  totalPages: number;
  children?: ReactNode;
};

export function DeckPage({ page, pageNumber, totalPages, children }: DeckPageProps) {
  return (
    <article className="mx-auto grid max-w-[1500px] grid-rows-[auto_auto_minmax(0,1fr)] rounded-lg border border-line bg-white shadow-lesson">
      <header className="border-b border-line px-4 py-3 sm:px-5 lg:px-7 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-950 text-lg font-extrabold leading-none text-white lg:size-12 lg:text-xl">
            {String(pageNumber).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">
              第 {pageNumber} / {totalPages} 页
            </p>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight text-ink lg:text-3xl">
              {page.title}
            </h2>
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-white px-4 py-3 sm:px-5 lg:px-7 lg:py-4">
        <p className="max-w-5xl text-base font-semibold leading-7 text-slate-800 lg:text-lg lg:leading-8">{page.narrative}</p>
      </div>

      {children ? <div className="min-h-0 px-4 pb-4 pt-3 sm:px-5 lg:px-7">{children}</div> : <div />}
    </article>
  );
}
