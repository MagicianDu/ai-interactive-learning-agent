import { useState } from "react";

import type { AssessmentSpec, FeedbackSpec } from "../../schemas/lesson.schema";
import { FeedbackPanel } from "./FeedbackPanel";

type PredictionPromptProps = {
  assessmentSpec: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
};

type FeedbackState = {
  tone: "neutral" | "correct" | "incorrect";
  title: string;
  message: string;
};

function getPredictionOptionClass(isSelected: boolean) {
  return [
    "rounded-lg border px-4 py-3 text-left text-sm font-semibold transition",
    "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
    isSelected
      ? "border-accent bg-teal-50 text-ink shadow-sm"
      : "border-line bg-white text-slate-700 hover:border-accent hover:bg-slate-50"
  ].join(" ");
}

function buildPredictionFeedback(
  selectedOption: string,
  assessmentSpec: AssessmentSpec,
  feedbackSpec?: FeedbackSpec
): FeedbackState {
  if (!assessmentSpec.correctAnswer) {
    return {
      tone: "neutral",
      title: "已记录预测",
      message:
        feedbackSpec?.correctFeedback ??
        "现在把你的预测和模型展示的机制对照起来看。"
    };
  }

  const isCorrect = selectedOption === assessmentSpec.correctAnswer;

  if (isCorrect) {
    return {
      tone: "correct",
      title: "预测正确",
      message:
        feedbackSpec?.correctFeedback ??
        "你的预测符合系统实际采用的路径。"
    };
  }

  return {
    tone: "incorrect",
    title: "预测偏离",
    message:
      feedbackSpec?.incorrectFeedback ??
      "系统走了另一条路径，因为某个条件改变了可用的快捷路径。"
  };
}

export function PredictionPrompt({ assessmentSpec, feedbackSpec }: PredictionPromptProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const options = assessmentSpec.options ?? [];
  const feedback = selectedOption
    ? buildPredictionFeedback(selectedOption, assessmentSpec, feedbackSpec)
    : null;

  return (
    <div className="grid gap-5 rounded-lg border border-line bg-white p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-signal">
          预测任务
        </p>
        <h3 className="mt-2 text-xl font-semibold text-ink">{assessmentSpec.prompt}</h3>
      </div>

      <div className="grid gap-3" role="group" aria-label="预测选项">
        {options.map((option) => {
          const isSelected = selectedOption === option;

          return (
            <button
              aria-pressed={isSelected}
              className={getPredictionOptionClass(isSelected)}
              key={option}
              onClick={() => setSelectedOption(option)}
              type="button"
            >
              {option}
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
