import { useEffect, useState, type ReactNode } from "react";

import type { Lesson } from "../../schemas/lesson.schema";
import { PageDots } from "./PageDots";
import { PageNavigation } from "./PageNavigation";

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
    <div className="min-h-screen bg-[#f4f7fb] text-ink">
      <main className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 shadow-sm backdrop-blur">
          <div className="grid min-h-20 grid-cols-1 items-center gap-4 px-4 py-4 sm:px-8 lg:grid-cols-[minmax(16rem,1fr)_auto_minmax(16rem,1fr)] lg:px-10">
            <div>
              <h1 className="text-2xl font-bold text-ink sm:text-3xl">{lesson.title}</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{lesson.audience}</p>
            </div>

            <div className="flex flex-col items-center gap-2">
              {total > 0 ? (
                <PageDots currentIndex={displayedIndex} onSelect={goTo} total={total} />
              ) : null}
              <p className="text-base font-semibold text-ink">{pageCountLabel}</p>
            </div>

            <div className="justify-self-stretch lg:justify-self-end">
              <PageNavigation
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onBack={() => goTo(displayedIndex - 1)}
                onForward={() => goTo(displayedIndex + 1)}
              />
            </div>
          </div>
        </header>

        <section aria-live="polite" className="px-4 py-6 sm:px-8 lg:px-10">
          {total > 0 ? (
            renderPage(displayedIndex)
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
