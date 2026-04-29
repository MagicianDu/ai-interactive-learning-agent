type CourseStatusBadgeProps = {
  generated: boolean;
};

export function CourseStatusBadge({ generated }: CourseStatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex h-6 items-center rounded-full border px-2 text-xs font-semibold",
        generated
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      ].join(" ")}
    >
      {generated ? "已生成" : "待生成"}
    </span>
  );
}
