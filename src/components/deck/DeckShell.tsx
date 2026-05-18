import { useEffect, useState, type ReactNode } from "react";

import type { Lesson } from "../../schemas/lesson.schema";
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
          <div className="flex min-h-14 items-center justify-end px-3 py-2 lg:min-h-16 lg:px-5 lg:py-3">
            <PageNavigation
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onBack={() => goTo(displayedIndex - 1)}
              onForward={() => goTo(displayedIndex + 1)}
            />
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
