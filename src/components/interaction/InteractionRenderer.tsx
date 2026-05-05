import { useState } from "react";

import type { InteractionSpec } from "../../schemas/lesson.schema";
import { IndexTradeoffChecker } from "./IndexTradeoffChecker";
import { QueryPathVisualizer } from "./QueryPathVisualizer";

type InteractionRendererProps = {
  interactionSpec?: InteractionSpec;
};

function GenericInteractionPanel({ interactionSpec }: { interactionSpec: InteractionSpec }) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const selectedOption = interactionSpec.options?.find((option) => option.id === selectedOptionId);
  const hasOptions = Boolean(interactionSpec.options?.length);

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div
        className={[
          "grid gap-3",
          hasOptions ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(18rem,1fr)]" : ""
        ].join(" ")}
        data-testid={hasOptions ? "choice-interaction-layout" : undefined}
      >
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            互动模型
          </p>
          <h3 className="mt-1 text-lg font-bold leading-6 text-ink">
            {interactionSpec.learnerAction}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {interactionSpec.expectedObservation}
          </p>
          <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-700">
            {interactionSpec.cognitivePurpose}
          </p>
        </section>

        {hasOptions ? (
          <section>
            <div className="grid gap-2">
              {interactionSpec.options?.map((option) => (
                <button
                  aria-pressed={option.id === selectedOptionId}
                  className={[
                    "rounded-md border px-3 py-2 text-left text-sm font-bold leading-5 transition",
                    option.id === selectedOptionId
                      ? "border-accent bg-blue-50 text-accent"
                      : "border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50"
                  ].join(" ")}
                  key={option.id}
                  onClick={() => setSelectedOptionId(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            {selectedOption ? (
              <section
                aria-live="polite"
                className={[
                  "mt-2 rounded-lg border px-4 py-3",
                  getResultToneClass(selectedOption.resultTone)
                ].join(" ")}
              >
                <h4 className="text-sm font-extrabold">{selectedOption.resultTitle}</h4>
                <p className="mt-1 text-sm font-medium leading-6">{selectedOption.explanation}</p>
              </section>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function getResultToneClass(tone: NonNullable<InteractionSpec["options"]>[number]["resultTone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "danger":
      return "border-red-200 bg-red-50 text-red-950";
    case "neutral":
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export function InteractionRenderer({ interactionSpec }: InteractionRendererProps) {
  if (!interactionSpec) {
    return null;
  }

  if (interactionSpec.kind === "index_tradeoff") {
    return <IndexTradeoffChecker interactionSpec={interactionSpec} />;
  }

  if (interactionSpec.kind === "query_path") {
    return <QueryPathVisualizer interactionSpec={interactionSpec} />;
  }

  return <GenericInteractionPanel interactionSpec={interactionSpec} />;
}
