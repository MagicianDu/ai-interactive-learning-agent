type ConceptEdgeProps = {
  from: string;
  to: string;
  label?: string;
};

export function ConceptEdge({ from, to, label = "关联" }: ConceptEdgeProps) {
  return (
    <li className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">{from}</span>
      <span className="mx-2 text-slate-400">→</span>
      <span className="font-semibold text-slate-800">{to}</span>
      <span className="ml-2 text-slate-400">{label}</span>
    </li>
  );
}
