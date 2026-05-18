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
    "inline-flex min-h-9 items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm font-semibold opacity-25 shadow-none transition duration-150 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent/70 focus:ring-offset-0 active:opacity-100 disabled:cursor-not-allowed disabled:opacity-10 sm:min-h-10 sm:px-4 lg:min-h-11 lg:px-4 lg:py-2 lg:text-sm";

  return (
    <nav
      aria-label="课程翻页"
      className="flex items-center justify-end gap-2 rounded-full border border-transparent bg-transparent p-1.5 shadow-none backdrop-blur-0 transition duration-150 hover:border-white/70 hover:bg-white/60 hover:shadow-xl hover:shadow-slate-900/10 hover:backdrop-blur-md focus-within:border-white/70 focus-within:bg-white/60 focus-within:shadow-xl focus-within:shadow-slate-900/10 focus-within:backdrop-blur-md lg:gap-2"
    >
      <button
        className={`${buttonClass} border-transparent bg-transparent text-slate-700 hover:border-accent/60 hover:bg-white/90 hover:text-accent hover:opacity-100 hover:shadow-sm active:bg-white disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-slate-700 disabled:hover:shadow-none`}
        disabled={!canGoBack}
        onClick={onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">上一页</span>
      </button>
      <button
        className={`${buttonClass} border-transparent bg-transparent text-accent hover:border-accent/80 hover:bg-accent/90 hover:text-white hover:opacity-100 hover:shadow-sm active:bg-accent disabled:border-transparent disabled:bg-transparent disabled:text-slate-500 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:shadow-none`}
        disabled={!canGoForward}
        onClick={onForward}
        type="button"
      >
        <span className="hidden sm:inline">下一页</span>
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}
