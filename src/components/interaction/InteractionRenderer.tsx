import type { InteractionSpec } from "../../schemas/lesson.schema";
import { IndexTradeoffChecker } from "./IndexTradeoffChecker";
import { QueryPathVisualizer } from "./QueryPathVisualizer";

type InteractionRendererProps = {
  interactionSpec?: InteractionSpec;
};

function GenericInteractionPanel({ interactionSpec }: { interactionSpec: InteractionSpec }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        互动模型
      </p>
      <h3 className="mt-2 text-xl font-semibold text-ink">
        {interactionSpec.learnerAction}
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {interactionSpec.expectedObservation}
      </p>
    </div>
  );
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
