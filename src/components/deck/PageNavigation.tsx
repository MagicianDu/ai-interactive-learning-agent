import { ArrowLeft, ArrowRight } from "lucide-react";

type PageNavigationProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
};

export function PageNavigation({
  canGoBack,
  canGoForward,
  onBack,
  onForward
}: PageNavigationProps) {
  const buttonClass =
    "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 sm:px-4 lg:min-h-12 lg:px-5 lg:py-2 lg:text-base";

  return (
    <nav aria-label="课程翻页" className="flex items-center justify-end gap-2 lg:gap-3">
      <button
        className={`${buttonClass} border-line bg-white text-ink hover:border-accent hover:text-accent disabled:hover:border-line disabled:hover:text-ink`}
        disabled={!canGoBack}
        onClick={onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        <span>上一页</span>
      </button>
      <button
        className={`${buttonClass} border-accent bg-accent text-white hover:bg-blue-700 disabled:border-line disabled:bg-slate-200 disabled:text-slate-500`}
        disabled={!canGoForward}
        onClick={onForward}
        type="button"
      >
        <span>下一页</span>
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}
