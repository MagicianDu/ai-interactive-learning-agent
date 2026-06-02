import { courseIntentValues } from "../agent-runtime/learner/course-intent.js";

export type LearningAgentToolName =
  | "learning_agent.create_learning_project"
  | "learning_agent.run_one_shot_learning_course"
  | "learning_agent.prepare_learning_course"
  | "learning_agent.start_course_production"
  | "learning_agent.next_course_production_action"
  | "learning_agent.record_course_production_event"
  | "learning_agent.list_learning_projects"
  | "learning_agent.archive_learning_project"
  | "learning_agent.get_authoring_context"
  | "learning_agent.generate_grounded_course"
  | "learning_agent.publish_learning_course"
  | "learning_agent.calibrate_learning_course"
  | "learning_agent.prepare_content_review"
  | "learning_agent.record_content_review_report"
  | "learning_agent.create_imagegen_manifest"
  | "learning_agent.record_imagegen_asset"
  | "learning_agent.validate_imagegen_assets"
  | "learning_agent.start_imagegen_batch"
  | "learning_agent.record_imagegen_batch_item"
  | "learning_agent.compare_authoring_quality"
  | "learning_agent.create_quality_revision"
  | "learning_agent.get_learning_preview"
  | "learning_agent.generate_quick_preview"
  | "learning_agent.revise_learning_course"
  | "learning_agent.apply_learning_revision"
  | "learning_agent.export_learning_course"
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

export type LearningAgentToolProfile = "learner" | "authoring" | "operator";

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
const courseIntentSchema = { type: "string", enum: [...courseIntentValues] };
const stringArraySchema = { type: "array", items: { type: "string" } };
const arraySchema = { type: "array", items: { type: "object" } };
const looseObjectSchema = { type: "object" };
const contentReviewVerdictSchema = { type: "string", enum: ["pass", "revise", "block"] };
const imagegenGeneratorSchema = { type: "string", enum: ["imagegen", "placeholder", "imported", "unknown"] };
const contentReviewIssuesSchema = {
  type: "array",
  items: objectSchema(
    {
      lessonId: stringSchema,
      pageId: stringSchema,
      severity: { type: "string", enum: ["critical", "major", "minor"] },
      category: {
        type: "string",
        enum: [
          "density",
          "knowledge_density",
          "content_taste",
          "source_fidelity",
          "structure",
          "image_text_fit",
          "template_language",
          "learner_readability"
        ]
      },
      finding: stringSchema,
      recommendation: stringSchema
    },
    ["severity", "category", "finding", "recommendation"]
  )
};
const courseProductionDefaultsSchema = objectSchema(
  {
    difficulty: { type: "string", enum: ["beginner", "undergraduate", "graduate", "expert"] },
    strategy: { type: "string", enum: ["overview_plus_topic", "chapter_guided", "topic_guided"] },
    overviewPages: numberSchema,
    topicPages: numberSchema,
    topicCount: numberSchema,
    reviewRounds: numberSchema,
    minQualityScore: numberSchema
  },
  ["difficulty", "strategy", "overviewPages", "topicPages", "topicCount", "reviewRounds", "minQualityScore"]
);
const imagegenBatchItemStatusSchema = { type: "string", enum: ["succeeded", "failed"] };

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
        difficultyLevel: stringSchema,
        courseIntent: courseIntentSchema,
        unitPages: numberSchema,
        targetTotalPages: numberSchema,
        strategy: stringSchema,
        selectedChapters: stringArraySchema,
        selectedTopics: stringArraySchema
      },
      ["request"]
    )
  },
  {
    name: "learning_agent.run_one_shot_learning_course",
    description:
      "Learner-facing default tool. Turn one natural-language Chinese learning request into either learner-answerable clarification questions or a Codex-authored course-bundle authoring packet in one call.",
    inputSchema: objectSchema(
      {
        request: stringSchema,
        runId: stringSchema,
        sourcePath: stringSchema,
        sourceKind: stringSchema,
        audience: stringSchema,
        difficultyLevel: stringSchema,
        courseIntent: courseIntentSchema,
        unitPages: numberSchema,
        targetTotalPages: numberSchema,
        strategy: stringSchema,
        selectedChapters: stringArraySchema,
        selectedTopics: stringArraySchema,
        maxAnchors: numberSchema
      },
      ["request"]
    )
  },
  {
    name: "learning_agent.prepare_learning_course",
    description:
      "Learner-facing tool. Create or update a learner project and return source semantics, recommended units, content blueprint, and Codex publishing instructions in one call when no clarification is needed.",
    inputSchema: objectSchema(
      {
        request: stringSchema,
        runId: stringSchema,
        sourcePath: stringSchema,
        sourceKind: stringSchema,
        audience: stringSchema,
        difficultyLevel: stringSchema,
        courseIntent: courseIntentSchema,
        unitPages: numberSchema,
        targetTotalPages: numberSchema,
        strategy: stringSchema,
        selectedChapters: stringArraySchema,
        selectedTopics: stringArraySchema,
        maxAnchors: numberSchema
      },
      ["request"]
    )
  },
  {
    name: "learning_agent.start_course_production",
    description:
      "Learner-facing pipeline tool. Start a one-shot course production run from a natural-language learner request and return the next Codex action without exposing internal artifacts.",
    inputSchema: objectSchema(
      {
        runId: stringSchema,
        sourceKind: stringSchema,
        learnerRequest: stringSchema,
        targetMode: { type: "string", enum: ["student_self_study_textbook", "professor_web_deck"] },
        defaults: courseProductionDefaultsSchema
      },
      ["runId", "sourceKind", "learnerRequest", "targetMode", "defaults"]
    )
  },
  {
    name: "learning_agent.next_course_production_action",
    description:
      "Learner-facing pipeline tool. Inspect production state and return the next Codex action across content review, imagegen batch, layout smoke, or final preview handoff.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.record_course_production_event",
    description:
      "Internal pipeline tool. Record a Codex-completed course production event such as course_published, review_recorded, images_recorded, or layout_smoke_passed.",
    inputSchema: objectSchema(
      { runId: stringSchema, eventKind: stringSchema, summary: stringSchema, artifactPaths: stringArraySchema },
      ["runId", "eventKind", "summary", "artifactPaths"]
    )
  },
  {
    name: "learning_agent.list_learning_projects",
    description: "Learner-facing tool. List local learning projects created under runs/ with preview metadata when available.",
    inputSchema: objectSchema({})
  },
  {
    name: "learning_agent.archive_learning_project",
    description: "Learner-facing tool. Archive a local learning project without deleting generated run artifacts.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.get_authoring_context",
    description:
      "Learner-facing tool. Prepare source anchors, recommended units, and Codex authoring instructions before a Codex-authored publish_learning_course call.",
    inputSchema: objectSchema({ runId: stringSchema, maxAnchors: numberSchema }, ["runId"])
  },
  {
    name: "learning_agent.generate_grounded_course",
    description:
      "Learner-facing draft tool. Generate and publish a deterministic source-grounded Chinese draft from a learner project for smoke previews.",
    inputSchema: objectSchema({ runId: stringSchema, maxAnchorsPerLesson: numberSchema }, ["runId"])
  },
  {
    name: "learning_agent.publish_learning_course",
    description:
      "Learner-facing tool. Publish a Codex-authored Chinese course bundle to the clean preview runtime after quality checks. Maintainers may pass outputMode=source to write fixture modules.",
    inputSchema: objectSchema(
      { runId: stringSchema, coursePack: looseObjectSchema, lessons: arraySchema, publishNotes: stringSchema, outputMode: stringSchema },
      ["runId", "coursePack", "lessons"]
    )
  },
  {
    name: "learning_agent.calibrate_learning_course",
    description:
      "Learner-facing quality tool. Read the current preview quality report and create a Codex-ready calibration revision brief for structure, source, or learner quality without asking learners to approve artifacts.",
    inputSchema: objectSchema(
      {
        runId: stringSchema,
        maxRounds: numberSchema,
        minScore: numberSchema,
        failOnWarnings: booleanSchema,
        focus: stringArraySchema
      },
      ["runId"]
    )
  },
  {
    name: "learning_agent.prepare_content_review",
    description:
      "Learner-facing quality tool. Create the next Codex-facing content review brief for a published learning course, so Codex can critique and revise content before final imagegen publishing.",
    inputSchema: objectSchema({ runId: stringSchema, maxRounds: numberSchema, minScore: numberSchema }, ["runId"])
  },
  {
    name: "learning_agent.record_content_review_report",
    description:
      "Learner-facing quality tool. Record a Codex content-review report after a revision round, including reviewer verdict, concrete issues, measured content metrics, and delta from the previous round.",
    inputSchema: objectSchema(
      {
        runId: stringSchema,
        round: numberSchema,
        reviewerVerdict: contentReviewVerdictSchema,
        summary: stringSchema,
        issues: contentReviewIssuesSchema
      },
      ["runId", "round", "summary", "issues"]
    )
  },
  {
    name: "learning_agent.create_imagegen_manifest",
    description:
      "Learner-facing asset tool. Create a page-level imagegen prompt manifest with preview target paths for a published course run.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.record_imagegen_asset",
    description:
      "Learner-facing asset tool. Record one imagegen output file into the preview assets folder and update the corresponding lesson visualSpec.",
    inputSchema: objectSchema(
      {
        runId: stringSchema,
        lessonId: stringSchema,
        pageId: stringSchema,
        sourceImagePath: stringSchema,
        generator: imagegenGeneratorSchema,
        recordedBy: stringSchema
      },
      ["runId", "lessonId", "pageId", "sourceImagePath"]
    )
  },
  {
    name: "learning_agent.validate_imagegen_assets",
    description:
      "Learner-facing asset tool. Validate that the current preview uses imagegen PNG/WebP assets and safe prompts rather than missing files, SVG placeholders, or text-heavy image prompts.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.start_imagegen_batch",
    description:
      "Learner-facing asset tool. Create or resume imagegen batch state from the manifest and return pending page-level image generation items.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.record_imagegen_batch_item",
    description:
      "Learner-facing asset tool. Record success or failure for one imagegen batch item and update retry/progress state.",
    inputSchema: objectSchema(
      {
        runId: stringSchema,
        lessonId: stringSchema,
        pageId: stringSchema,
        status: imagegenBatchItemStatusSchema,
        sourceImagePath: stringSchema,
        generator: imagegenGeneratorSchema,
        recordedBy: stringSchema,
        failureReason: stringSchema
      },
      ["runId", "lessonId", "pageId", "status"]
    )
  },
  {
    name: "learning_agent.compare_authoring_quality",
    description:
      "Learner-facing quality tool. Compare a Codex-authored preview against a deterministic draft preview and return concrete content-quality improvements and remaining gaps.",
    inputSchema: objectSchema({ authoredRunId: stringSchema, draftRunId: stringSchema }, ["authoredRunId", "draftRunId"])
  },
  {
    name: "learning_agent.create_quality_revision",
    description:
      "Learner-facing quality tool. Convert compare_authoring_quality revisionInstructions into a Codex-ready revision brief.",
    inputSchema: objectSchema({ runId: stringSchema, comparisonReportPath: stringSchema }, ["runId"])
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
    name: "learning_agent.apply_learning_revision",
    description:
      "Learner-facing tool. Apply the latest targeted learner revision to the current published course and refresh the preview.",
    inputSchema: objectSchema({ runId: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.export_learning_course",
    description:
      "Learner-facing tool. Export a preview-ready learning course bundle with a static-course manifest. Blocks failed quality reports unless a maintainer provides expertOverrideReason.",
    inputSchema: objectSchema({ runId: stringSchema, expertOverrideReason: stringSchema }, ["runId"])
  },
  {
    name: "learning_agent.init_run",
    description: "Advanced/operator tool. Initialize a learning-agent run from structured run config arguments.",
    inputSchema: objectSchema({
      topic: stringSchema,
      unitPages: stringSchema,
      targetTotalPages: stringSchema,
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

const learnerToolNames = [
  "learning_agent.run_one_shot_learning_course",
  "learning_agent.list_learning_projects",
  "learning_agent.archive_learning_project",
  "learning_agent.publish_learning_course",
  "learning_agent.create_imagegen_manifest",
  "learning_agent.record_imagegen_asset",
  "learning_agent.validate_imagegen_assets",
  "learning_agent.start_imagegen_batch",
  "learning_agent.record_imagegen_batch_item",
  "learning_agent.get_learning_preview",
  "learning_agent.revise_learning_course",
  "learning_agent.apply_learning_revision",
  "learning_agent.export_learning_course"
] satisfies LearningAgentToolName[];

const authoringToolNames = [
  ...learnerToolNames,
  "learning_agent.prepare_learning_course",
  "learning_agent.start_course_production",
  "learning_agent.next_course_production_action",
  "learning_agent.record_course_production_event",
  "learning_agent.calibrate_learning_course",
  "learning_agent.prepare_content_review",
  "learning_agent.record_content_review_report",
  "learning_agent.create_learning_project",
  "learning_agent.get_authoring_context",
  "learning_agent.compare_authoring_quality",
  "learning_agent.create_quality_revision",
  "learning_agent.generate_grounded_course"
] satisfies LearningAgentToolName[];

export function learningAgentToolContractsForProfile(
  profile: LearningAgentToolProfile = "learner"
): LearningAgentToolContract[] {
  if (profile === "operator") {
    return learningAgentToolContracts;
  }

  const contractsByName = new Map(learningAgentToolContracts.map((tool) => [tool.name, tool]));
  const profileToolNames = profile === "authoring" ? authoringToolNames : learnerToolNames;
  return profileToolNames.map((name) => {
    const contract = contractsByName.get(name);
    if (!contract) {
      throw new Error(`missing learning agent tool contract: ${name}`);
    }
    return contract;
  });
}

export const learningAgentToolNames = learningAgentToolContracts.map((tool) => tool.name);
const learningAgentToolNameSet = new Set<string>(learningAgentToolNames);

export function isLearningAgentToolName(name: string): name is LearningAgentToolName {
  return learningAgentToolNameSet.has(name);
}
