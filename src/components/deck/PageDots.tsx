type PageDotsProps = {
  total: number;
  currentIndex: number;
  onSelect: (index: number) => void;
};

export function PageDots({ total, currentIndex, onSelect }: PageDotsProps) {
  return (
    <nav aria-label="页面选择器" className="flex flex-wrap items-center justify-center gap-0">
      {Array.from({ length: Math.max(total, 0) }, (_, index) => {
        const isCurrent = index === currentIndex;
        const isBeforeCurrent = index < currentIndex;

        return (
          <div className="flex items-center" key={index}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={[
                  "h-0.5 w-4 rounded-full sm:w-7 lg:h-1 lg:w-10",
                  index <= currentIndex ? "bg-accent/70" : "bg-line"
                ].join(" ")}
              />
            ) : null}
            <button
              aria-current={isCurrent ? "page" : undefined}
              aria-label={`跳转到第 ${index + 1} 页`}
              className={[
                "flex size-7 items-center justify-center rounded-full border text-xs font-bold transition sm:size-8 lg:size-9 lg:text-sm",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                isCurrent
                  ? "border-accent bg-accent text-white shadow-lg shadow-accent/25"
                  : isBeforeCurrent
                    ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
                    : "border-line bg-slate-100 text-slate-400 hover:border-accent hover:text-accent"
              ].join(" ")}
              onClick={() => onSelect(index)}
              type="button"
            >
              {isCurrent ? index + 1 : ""}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
