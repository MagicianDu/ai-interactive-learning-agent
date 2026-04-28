import { useState } from "react";

import type { AssessmentSpec, FeedbackSpec } from "../../schemas/lesson.schema";
import { FeedbackPanel } from "./FeedbackPanel";

type MisconceptionCheckProps = {
  assessmentSpec: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
};

const choices = ["这个说法总是成立", "要看工作负载和查询形态"];

type FeedbackState = {
  tone: "correct" | "incorrect";
  title: string;
  message: string;
};

function getChoiceClass(isSelected: boolean) {
  return [
    "rounded-lg border px-4 py-3 text-left text-sm font-semibold transition",
    "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
    isSelected
      ? "border-accent bg-teal-50 text-ink shadow-sm"
      : "border-line bg-white text-slate-700 hover:border-accent hover:bg-slate-50"
  ].join(" ");
}

function getCorrectChoice(assessmentSpec: AssessmentSpec) {
  return assessmentSpec.correctAnswer ?? choices[1];
}

export function MisconceptionCheck({ assessmentSpec, feedbackSpec }: MisconceptionCheckProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const correctChoice = getCorrectChoice(assessmentSpec);
  const isCorrect = selectedChoice === correctChoice;
  const feedback: FeedbackState | null =
    selectedChoice === null
      ? null
      : {
          tone: isCorrect ? "correct" : "incorrect",
          title: isCorrect ? "判断到位" : "误区已暴露",
          message: isCorrect
            ? feedbackSpec?.correctFeedback ??
              "更可靠的规则是条件性的：只有当查询能有效使用索引，并且收益超过维护成本时，索引才值得。"
            : feedbackSpec?.incorrectFeedback ??
              "这个假设太绝对了。索引价值取决于查询形态、选择性、写入频率和存储成本。"
        };

  return (
    <div className="grid gap-5 rounded-lg border border-line bg-white p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-signal">
          误区检查
        </p>
        <h3 className="mt-2 text-xl font-semibold text-ink">{assessmentSpec.prompt}</h3>
      </div>

      <div className="grid gap-3" role="group" aria-label="误区判断选项">
        {choices.map((choice) => {
          const isSelected = selectedChoice === choice;

          return (
            <button
              aria-pressed={isSelected}
              className={getChoiceClass(isSelected)}
              key={choice}
              onClick={() => setSelectedChoice(choice)}
              type="button"
            >
              {choice}
            </button>
          );
        })}
      </div>

      {feedback ? (
        <FeedbackPanel tone={feedback.tone} title={feedback.title}>
          {feedback.message}
        </FeedbackPanel>
      ) : null}
    </div>
  );
}
