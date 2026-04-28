type ProgressBarProps = {
  currentIndex: number;
  total: number;
};

export function ProgressBar({ currentIndex, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 0);
  const currentValue =
    total <= 0 ? 0 : Math.min(Math.max(currentIndex + 1, 0), safeTotal);
  const progress = total <= 0 ? 0 : (currentValue / safeTotal) * 100;

  return (
    <div
      aria-label="课程进度"
      aria-valuemax={safeTotal}
      aria-valuemin={0}
      aria-valuenow={currentValue}
      className="h-2 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
