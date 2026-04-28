import { useId, useState } from "react";

import type { AssessmentSpec, FeedbackSpec } from "../../schemas/lesson.schema";
import { FeedbackPanel } from "./FeedbackPanel";

type TransferChallengeProps = {
  assessmentSpec: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
};

export function TransferChallenge({ assessmentSpec, feedbackSpec }: TransferChallengeProps) {
  const [response, setResponse] = useState("");
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const responseId = useId();
  const hasAttempt = response.trim().length > 0;
  const modelAnswer =
    assessmentSpec.correctAnswer ??
    feedbackSpec?.correctFeedback ??
    "好的答案会先说明工作负载，再判断查询是否能选择性地使用索引，最后权衡读性能收益、写入维护成本和存储成本。";

  return (
    <div className="grid gap-5 rounded-lg border border-line bg-white p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          迁移挑战
        </p>
        <h3 className="mt-2 text-xl font-semibold text-ink">{assessmentSpec.prompt}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          先写下你的推理，再和参考答案对照。
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor={responseId}>
          你的解释
        </label>
        <textarea
          className="min-h-32 rounded-lg border border-line bg-white px-4 py-3 text-sm leading-6 text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          id={responseId}
          onChange={(event) => setResponse(event.target.value)}
          placeholder="说明访问路径发生了什么变化、为什么有帮助或没帮助，以及你会检查哪些成本。"
          value={response}
        />
      </div>

      <div>
        <button
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          disabled={!hasAttempt}
          onClick={() => {
            if (hasAttempt) {
              setShowModelAnswer(true);
            }
          }}
          type="button"
        >
          查看参考答案
        </button>
      </div>

      {showModelAnswer ? (
        <FeedbackPanel tone="neutral" title="参考答案">
          {modelAnswer}
        </FeedbackPanel>
      ) : null}
    </div>
  );
}
