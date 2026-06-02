import {
  PrepareLearningCourseService,
  type PrepareLearningCourseInput,
  type PrepareLearningCourseResult
} from "./prepare-learning-course-service.js";

export type RunOneShotLearningCourseInput = PrepareLearningCourseInput;

type OneShotClarificationResult = Extract<PrepareLearningCourseResult, { status: "clarification_required" }>;
type OneShotAuthoringContext = Extract<PrepareLearningCourseResult, { status: "authoring_context_ready" }>;

export type RunOneShotLearningCourseResult =
  | OneShotClarificationResult
  | (Omit<OneShotAuthoringContext, "status" | "next"> & {
      entrypoint: "learning_agent.run_one_shot_learning_course";
      mode: "codex_authored_bundle";
      status: "authoring_required";
      userMessage: string;
      next: {
        recommendedTool: "learning_agent.publish_learning_course";
        codexInstruction: string;
      };
    });

export class OneShotLearningCourseService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async run(input: RunOneShotLearningCourseInput): Promise<RunOneShotLearningCourseResult> {
    const prepared = await new PrepareLearningCourseService(this.workspaceRoot).prepare(input);
    if (prepared.status === "clarification_required") {
      return prepared;
    }

    return {
      ...prepared,
      status: "authoring_required",
      entrypoint: "learning_agent.run_one_shot_learning_course",
      mode: "codex_authored_bundle",
      userMessage:
        "学习需求和来源约束已准备好。下一步由 Codex/Claude 按 authoring context 创作 course bundle；发布时不要再走 deterministic draft，并且要把图片写成 preview 本地 imagegen 资产而不是 generated.invalid 占位地址。",
      next: {
        recommendedTool: "learning_agent.publish_learning_course",
        codexInstruction: `${prepared.codexInstruction}\n\n图片资产要求：每页 visualSpec.imageUrl 必须使用 /__learning-preview/<runId>/images/<lessonId>/<pageId>-imagegen-v1.png 这类 preview 本地路径；发布后应继续调用 learning_agent.create_imagegen_manifest、learning_agent.record_imagegen_asset 或批处理工具补齐真实图片资产，再用 learning_agent.validate_imagegen_assets 验证。不要把 generated.invalid 当成可发布图片地址。`
      }
    };
  }
}
