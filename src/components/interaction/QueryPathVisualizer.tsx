import { useState } from "react";

import type { InteractionOption, InteractionSpec } from "../../schemas/lesson.schema";
import { FeedbackPanel } from "../assessment/FeedbackPanel";

type QueryPathVisualizerProps = {
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

export function QueryPathVisualizer({ interactionSpec }: QueryPathVisualizerProps) {
  const options = interactionSpec.options ?? [];
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isFeedbackRevealed, setIsFeedbackRevealed] = useState(false);

  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-slate-50 p-5 text-sm text-slate-600">
        这个互动还没有配置查询路径选项。
      </div>
    );
  }

  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null;

  function selectOption(optionId: string) {
    setSelectedOptionId(optionId);
    setIsFeedbackRevealed(false);
  }

  return (
    <div className="grid gap-5 rounded-lg border border-line bg-white p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          查询路径可视化
        </p>
        <h3 className="mt-2 text-xl font-semibold text-ink">
          {interactionSpec.learnerAction}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {interactionSpec.cognitivePurpose || interactionSpec.expectedObservation}
        </p>
      </div>

      <div className="grid gap-3" role="group" aria-label="查询条件选项">
        {options.map((option) => {
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              aria-pressed={isSelected}
              className={getOptionClass(isSelected)}
              key={option.id}
              onClick={() => selectOption(option.id)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <button
        className={[
          "w-fit rounded-lg px-4 py-2 text-sm font-semibold transition",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
          selectedOption
            ? "bg-ink text-white hover:bg-slate-700"
            : "cursor-not-allowed bg-slate-200 text-slate-500"
        ].join(" ")}
        disabled={!selectedOption}
        onClick={() => setIsFeedbackRevealed(true)}
        type="button"
      >
        检查路径
      </button>

      {selectedOption && isFeedbackRevealed ? (
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
