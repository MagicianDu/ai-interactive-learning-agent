export type LearningAgentToolName =
  | "learning_agent.create_learning_project"
  | "learning_agent.publish_learning_course"
  | "learning_agent.get_learning_preview"
  | "learning_agent.generate_quick_preview"
  | "learning_agent.revise_learning_course"
  | "learning_agent.init_run"
  | "learning_agent.plan_run"
  | "learning_agent.init_from_plan"
  | "learning_agent.status"
  | "learning_agent.beta_status"
  | "learning_agent.run_until_gate"
  | "learning_agent.list_artifacts"
  | "learning_agent.read_artifact"
  | "learning_agent.submit_artifact"
  | "learning_agent.approve_gate"
  | "learning_agent.revise_gate"
  | "learning_agent.list_units"
  | "learning_agent.run_next"
  | "learning_agent.run_course"
  | "learning_agent.promote_units"
  | "learning_agent.promote_lesson";

export type LearningAgentToolContract = {
  name: LearningAgentToolName;
  description: string;
  inputSchema: Record<string, unknown>;
};

const objectSchema = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: "object",
  properties,
  required,
  additionalProperties: false
});

const stringSchema = { type: "string" };
const booleanSchema = { type: "boolean" };
const numberSchema = { type: "number" };
const stringArraySchema = { type: "array", items: { type: "string" } };
const arraySchema = { type: "array", items: { type: "object" } };
const looseObjectSchema = { type: "object" };

export const learningAgentToolContracts: LearningAgentToolContract[] = [
  {
    name: "learning_agent.create_learning_project",
    description:
      "Learner-facing tool. Create a Chinese learner brief from a natural-language request and ask only learner-answerable clarification questions.",
    inputSchema: objectSchema(
      {
        request: stringSchema,
        runId: stringSchema,
        sourcePath: stringSchema,
        sourceKind: stringSchema,
        audience: stringSchema,
        unitPages: numberSchema,
        strategy: stringSchema,
        selectedChapters: stringArraySchema,
        selectedTopics: stringArraySchema
      },
      ["request"]
    )
  },
  {
    name: "learning_agent.publish_learning_course",
    description:
      "Learner-facing tool. Publish a Codex-authored Chinese course bundle directly to the web lesson registry after quality checks.",
    inputSchema: objectSchema({ runId: stringSchema, coursePack: looseObjectSchema, lessons: arraySchema, publishNotes: stringSchema }, [
      "runId",
      "coursePack",
      "lessons"
    ])
  },
  {
    name: "learning_agent.get_learning_preview",
    description: "Learner-facing tool. Return user-readable preview instructions for a published learning course.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.generate_quick_preview",
    description:
      "Learner-facing tool. Generate a deterministic local quick preview without asking learners to approve internal artifacts.",
    inputSchema: objectSchema({ runId: stringSchema, maxSteps: numberSchema }, ["runId"])
  },
  {
    name: "learning_agent.revise_learning_course",
    description:
      "Learner-facing tool. Record learner feedback as a revision brief so Codex can revise and republish the course bundle.",
    inputSchema: objectSchema({ runId: stringSchema, feedback: stringSchema, focus: stringSchema }, ["runId", "feedback"])
  },
  {
    name: "learning_agent.init_run",
    description: "Advanced/operator tool. Initialize a learning-agent run from structured run config arguments.",
    inputSchema: objectSchema({
      topic: stringSchema,
      unitPages: stringSchema,
      sourceFile: stringSchema,
      sourceFolder: stringSchema,
      sourceUrl: stringSchema,
      sourceText: stringSchema,
      sourceKind: stringSchema,
      sourceTitle: stringSchema,
      planningMode: stringSchema,
      strategy: stringSchema,
      audience: stringSchema,
      language: stringSchema,
      adapter: stringSchema,
      run: stringSchema
    })
  },
  {
    name: "learning_agent.plan_run",
    description: "Advanced/operator tool. Create a reviewable run plan from a Chinese natural-language learning request.",
    inputSchema: objectSchema({ request: stringSchema, runId: stringSchema, adapter: stringSchema }, ["request"])
  },
  {
    name: "learning_agent.init_from_plan",
    description:
      "Advanced/operator tool. Approve optionally and initialize a learning-agent run from a previously written run plan.",
    inputSchema: objectSchema({ runId: stringSchema, approve: booleanSchema }, ["runId"])
  },
  {
    name: "learning_agent.status",
    description: "Advanced/operator tool. Read run config and status-relevant metadata.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.beta_status",
    description:
      "Advanced/operator tool. Read compact beta operator status, including approved gates, current review gates, child unit runs, and suggested next actions.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.run_until_gate",
    description:
      "Advanced/operator tool. Advance a run until it reaches an approval gate, manual action, completion, or step limit.",
    inputSchema: objectSchema({ runId: stringSchema, maxSteps: numberSchema }, ["runId"])
  },
  {
    name: "learning_agent.list_artifacts",
    description: "Advanced/operator tool. List artifact versions and draft/approved aliases for a run.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.read_artifact",
    description: "Advanced/operator tool. Read a run artifact by version, or read the draft when version is omitted.",
    inputSchema: objectSchema({ runId: stringSchema, artifactId: stringSchema, version: stringSchema }, [
      "runId",
      "artifactId"
    ])
  },
  {
    name: "learning_agent.submit_artifact",
    description: "Advanced/operator tool. Submit a JSON artifact file into a run artifact store.",
    inputSchema: objectSchema({ runId: stringSchema, artifactId: stringSchema, filePath: stringSchema }, [
      "runId",
      "artifactId",
      "filePath"
    ])
  },
  {
    name: "learning_agent.approve_gate",
    description: "Advanced/operator tool. Approve a gate for an exact artifact version.",
    inputSchema: objectSchema({ runId: stringSchema, gate: stringSchema, version: stringSchema, notes: stringSchema }, [
      "runId",
      "gate",
      "version"
    ])
  },
  {
    name: "learning_agent.revise_gate",
    description: "Advanced/operator tool. Request revision for a gate and exact artifact version.",
    inputSchema: objectSchema({ runId: stringSchema, gate: stringSchema, version: stringSchema, notes: stringSchema }, [
      "runId",
      "gate",
      "version",
      "notes"
    ])
  },
  {
    name: "learning_agent.list_units",
    description:
      "Advanced/operator tool. List summarized units from an approved curriculum plan; read curriculum-plan for full source anchors.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.run_next",
    description: "Advanced/operator tool. Advance one workflow step for a run.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.run_course",
    description:
      "Advanced/operator tool. Ensure and advance selected child unit runs for a course pack, returning summarized unit metadata.",
    inputSchema: objectSchema(
      { runId: stringSchema, unitSelector: stringSchema, maxSteps: numberSchema, promote: booleanSchema },
      ["runId"]
    )
  },
  {
    name: "learning_agent.promote_units",
    description: "Advanced/operator tool. Promote approved child unit lessons and write a course-pack manifest.",
    inputSchema: objectSchema({ runId: stringSchema, unitSelector: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.promote_lesson",
    description: "Advanced/operator tool. Promote one approved lesson artifact into src/lessons.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  }
];
