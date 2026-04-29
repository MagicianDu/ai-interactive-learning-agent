import { CheckCircle2, CircleDashed, PlayCircle } from "lucide-react";

import type { DemoBetaStatus } from "./demoBetaStatus";

type GenerationTimelineProps = {
  status: DemoBetaStatus;
};

const generationStages = [
  { id: "source-map", label: "资料解析", gate: "source-map" },
  { id: "concept-map", label: "概念图谱", gate: "concept-map" },
  { id: "curriculum-plan", label: "课程规划", gate: "curriculum-plan" },
  { id: "unit-generation", label: "单元生成", gate: "child-runs" },
  { id: "quality-review", label: "质量检查", gate: "critic-report" },
  { id: "publish", label: "发布", gate: "promote" }
] as const;

export function GenerationTimeline({ status }: GenerationTimelineProps) {
  const approvedGates = new Set(status.parent.approvedGates);
  const nextToolCall = status.operatorHints.nextToolCalls[0];
  const reviewCount = status.operatorHints.reviewQueue.length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-label="生成进度">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">生成进度</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">从资料到课程包的审核链路</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">关键节点保留人工 review，前端展示下一步可执行的 MCP 动作。</p>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">待审核 {reviewCount} 项</div>
      </div>

      <ol className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {generationStages.map((stage) => {
          const state = getStageState(stage.gate, approvedGates, status);
          const isActive = state === "active";

          return (
            <li className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3" key={stage.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-950">{stage.label}</span>
                <StageIcon state={state} />
              </div>
              <p className="text-xs font-semibold text-slate-500">{stateLabels[state]}</p>
              <p className="break-words text-xs leading-5 text-slate-600">Gate: {stage.gate}</p>
              {isActive && stage.gate === "child-runs" && nextToolCall ? (
                <div className="rounded-md bg-white p-2 text-xs leading-5 text-sky-800">
                  <p className="font-bold">下一步：{nextToolCall.toolName}</p>
                  <p className="mt-1 text-slate-600">{nextToolCall.reason}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid gap-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <p className="font-bold text-slate-950">子任务进展</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {status.childRuns.map((run) => (
            <div className="rounded-md bg-white p-3" key={run.unitId}>
              <p className="font-semibold text-slate-950">{run.title}</p>
              <p className="mt-1 text-xs text-slate-500">已通过 {run.approvedGates.length} 个 gate</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function getStageState(gate: string, approvedGates: Set<string>, status: DemoBetaStatus): "completed" | "active" | "waiting" {
  if (approvedGates.has(gate)) {
    return "completed";
  }

  if (gate === "child-runs" && status.operatorHints.nextToolCalls.some((call) => call.toolName === "learning_agent.run_course")) {
    return "active";
  }

  if (gate === "critic-report" && status.childRuns.some((run) => run.approvedGates.includes("critic-report"))) {
    return "active";
  }

  return "waiting";
}

function StageIcon({ state }: { state: "completed" | "active" | "waiting" }) {
  if (state === "completed") {
    return <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" />;
  }

  if (state === "active") {
    return <PlayCircle aria-hidden="true" className="size-4 text-sky-700" />;
  }

  return <CircleDashed aria-hidden="true" className="size-4 text-slate-400" />;
}

const stateLabels = {
  completed: "已完成",
  active: "进行中",
  waiting: "等待中"
} as const;
