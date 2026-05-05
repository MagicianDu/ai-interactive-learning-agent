import { useEffect, useState, type ReactNode } from "react";

import type { Lesson } from "../../schemas/lesson.schema";
import { PageDots } from "./PageDots";
import { PageNavigation } from "./PageNavigation";
import { ViewportFit } from "./ViewportFit";

type DeckShellProps = {
  initialPageIndex?: number;
  lesson: Lesson;
  onPageChange?: (pageIndex: number) => void;
  renderPage: (currentIndex: number) => ReactNode;
};

export function DeckShell({ initialPageIndex = 0, lesson, onPageChange, renderPage }: DeckShellProps) {
  const [currentIndex, setCurrentIndex] = useState(initialPageIndex);
  const total = lesson.pages.length;
  const displayedIndex = total > 0 ? Math.min(currentIndex, total - 1) : 0;
  const pageCountLabel =
    total > 0 ? `第 ${displayedIndex + 1} / ${total} 页` : "暂无页面";

  const goTo = (index: number) => {
    const lastIndex = Math.max(total - 1, 0);
    const nextIndex = Math.min(Math.max(index, 0), lastIndex);
    setCurrentIndex(nextIndex);
    onPageChange?.(nextIndex);
  };

  useEffect(() => {
    goTo(initialPageIndex);
  }, [initialPageIndex, lesson.id, total]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(displayedIndex + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(displayedIndex - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [displayedIndex, total]);

  const canGoBack = total > 0 && displayedIndex > 0;
  const canGoForward = total > 0 && displayedIndex < total - 1;

  return (
    <div className="h-full min-h-0 overflow-hidden bg-[#f4f7fb] text-ink">
      <main className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <header className="border-b border-line bg-white/95 shadow-sm">
          <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 lg:min-h-16 lg:grid-cols-[minmax(12rem,1fr)_auto_minmax(12rem,1fr)] lg:gap-4 lg:px-5 lg:py-3">
            <div className="min-w-0">
              <h1 className="text-sm font-bold leading-5 text-ink lg:text-lg">{lesson.title}</h1>
              <p className="mt-0.5 hidden text-xs font-medium leading-4 text-slate-500 sm:block">{lesson.audience}</p>
            </div>

            <div className="flex flex-col items-center gap-1 lg:gap-2">
              {total > 0 ? (
                <PageDots currentIndex={displayedIndex} onSelect={goTo} total={total} />
              ) : null}
              <p className="text-xs font-semibold text-ink lg:text-sm">{pageCountLabel}</p>
            </div>

            <div className="col-span-2 justify-self-stretch lg:col-span-1 lg:justify-self-end">
              <PageNavigation
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onBack={() => goTo(displayedIndex - 1)}
                onForward={() => goTo(displayedIndex + 1)}
              />
            </div>
          </div>
        </header>

        <section
          aria-live="polite"
          className="min-h-0 overflow-hidden"
          data-testid="deck-page-stage"
        >
          {total > 0 ? (
            <ViewportFit>{renderPage(displayedIndex)}</ViewportFit>
          ) : (
            <div className="mx-auto max-w-5xl rounded-lg border border-line bg-white p-8 shadow-lesson">
              <h2 className="text-2xl font-semibold text-ink">课程还没有页面</h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                请先在结构化 lesson 数据中添加页面，再渲染这个互动课程。
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
