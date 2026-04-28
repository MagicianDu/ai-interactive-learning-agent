type FeedbackPanelProps = {
  tone: "neutral" | "correct" | "incorrect";
  title: string;
  children: string;
};

const toneClasses: Record<FeedbackPanelProps["tone"], string> = {
  neutral: "border-line bg-slate-50 text-slate-800",
  correct: "border-emerald-200 bg-emerald-50 text-emerald-950",
  incorrect: "border-amber-200 bg-amber-50 text-amber-950"
};

const titleClasses: Record<FeedbackPanelProps["tone"], string> = {
  neutral: "text-slate-900",
  correct: "text-emerald-900",
  incorrect: "text-amber-900"
};

export function FeedbackPanel({ tone, title, children }: FeedbackPanelProps) {
  return (
    <section
      aria-live="polite"
      className={`rounded-lg border p-4 ${toneClasses[tone]}`}
    >
      <h3 className={`text-base font-semibold ${titleClasses[tone]}`}>{title}</h3>
      <p className="mt-2 text-sm leading-6">{children}</p>
    </section>
  );
}
