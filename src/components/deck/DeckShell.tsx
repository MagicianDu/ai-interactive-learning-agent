import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Code2,
  Menu,
  MessageCircle,
  Settings
} from "lucide-react";

import type { Lesson } from "../../schemas/lesson.schema";
import { PageDots } from "./PageDots";
import { PageNavigation } from "./PageNavigation";

type DeckShellProps = {
  lesson: Lesson;
  renderPage: (currentIndex: number) => ReactNode;
};

const sidebarItems = [
  { label: "学习", icon: BookOpen, active: true },
  { label: "实验", icon: Code2, active: false },
  { label: "练习", icon: BarChart3, active: false },
  { label: "讨论", icon: MessageCircle, active: false },
  { label: "设置", icon: Settings, active: false }
];

export function DeckShell({ lesson, renderPage }: DeckShellProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = lesson.pages.length;
  const displayedIndex = total > 0 ? Math.min(currentIndex, total - 1) : 0;
  const pageCountLabel =
    total > 0 ? `第 ${displayedIndex + 1} / ${total} 页` : "暂无页面";

  const goTo = (index: number) => {
    const lastIndex = Math.max(total - 1, 0);
    setCurrentIndex(Math.min(Math.max(index, 0), lastIndex));
  };

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
        setCurrentIndex((current) => Math.min(current + 1, Math.max(total - 1, 0)));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [total]);

  const canGoBack = total > 0 && displayedIndex > 0;
  const canGoForward = total > 0 && displayedIndex < total - 1;

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center bg-[#041a34] py-7 text-white shadow-2xl sm:flex">
        <button
          aria-label="打开课程菜单"
          className="mb-8 grid size-11 place-items-center rounded-xl text-white/90 transition hover:bg-white/10"
          type="button"
        >
          <Menu aria-hidden="true" className="size-7" />
        </button>

        <nav aria-label="学习模式" className="flex flex-1 flex-col items-center gap-5">
          {sidebarItems.slice(0, 4).map((item) => {
            const Icon = item.icon;

            return (
              <button
                aria-current={item.active ? "page" : undefined}
                className={[
                  "grid w-full place-items-center gap-1 border-l-4 py-2 text-xs font-semibold transition",
                  item.active
                    ? "border-accent text-white"
                    : "border-transparent text-white/70 hover:text-white"
                ].join(" ")}
                key={item.label}
                type="button"
              >
                <Icon aria-hidden="true" className="size-6" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          className="grid w-full place-items-center gap-1 border-l-4 border-transparent py-2 text-xs font-semibold text-white/70 transition hover:text-white"
          type="button"
        >
          <Settings aria-hidden="true" className="size-6" />
          <span>设置</span>
        </button>
      </aside>

      <main className="min-h-screen sm:pl-20">
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
