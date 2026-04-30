import path from "node:path";

import { LearningCoursePublisher, type PublishLearningCourseResult } from "./learning-course-publisher.js";
import { LearnerProjectService } from "./learner-project-service.js";

export type CodexAuthoredTrialInput = {
  runId: string;
  sourcePath: string;
  sourceKind: string;
  audience: string;
  unitPages: number;
};

export type CodexAuthoredTrialResult = PublishLearningCourseResult & {
  sourcePath: string;
};

export class CodexAuthoredTrialService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async runTrial(input: CodexAuthoredTrialInput): Promise<CodexAuthoredTrialResult> {
    const sourceTitle = deriveSourceTitle(input.sourcePath);
    const anchorId = "source-001:page-1";
    await new LearnerProjectService(this.workspaceRoot).createProject({
      request: `请用 ${input.sourcePath} 生成中文学习材料，面向${input.audience}，每个单元 ${input.unitPages} 页。`,
      runId: input.runId,
      sourcePath: input.sourcePath,
      sourceKind: input.sourceKind,
      audience: input.audience,
      unitPages: input.unitPages,
      strategy: "overview_plus_topic"
    });

    const result = await new LearningCoursePublisher(this.workspaceRoot).publish({
      runId: input.runId,
      lessons: [buildTrialLesson(input, sourceTitle, anchorId)],
      coursePack: {
        id: input.runId,
        title: `${sourceTitle}：试跑课程包`,
        parentRunId: input.runId,
        sourceKind: input.sourceKind,
        strategy: "overview_plus_topic",
        audience: input.audience,
        language: "zh-CN",
        units: [
          {
            unitId: "unit-overview",
            title: `${sourceTitle}：总览课`,
            kind: "overview",
            lessonId: `${input.runId}-overview`,
            targetPageCount: input.unitPages,
            sourceAnchorIds: [anchorId],
            sourceNodeIds: ["source-001:root"],
            conceptIds: ["source-map", "learning-path", "transfer"]
          }
        ]
      },
      publishNotes: "Codex-authored acceptance trial bundle. Do not commit private source-derived generated content."
    });

    return { ...result, sourcePath: input.sourcePath };
  }
}

function buildTrialLesson(input: CodexAuthoredTrialInput, sourceTitle: string, anchorId: string): Record<string, unknown> {
  const lessonId = `${input.runId}-overview`;
  return {
    id: lessonId,
    title: `${sourceTitle}：总览课`,
    audience: input.audience,
    config: {
      targetPageCount: input.unitPages,
      minPageCount: Math.max(1, input.unitPages - 2),
      maxPageCount: input.unitPages + 2
    },
    sourceContext: {
      sourcePath: input.sourcePath,
      sourceKind: input.sourceKind,
      sourceAnchorIds: [anchorId]
    },
    prerequisites: ["能阅读基础技术材料", "希望通过中文互动课程建立心智模型"],
    learningObjectives: ["解释资料中的核心问题、机制和迁移方式"],
    pages: buildPages(input.unitPages, sourceTitle, anchorId),
    misconceptions: [{ id: "m1", statement: "只要读完资料就等于理解了系统。", correction: "理解需要把问题、结构、动作反馈和迁移场景连接起来。" }],
    transferTasks: [{ id: "t1", prompt: "把这套分析方法迁移到你正在学习的另一份技术材料。", targetMentalModel: "先抽问题，再建结构，再用行动验证。" }],
    summary: ["先看问题，再看结构。", "每个概念都要能通过行动和反馈验证。", "能迁移到新场景，才说明心智模型真正建立。"]
  };
}

function buildPages(targetPageCount: number, sourceTitle: string, anchorId: string): Array<Record<string, unknown>> {
  const basePages: Array<Record<string, unknown>> = [
    page("p1", "problem_scene", "为什么不能只把资料变成摘要", "识别学习问题", `${sourceTitle} 的学习目标不是背诵段落，而是建立可迁移的工作模型。`, anchorId, { visual: true }),
    page("p2", "intuition_visual", "先画地图，再进入细节", "理解总览课的作用", "总览课像地图：先告诉你有哪些区域、路线和风险，再进入 topic。", anchorId, { visual: true }),
    page("p3", "structure_diagram", "把知识拆成问题、机制、证据", "看见资料结构", "每个核心 topic 都应该连接问题、机制、例子、误区和迁移任务。", anchorId, { visual: true }),
    page("p4", "interactive_model", "选择下一步学习路径", "通过选择理解学习路径", "你需要根据目标选择先看机制、例子还是误区。", anchorId, { interaction: true }),
    page("p5", "interactive_model", "检查一个解释是否可靠", "用来源和反馈校验理解", "可靠解释需要说明依据、因果链和适用边界。", anchorId, { interaction: true }),
    page("p6", "quiz", "哪种学习结果更稳固", "检查心智模型质量", "判断一个学习结果是否能支持复述、应用和迁移。", anchorId, { assessment: true }),
    page("p7", "misconception_check", "误区：越多页面越等于越懂", "识别页面数量误区", "页面数量只是载体，真正重要的是学习动作、反馈和迁移。", anchorId, { assessment: true }),
    page("p8", "summary_card", "总览课记忆卡", "压缩关键心智模型", "把资料学习压缩为问题、结构、行动、反馈、迁移五步。", anchorId, { visual: true })
  ];
  return basePages.slice(0, targetPageCount);
}

function page(
  id: string,
  type: string,
  title: string,
  learningGoal: string,
  narrative: string,
  anchorId: string,
  options: { visual?: boolean; interaction?: boolean; assessment?: boolean }
): Record<string, unknown> {
  return {
    id,
    type,
    title,
    learningGoal,
    narrative,
    sourceAnchorIds: [anchorId],
    ...(options.visual
      ? {
          visualSpec: {
            kind: "diagram",
            description: "用中文图示展示问题、结构和学习路径。",
            keyElements: ["问题", "结构", "行动", "反馈", "迁移"]
          }
        }
      : {}),
    ...(options.interaction
      ? {
          interactionSpec: {
            kind: "choice",
            learnerAction: "选择一个学习路径",
            expectedObservation: "看到不同路径带来的理解差异",
            cognitivePurpose: "让学习者把目标和学习策略连接起来",
            options: [
              {
                id: "path-evidence",
                label: "先找证据",
                resultTitle: "更稳的路径",
                outcomeId: "grounded",
                resultTone: "success",
                explanation: "先找证据能降低误读风险，再组织解释会更稳。"
              }
            ]
          }
        }
      : {}),
    ...(options.assessment
      ? {
          assessmentSpec: {
            kind: "multiple_choice",
            prompt: "哪种学习结果最能说明你已经建立心智模型？",
            options: ["能把机制迁移到新问题", "记住了更多原文句子"],
            correctAnswer: "能把机制迁移到新问题"
          },
          feedbackSpec: {
            correctFeedback: "正确。迁移说明你抓住了机制，而不是只记住表述。",
            incorrectFeedback: "不对。记住原文有帮助，但不能单独证明你能应用机制。"
          }
        }
      : {})
  };
}

function deriveSourceTitle(sourcePath: string): string {
  return path.basename(sourcePath).replace(/\.[^.]+$/u, "") || "资料";
}
