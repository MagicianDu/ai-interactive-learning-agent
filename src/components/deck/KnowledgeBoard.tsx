import type { KnowledgeBoard as KnowledgeBoardData, VisualSpec } from "../../schemas/lesson.schema";

type KnowledgeBoardProps = {
  board: KnowledgeBoardData;
  visualSpec?: VisualSpec;
};

const emphasisClasses = {
  boundary: "border-amber-300 text-amber-800",
  definition: "border-sky-300 text-sky-800",
  example: "border-emerald-300 text-emerald-800",
  mechanism: "border-indigo-300 text-indigo-800",
  note: "border-slate-300 text-slate-700",
};

type BoardSection = KnowledgeBoardData["leftColumn"][number];

function BoardSectionNote({ section }: { section: BoardSection }) {
  return (
    <section className={`flex min-h-0 flex-1 flex-col justify-center border-l-2 py-1 pl-3 pr-1 ${emphasisClasses[section.emphasis ?? "note"]}`}>
      <h3 className="text-[11px] font-bold leading-4 text-current">
        {section.label}
      </h3>
      <div className="mt-1.5 grid gap-1.5 text-sm font-medium leading-5 text-slate-700">
        {section.items.map((item) => (
          <p className="flex gap-2" key={item}>
            <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-60" aria-hidden="true" />
            <span>{item}</span>
          </p>
        ))}
      </div>
    </section>
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
      <div className="aspect-video w-full bg-slate-100">
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
      <div className="grid min-h-0 gap-2 lg:grid-cols-[minmax(18rem,1.12fr)_minmax(0,0.88fr)] lg:items-stretch lg:gap-3">
        <VisualPanel board={board} visualSpec={visualSpec} />

        <section
          aria-label="知识板书正文区"
          className="flex h-full min-h-0 flex-col gap-3 rounded-md border border-slate-200 bg-white/75 p-3 shadow-sm"
        >
          {railSections.map((section) => (
            <BoardSectionNote key={`${section.label}-${section.items.join("|")}`} section={section} />
          ))}
        </section>
      </div>

      <p className="rounded-md border border-slate-900 bg-slate-950 px-3 py-2 text-sm font-bold leading-5 text-white lg:px-4 lg:text-sm lg:leading-6">
        {board.bottomLine}
      </p>
    </section>
  );
}
