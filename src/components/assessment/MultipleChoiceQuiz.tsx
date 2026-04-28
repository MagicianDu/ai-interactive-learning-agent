import { useState } from "react";

import type { AssessmentSpec, FeedbackSpec } from "../../schemas/lesson.schema";
import { FeedbackPanel } from "./FeedbackPanel";

type MultipleChoiceQuizProps = {
  assessmentSpec: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
};

type FeedbackState = {
  tone: "neutral" | "correct" | "incorrect";
  title: string;
  message: string;
};

function getOptionClass(isSelected: boolean) {
  return [
    "rounded-lg border px-4 py-3 text-left text-sm font-semibold transition",
    "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
    isSelected
      ? "border-accent bg-teal-50 text-ink shadow-sm"
      : "border-line bg-white text-slate-700 hover:border-accent hover:bg-slate-50"
  ].join(" ");
}

function buildFeedback(
  selectedOption: string,
  assessmentSpec: AssessmentSpec,
  feedbackSpec?: FeedbackSpec
): FeedbackState {
  if (!assessmentSpec.correctAnswer) {
    return {
      tone: "neutral",
      title: "已记录回答",
      message:
        feedbackSpec?.correctFeedback ??
        "请用反馈解释对照你的推理和目标心智模型。"
    };
  }

  const isCorrect = selectedOption === assessmentSpec.correctAnswer;

  if (isCorrect) {
    return {
      tone: "correct",
      title: "回答正确",
      message:
        feedbackSpec?.correctFeedback ??
        "这个答案符合本检查点要测试的因果模型。"
    };
  }

  return {
    tone: "incorrect",
    title: "还差一步",
    message:
      feedbackSpec?.incorrectFeedback ??
      "请回到关键条件：这个快捷路径到底是否能被当前查询使用。"
  };
}

export function MultipleChoiceQuiz({ assessmentSpec, feedbackSpec }: MultipleChoiceQuizProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const options = assessmentSpec.options ?? [];
  const feedback = selectedOption
    ? buildFeedback(selectedOption, assessmentSpec, feedbackSpec)
    : null;

  return (
    <div className="grid gap-5 rounded-lg border border-line bg-white p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">理解检查</p>
        <h3 className="mt-2 text-xl font-semibold text-ink">{assessmentSpec.prompt}</h3>
      </div>

      <div className="grid gap-3" role="group" aria-label="答案选项">
        {options.map((option) => {
          const isSelected = selectedOption === option;

          return (
            <button
              aria-pressed={isSelected}
              className={getOptionClass(isSelected)}
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
