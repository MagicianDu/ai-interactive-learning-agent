type DemoToolCall = {
  toolName: string;
  input: Record<string, string | number | boolean>;
  reason: string;
};

type DemoChildRun = {
  unitId: string;
  title: string;
  approvedGates: readonly string[];
};

export type DemoBetaStatus = {
  status: "beta_status";
  parent: {
    approvedGates: readonly string[];
    nextActions: readonly string[];
  };
  operatorHints: {
    readyToPromote: boolean;
    reviewQueue: readonly string[];
    nextToolCalls: readonly DemoToolCall[];
  };
  childRuns: readonly DemoChildRun[];
};

export const demoBetaStatus: DemoBetaStatus = {
  status: "beta_status",
  parent: {
    approvedGates: ["source-map", "concept-map", "curriculum-plan"],
    nextActions: ["Run learning_agent.run_course for demo-course-pack to create or advance course units."]
  },
  operatorHints: {
    readyToPromote: false,
    reviewQueue: [],
    nextToolCalls: [
      {
        toolName: "learning_agent.run_course",
        input: { runId: "demo-course-pack", unitSelector: "all", maxSteps: 20 },
        reason: "Create or advance child unit runs."
      }
    ]
  },
  childRuns: [
    { unitId: "unit-overview", title: "总览课", approvedGates: ["learning-architecture", "lesson", "critic-report"] },
    { unitId: "unit-topic-01", title: "核心 topic", approvedGates: ["learning-architecture", "lesson"] }
  ]
};
