import { useState } from "react";

import type { InteractionOption, InteractionSpec } from "../../schemas/lesson.schema";
import { FeedbackPanel } from "../assessment/FeedbackPanel";

type IndexTradeoffCheckerProps = {
  interactionSpec: InteractionSpec;
};

type FeedbackTone = "neutral" | "correct" | "incorrect";

function mapResultTone(resultTone: InteractionOption["resultTone"]): FeedbackTone {
  if (resultTone === "success") {
    return "correct";
  }

  if (resultTone === "danger") {
    return "incorrect";
  }

  return "neutral";
}

function getOptionClass(isSelected: boolean) {
  return [
    "rounded-lg border px-4 py-3 text-left text-sm font-semibold transition",
    "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
    isSelected
      ? "border-accent bg-teal-50 text-ink shadow-sm"
      : "border-line bg-white text-slate-700 hover:border-accent hover:bg-slate-50"
  ].join(" ");
}

export function IndexTradeoffChecker({ interactionSpec }: IndexTradeoffCheckerProps) {
  const options = interactionSpec.options ?? [];
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-slate-50 p-5 text-sm text-slate-600">
        这个互动还没有配置索引权衡选项。
      </div>
    );
  }

  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null;

  return (
    <div className="grid gap-5 rounded-lg border border-line bg-white p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-signal">
          索引权衡判断
        </p>
        <h3 className="mt-2 text-xl font-semibold text-ink">
          {interactionSpec.learnerAction}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {interactionSpec.cognitivePurpose || interactionSpec.expectedObservation}
        </p>
      </div>

      <div className="grid gap-3" role="group" aria-label="索引权衡选项">
        {options.map((option) => {
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              aria-pressed={isSelected}
              className={getOptionClass(isSelected)}
              key={option.id}
              onClick={() => setSelectedOptionId(option.id)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {selectedOption ? (
        <FeedbackPanel
          tone={mapResultTone(selectedOption.resultTone)}
          title={selectedOption.resultTitle}
        >
          {selectedOption.explanation}
        </FeedbackPanel>
      ) : null}
    </div>
  );
}
