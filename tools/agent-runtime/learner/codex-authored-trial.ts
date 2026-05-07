import path from "node:path";

import { AuthoringContextService, type AuthoringContextResult } from "./authoring-context-service.js";
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
    await new LearnerProjectService(this.workspaceRoot).createProject({
      request: `请用 ${input.sourcePath} 生成中文学习材料，面向${input.audience}，教学难度为大学高年级/研究生课程，每个单元 ${input.unitPages} 页。`,
      runId: input.runId,
      sourcePath: input.sourcePath,
      sourceKind: input.sourceKind,
      audience: input.audience,
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: input.unitPages,
      strategy: "overview_plus_topic"
    });
    const authoringContext = await new AuthoringContextService(this.workspaceRoot).getContext({ runId: input.runId });
    const lessons = authoringContext.contentBlueprint.units.map((unit) => buildTrialLesson(input, unit));

    const result = await new LearningCoursePublisher(this.workspaceRoot).publish({
      runId: input.runId,
      lessons,
      coursePack: {
        id: input.runId,
        title: `${sourceTitle}：试跑课程包`,
        parentRunId: input.runId,
        sourceKind: input.sourceKind,
        strategy: "overview_plus_topic",
        audience: input.audience,
        language: "zh-CN",
        overviewUnitId: "unit-overview",
        units: authoringContext.coursePlan.recommendedUnits.map((unit, index) => ({
          unitId: unit.unitId,
          title: unit.title,
          kind: unit.kind,
          lessonId: unit.lessonId,
          targetPageCount: unit.targetPageCount,
          sourceAnchorIds: unit.sourceAnchorIds,
          chapterRefs: unit.chapterRefs,
          conceptIds: [`concept-${String(index + 1).padStart(2, "0")}`, ...unit.focusConcepts.map(slugConcept)]
        }))
      },
      publishNotes: "Codex-authored acceptance trial bundle. Do not commit private source-derived generated content."
    });

    return { ...result, sourcePath: input.sourcePath };
  }
}

type TrialUnitBlueprint = AuthoringContextResult["contentBlueprint"]["units"][number];
type TrialPageBlueprint = TrialUnitBlueprint["pageBlueprints"][number];

function buildTrialLesson(input: CodexAuthoredTrialInput, unit: TrialUnitBlueprint): Record<string, unknown> {
  const focus = focusLabel(unit);
  return {
    id: unit.lessonId,
    title: unit.title,
    audience: input.audience,
    config: {
      targetPageCount: unit.targetPageCount,
      minPageCount: unit.targetPageCount,
      maxPageCount: unit.targetPageCount
    },
    sourceContext: {
      sourcePath: input.sourcePath,
      sourceKind: input.sourceKind,
      unitId: unit.unitId,
      sourceAnchorIds: unit.sourceAnchorIds
    },
    prerequisites: [
      "能阅读基础技术材料",
      `先修概念：${focus}相关的基本系统设计术语和问题抽象方法`,
      `正式术语：问题定义、机制模型、证据链、局限边界、迁移应用`,
      "愿意用预测、比较和迁移任务检验理解"
    ],
    learningObjectives: [`建立${focus}的研究生课程心智模型`, `用${focus}完成预测、误区检查和迁移应用`],
    pages: unit.pageBlueprints.map((pageBlueprint, index) => buildPage(unit, pageBlueprint, index)),
    misconceptions: [
      {
        id: "m1",
        statement: `只要能复述${focus}的文字说明，就等于真正理解。`,
        correction: "研究生课程级理解必须能说明先修概念、正式术语、证据链、局限边界、反例和迁移条件。"
      }
    ],
    transferTasks: [
      {
        id: "t1",
        prompt: `把${focus}迁移到另一份技术资料或一个新系统设计问题中。`,
        targetMentalModel: "先确认结构同构，再判断来源证据、边界条件和失败模式。"
      }
    ],
    summary: [
      `${focus}要从问题定义进入，并回扣先修概念和正式术语。`,
      "机制模型必须连接证据链、局限边界、反例和适用条件。",
      "课堂讨论负责检验边界，课后作业负责完成迁移应用。"
    ]
  };
}

function buildPage(unit: TrialUnitBlueprint, pageBlueprint: TrialPageBlueprint, index: number): Record<string, unknown> {
  const focus = focusLabel(unit);
  return {
    id: `p${pageBlueprint.pageNumber}`,
    type: pageBlueprint.pageType,
    title: `${focus}：${pageTypeLabel(pageBlueprint.pageType)}`,
    learningGoal: `建立${focus}的研究生课程心智模型：${pageBlueprint.teachingMove}`,
    narrative: [
      `本页围绕${focus}，用${pageBlueprint.teachingMove}推进。`,
      "请把它当作大学高年级/研究生课程中的一张课堂 slide：先看先修概念和正式术语，再看机制模型、证据链、局限边界、反例和适用条件。",
      "课堂讨论要比较两个解释路径，课后作业要把同一模型迁移到新资料或新系统。",
      `必须包含：${pageBlueprint.mustInclude.join("；")}。`
    ].join(""),
    sourceAnchorIds: pageAnchorIds(unit, index),
    visualSpec: {
      kind: visualKind(pageBlueprint.pageType),
      description: `${pageBlueprint.visualRequirement}；图中显式标注${focus}的问题、机制、证据边界和迁移路径。`,
      keyElements: ["问题定义", "机制模型", "来源证据", "反例", "迁移应用"]
    },
    ...(needsInteraction(pageBlueprint.pageType)
      ? {
          interactionSpec: {
            kind: pageBlueprint.pageType === "transfer_challenge" ? "prediction" : "choice",
            learnerAction: pageBlueprint.learnerAction,
            expectedObservation: "学习者会看到不同判断路径如何改变结论可靠性。",
            cognitivePurpose: "让学习者通过预测、比较和解释来检验心智模型，而不是被动阅读。",
            options: [
              {
                id: "evidence-first",
                label: "先看来源证据和边界",
                resultTitle: "更接近课程级理解",
                outcomeId: "evidence-model",
                resultTone: "success",
                explanation: "先确认来源证据，再建立机制模型，可以避免把局部例子误当成通用规律。"
              },
              {
                id: "definition-first",
                label: "先背定义",
                resultTitle: "理解仍然不稳",
                outcomeId: "definition-only",
                resultTone: "warning",
                explanation: "只背定义无法说明失败条件、反例和迁移边界，不能支撑研究生课程级判断。"
              }
            ]
          }
        }
      : {}),
    ...(needsAssessment(pageBlueprint.pageType)
      ? {
          assessmentSpec: {
            kind: assessmentKind(pageBlueprint.pageType),
            prompt: `关于${focus}，哪种回答最能说明你已经形成可迁移的心智模型？`,
            options: ["能说明机制、证据边界、反例和迁移条件", "能流畅复述来源材料中的几个术语"],
            correctAnswer: "能说明机制、证据边界、反例和迁移条件"
          },
          feedbackSpec: {
            correctFeedback: "正确。课程级理解要求你能把问题定义、机制模型、证据边界和迁移条件连成一条可检验的推理链。",
            incorrectFeedback: "不对。术语复述只能证明记忆，不足以证明你能判断反例、边界条件或新场景中的适用性。",
            misconceptionAddressed: `把${focus}当成可复述知识，而不是可迁移模型。`
          }
        }
      : {})
  };
}

function needsInteraction(pageType: string): boolean {
  return pageType === "interactive_model" || pageType === "transfer_challenge";
}

function needsAssessment(pageType: string): boolean {
  return pageType === "quiz" || pageType === "misconception_check" || pageType === "transfer_challenge";
}

function assessmentKind(pageType: string): string {
  if (pageType === "transfer_challenge") return "transfer";
  if (pageType === "misconception_check") return "true_false";
  return "multiple_choice";
}

function visualKind(pageType: string): string {
  if (pageType === "process_animation") return "timeline";
  if (pageType === "code_walkthrough") return "flow";
  return "diagram";
}

function pageAnchorIds(unit: TrialUnitBlueprint, index: number): string[] {
  if (unit.sourceAnchorIds.length === 0) {
    return [];
  }
  return [unit.sourceAnchorIds[index % unit.sourceAnchorIds.length] as string];
}

function focusLabel(unit: TrialUnitBlueprint): string {
  return unit.focusConcepts.filter(Boolean).join("、") || unit.title;
}

function pageTypeLabel(pageType: string): string {
  const labels: Record<string, string> = {
    problem_scene: "问题场景",
    intuition_visual: "直觉模型",
    structure_diagram: "结构图",
    process_animation: "过程推进",
    interactive_model: "操作模型",
    code_walkthrough: "正式表达",
    quiz: "判断检查",
    misconception_check: "误区检查",
    transfer_challenge: "迁移挑战",
    summary_card: "记忆卡"
  };
  return labels[pageType] ?? pageType;
}

function slugConcept(value: string): string {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return ascii || `concept-${Math.abs(hashString(value)).toString(36)}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash << 5) - hash + char.codePointAt(0)!;
    hash |= 0;
  }
  return hash;
}

function deriveSourceTitle(sourcePath: string): string {
  return path.basename(sourcePath).replace(/\.[^.]+$/u, "") || "资料";
}
