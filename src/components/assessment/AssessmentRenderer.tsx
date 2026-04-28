import type { AssessmentSpec, FeedbackSpec } from "../../schemas/lesson.schema";
import { MisconceptionCheck } from "./MisconceptionCheck";
import { MultipleChoiceQuiz } from "./MultipleChoiceQuiz";
import { PredictionPrompt } from "./PredictionPrompt";
import { TransferChallenge } from "./TransferChallenge";

type AssessmentRendererProps = {
  assessmentSpec: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
};

function UnsupportedAssessment({ assessmentSpec }: { assessmentSpec: AssessmentSpec }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-5 text-slate-800">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        暂未实现的评估类型
      </p>
      <h3 className="mt-2 text-xl font-semibold text-ink">{assessmentSpec.prompt}</h3>
      <p className="mt-3 text-sm leading-6">
        "{assessmentSpec.kind}" 已经在 lesson schema 中定义，但当前 Web Deck 渲染器还没有支持。
      </p>
    </div>
  );
}

export function AssessmentRenderer({
  assessmentSpec,
  feedbackSpec
}: AssessmentRendererProps) {
  if (assessmentSpec.kind === "prediction") {
    return <PredictionPrompt assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />;
  }

  if (assessmentSpec.kind === "multiple_choice") {
    return <MultipleChoiceQuiz assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />;
  }

  if (assessmentSpec.kind === "transfer") {
    return <TransferChallenge assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />;
  }

  if (assessmentSpec.kind === "true_false") {
    return <MisconceptionCheck assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />;
  }

  return <UnsupportedAssessment assessmentSpec={assessmentSpec} />;
}
