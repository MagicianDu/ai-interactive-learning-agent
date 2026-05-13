import type { KnowledgeBoard as KnowledgeBoardData, VisualSpec } from "../../schemas/lesson.schema";

type KnowledgeBoardProps = {
  board: KnowledgeBoardData;
  visualSpec?: VisualSpec;
};

const emphasisClasses = {
  boundary: "border-amber-200 bg-amber-50 text-amber-900",
  definition: "border-sky-200 bg-sky-50 text-sky-900",
  example: "border-emerald-200 bg-emerald-50 text-emerald-900",
  mechanism: "border-indigo-200 bg-indigo-50 text-indigo-900",
  note: "border-slate-200 bg-slate-50 text-slate-800",
};

function boardKindLabel(kind: KnowledgeBoardData["boardKind"]): string {
  const labels: Record<KnowledgeBoardData["boardKind"], string> = {
    boundary_board: "边界板书",
    comparison_board: "比较板书",
    definition_board: "定义板书",
    evidence_board: "证据板书",
    example_board: "例题板书",
    mechanism_board: "机制板书",
    synthesis_board: "综合板书",
  };

  return labels[kind];
}

type BoardSection = KnowledgeBoardData["leftColumn"][number];

function BoardSectionCard({ section }: { section: BoardSection }) {
  return (
    <div className="rounded-md border border-line bg-white p-2 shadow-sm lg:p-2.5">
      <div
        className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${emphasisClasses[section.emphasis ?? "note"]}`}
      >
        {section.label}
      </div>
      <ul className="mt-2 grid gap-1.5 text-sm font-medium leading-5 text-slate-700">
        {section.items.map((item) => (
          <li className="flex gap-2" key={item}>
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoardIntroCard({ board }: { board: KnowledgeBoardData }) {
  return (
    <div className="rounded-md border border-line bg-white p-2 shadow-sm lg:p-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{boardKindLabel(board.boardKind)}</p>
      <h3 className="mt-1 text-base font-extrabold leading-5 text-ink">{board.headline}</h3>
      <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-800">{board.coreProposition}</p>
    </div>
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function VisualPanel({ board, visualSpec }: { board: KnowledgeBoardData; visualSpec?: VisualSpec }) {
  if (!isNonEmptyString(visualSpec?.imageUrl)) {
    return null;
  }

  return (
    <figure aria-label="知识板书视觉区" className="overflow-hidden rounded-md border border-line bg-white shadow-sm">
      <div className="h-[clamp(13rem,18vw,15rem)] w-full bg-slate-100 lg:h-[clamp(13rem,16vw,14.5rem)]">
        <img
          alt={isNonEmptyString(visualSpec.imageAlt) ? visualSpec.imageAlt : board.headline}
          className="h-full w-full object-contain"
          src={visualSpec.imageUrl}
        />
      </div>
    </figure>
  );
}

export function KnowledgeBoard({ board, visualSpec }: KnowledgeBoardProps) {
  const railSections = [...board.leftColumn, ...board.rightColumn];

  return (
    <section
      className="grid min-h-0 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 lg:gap-3 lg:p-3"
      data-testid="knowledge-board"
    >
      <div className="grid min-h-0 gap-2 lg:grid-cols-[minmax(18rem,1.12fr)_minmax(0,0.88fr)] lg:items-start lg:gap-3">
        <VisualPanel board={board} visualSpec={visualSpec} />

        <section aria-label="知识板书正文区" className="grid min-h-0 content-start gap-2">
          <BoardIntroCard board={board} />
          {railSections.map((section) => (
            <BoardSectionCard key={`${section.label}-${section.items.join("|")}`} section={section} />
          ))}
        </section>
      </div>

      <p className="rounded-md border border-slate-900 bg-slate-950 px-3 py-2 text-sm font-bold leading-5 text-white lg:px-4 lg:text-sm lg:leading-6">
        {board.bottomLine}
      </p>
    </section>
  );
}
