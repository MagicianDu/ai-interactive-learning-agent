export type LearningAgentToolName =
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

export const learningAgentToolContracts: LearningAgentToolContract[] = [
  {
    name: "learning_agent.init_run",
    description: "Initialize a learning-agent run from structured run config arguments.",
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
    description: "Create a reviewable run plan from a Chinese natural-language learning request.",
    inputSchema: objectSchema({ request: stringSchema, runId: stringSchema, adapter: stringSchema }, ["request"])
  },
  {
    name: "learning_agent.init_from_plan",
    description: "Approve optionally and initialize a learning-agent run from a previously written run plan.",
    inputSchema: objectSchema({ runId: stringSchema, approve: booleanSchema }, ["runId"])
  },
  {
    name: "learning_agent.status",
    description: "Read run config and status-relevant metadata.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.beta_status",
    description:
      "Read compact beta operator status, including approved gates, current review gates, child unit runs, and suggested next actions.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.run_until_gate",
    description: "Advance a run until it reaches an approval gate, manual action, completion, or step limit.",
    inputSchema: objectSchema({ runId: stringSchema, maxSteps: numberSchema }, ["runId"])
  },
  {
    name: "learning_agent.list_artifacts",
    description: "List artifact versions and draft/approved aliases for a run.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.read_artifact",
    description: "Read a run artifact by version, or read the draft when version is omitted.",
    inputSchema: objectSchema({ runId: stringSchema, artifactId: stringSchema, version: stringSchema }, [
      "runId",
      "artifactId"
    ])
  },
  {
    name: "learning_agent.submit_artifact",
    description: "Submit a JSON artifact file into a run artifact store.",
    inputSchema: objectSchema({ runId: stringSchema, artifactId: stringSchema, filePath: stringSchema }, [
      "runId",
      "artifactId",
      "filePath"
    ])
  },
  {
    name: "learning_agent.approve_gate",
    description: "Approve a gate for an exact artifact version.",
    inputSchema: objectSchema({ runId: stringSchema, gate: stringSchema, version: stringSchema, notes: stringSchema }, [
      "runId",
      "gate",
      "version"
    ])
  },
  {
    name: "learning_agent.revise_gate",
    description: "Request revision for a gate and exact artifact version.",
    inputSchema: objectSchema({ runId: stringSchema, gate: stringSchema, version: stringSchema, notes: stringSchema }, [
      "runId",
      "gate",
      "version",
      "notes"
    ])
  },
  {
    name: "learning_agent.list_units",
    description: "List summarized units from an approved curriculum plan; read curriculum-plan for full source anchors.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.run_next",
    description: "Advance one workflow step for a run.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.run_course",
    description: "Ensure and advance selected child unit runs for a course pack, returning summarized unit metadata.",
    inputSchema: objectSchema(
      { runId: stringSchema, unitSelector: stringSchema, maxSteps: numberSchema, promote: booleanSchema },
      ["runId"]
    )
  },
  {
    name: "learning_agent.promote_units",
    description: "Promote approved child unit lessons and write a course-pack manifest.",
    inputSchema: objectSchema({ runId: stringSchema, unitSelector: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.promote_lesson",
    description: "Promote one approved lesson artifact into src/lessons.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  }
];
