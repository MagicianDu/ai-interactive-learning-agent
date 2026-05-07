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
    learningObjectives: learningObjectivesForLesson(input.sourceKind, focus),
    pages: unit.pageBlueprints.map((pageBlueprint, index) => buildPage(input, unit, pageBlueprint, index)),
    misconceptions: [
      {
        id: "m1",
        statement: `只要能复述${focus}的文字说明，就等于真正理解。`,
        correction:
          input.sourceKind === "paper"
            ? "论文精读必须同时说明研究问题、论文贡献、方法机制、实验/证据、局限边界和迁移边界。"
            : "研究生课程级理解必须能说明先修概念、正式术语、证据链、局限边界、反例和迁移条件。"
      }
    ],
    transferTasks: [
      {
        id: "t1",
        prompt:
          input.sourceKind === "paper"
            ? `把${focus}迁移到另一篇论文或一个新 agent 系统设计中，并说明哪些方法假设仍然成立。`
            : `把${focus}迁移到另一份技术资料或一个新系统设计问题中。`,
        targetMentalModel:
          input.sourceKind === "paper"
            ? "先确认研究问题是否同构，再判断论文贡献、方法机制、实验/证据和局限边界能否迁移。"
            : "先确认结构同构，再判断来源证据、边界条件和失败模式。"
      }
    ],
    summary: summaryForLesson(input.sourceKind, focus)
  };
}

function learningObjectivesForLesson(sourceKind: string, focus: string): string[] {
  if (sourceKind === "paper") {
    return [
      `拆解${focus}的研究问题和论文贡献`,
      `解释${focus}的方法机制与实验/证据路径`,
      `用局限边界判断${focus}的迁移边界`
    ];
  }
  return [`建立${focus}的课程级心智模型`, `用${focus}完成预测、误区检查和迁移应用`];
}

function summaryForLesson(sourceKind: string, focus: string): string[] {
  if (sourceKind === "paper") {
    return [
      `${focus}先定位研究问题，再判断论文贡献是否被实验/证据支持。`,
      "方法机制必须和方法假设、局限边界、威胁与反例一起阅读。",
      "迁移边界决定这篇论文能否用于另一篇论文、专利、博客或真实系统设计。"
    ];
  }
  return [
    `${focus}要从问题定义进入，并回扣先修概念和正式术语。`,
    "机制模型必须连接证据链、局限边界、反例和适用条件。",
    "课堂讨论负责检验边界，课后作业负责完成迁移应用。"
  ];
}

function buildPage(input: CodexAuthoredTrialInput, unit: TrialUnitBlueprint, pageBlueprint: TrialPageBlueprint, index: number): Record<string, unknown> {
  const focus = focusLabel(unit);
  const pageType = pageBlueprint.pageType;
  return {
    id: `p${pageBlueprint.pageNumber}`,
    type: pageType,
    title: `${focus}：${pageTypeLabel(pageType)}`,
    learningGoal: learningGoalForPage(input.sourceKind, focus, pageType),
    narrative: narrativeForPage(unit, pageBlueprint, focus, input.sourceKind),
    sourceAnchorIds: pageAnchorIds(unit, index),
    visualSpec: {
      kind: visualKind(pageType),
      description: visualDescriptionForPage(focus, pageBlueprint),
      keyElements: ["问题定义", "机制模型", "来源证据", "反例", "迁移应用"]
    },
    ...(needsInteraction(pageType)
      ? {
          interactionSpec: {
            kind: pageType === "transfer_challenge" ? "prediction" : "choice",
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
    ...(needsAssessment(pageType)
      ? {
          assessmentSpec: {
            kind: assessmentKind(pageType),
            prompt:
              input.sourceKind === "paper"
                ? `关于${focus}，哪种回答最能说明你已经读懂这篇论文？`
                : `关于${focus}，哪种回答最能说明你已经形成可迁移的心智模型？`,
            options: ["能说明机制、证据边界、反例和迁移条件", "能流畅复述来源材料中的几个术语"],
            correctAnswer: "能说明机制、证据边界、反例和迁移条件"
          },
          feedbackSpec: {
            correctFeedback:
              input.sourceKind === "paper"
                ? "正确。论文精读要求把研究问题、论文贡献、方法机制、实验/证据、局限边界和迁移边界连成可审查的论证链。"
                : "正确。课程级理解要求你能把问题定义、机制模型、证据边界和迁移条件连成一条可检验的推理链。",
            incorrectFeedback:
              input.sourceKind === "paper"
                ? "不对。只复述术语无法判断论文贡献是否被证据支持，也无法判断方法假设在新场景是否成立。"
                : "不对。术语复述只能证明记忆，不足以证明你能判断反例、边界条件或新场景中的适用性。",
            misconceptionAddressed:
              input.sourceKind === "paper" ? `把${focus}当成论文摘要，而不是可审查、可迁移的研究论证。` : `把${focus}当成可复述知识，而不是可迁移模型。`
          }
        }
      : {})
  };
}

function learningGoalForPage(sourceKind: string, focus: string, pageType: string): string {
  if (sourceKind === "paper") {
    const goals: Record<string, string> = {
      problem_scene: `定位${focus}的研究问题`,
      intuition_visual: `建立${focus}的论文阅读直觉`,
      structure_diagram: `画出${focus}的方法机制`,
      process_animation: `追踪${focus}的证据路径`,
      interactive_model: `检验${focus}的论证强度`,
      code_walkthrough: `连接${focus}的正式表达`,
      quiz: `判断${focus}的实验/证据是否支撑贡献`,
      misconception_check: `修正关于${focus}贡献的过度外推`,
      transfer_challenge: `判断${focus}的迁移边界`,
      summary_card: `压缩${focus}的论文精读模型`
    };
    return goals[pageType] ?? `建立${focus}的论文精读模型`;
  }
  const goals: Record<string, string> = {
    problem_scene: `识别${focus}要解决的真实问题`,
    intuition_visual: `用直觉模型解释${focus}`,
    structure_diagram: `画出${focus}的机制结构`,
    process_animation: `追踪${focus}的状态变化`,
    interactive_model: `通过操作检验${focus}的因果关系`,
    code_walkthrough: `把${focus}连接到正式表达`,
    quiz: `用${focus}做非 trivia 判断`,
    misconception_check: `修正关于${focus}的常见误区`,
    transfer_challenge: `把${focus}迁移到新场景`,
    summary_card: `压缩${focus}的可回忆模型`
  };
  return goals[pageType] ?? `建立${focus}的课程级心智模型`;
}

function narrativeForPage(unit: TrialUnitBlueprint, pageBlueprint: TrialPageBlueprint, focus: string, sourceKind: string): string {
  const context = sourceContextSentence(unit);
  const mustInclude = compactMustInclude(pageBlueprint.mustInclude);
  if (sourceKind === "paper") {
    return paperNarrativeForPage(pageBlueprint, focus, context, mustInclude);
  }
  const academicFrame = "先修概念和正式术语用来定位问题；证据链与局限边界用来判断结论强度。";
  const templates: Record<string, string> = {
    problem_scene: `先看一个失败场景：如果只会复述${focus}，遇到边界条件时就无法判断方案是否适用。${context}${academicFrame}课堂讨论从“问题为什么存在”开始。`,
    intuition_visual: `${focus}先用一个可观察模型进入：让学习者预测下一步，再比较预测和来源证据。${context}类比只负责建立直觉，局限边界必须单独标出。`,
    structure_diagram: `把${focus}拆成问题、机制、证据和反例四个节点。${context}学习者需要指出哪条边决定结论可靠性，而不是只记住术语。`,
    process_animation: `沿时间顺序追踪${focus}的变化：输入、内部状态、证据反馈和输出判断依次出现。${context}每一步都要说明触发条件。`,
    interactive_model: `让学习者在两条解释路径之间选择：先看证据边界，或先背定义。${context}反馈要指出选择如何改变机制模型和迁移可靠性。`,
    code_walkthrough: `正式表达只放短片段：用变量、公式或伪代码标出${focus}中的结构位置。${context}重点是把直觉模型映射到可检查表示。`,
    quiz: `这个检查题要求学习者用${focus}判断一个新例子。${context}正确答案必须同时说明机制、证据链、局限边界和反例。`,
    misconception_check: `常见误区是把${focus}当成可复述结论。${context}反例会显示：缺少边界条件时，同一句话在新场景可能失效。`,
    transfer_challenge: `迁移任务换一个表层场景，但保留相同结构。${context}课后作业要求写出哪些结构可迁移，哪些假设不能迁移。`,
    summary_card: `最后把${focus}压缩成一张记忆卡：问题、机制、证据、边界、迁移各一句。${context}复习时先复述模型，再检查反例。`
  };
  return `${templates[pageBlueprint.pageType] ?? templates.problem_scene}${mustInclude ? ` 你要抓住：${mustInclude}。` : ""}`;
}

function paperNarrativeForPage(pageBlueprint: TrialPageBlueprint, focus: string, context: string, mustInclude: string): string {
  const templates: Record<string, string> = {
    problem_scene: `先把${focus}当作论文精读对象：研究问题是什么，论文贡献 claim 解决了哪个旧解释无法处理的缺口？${context}学习者要先区分作者提出了什么和证据实际支持了什么。`,
    intuition_visual: `${focus}的直觉模型不是类比故事，而是论文阅读地图：研究问题、论文贡献、方法机制、实验/证据、局限边界、迁移边界。${context}学习者先预测贡献最依赖哪条证据。`,
    structure_diagram: `把${focus}画成方法机制图：输入、角色/模块、关键假设、证据反馈和输出结论。${context}方法假设必须和论文贡献分开标注。`,
    process_animation: `沿论文论证路径追踪${focus}：研究问题提出、方法机制展开、实验/证据进入、局限边界收束。${context}每一步都要问证据是否足够。`,
    interactive_model: `让学习者在两种读法中选择：先审查实验/证据，或先接受论文贡献。${context}反馈要说明为什么证据优先能降低过度外推风险。`,
    code_walkthrough: `正式表达只服务于方法机制：用短伪代码、公式或接口描述${focus}如何产生可观察结果。${context}不要把实现细节误读成论文贡献本身。`,
    quiz: `这个检查题要求学习者判断实验/证据是否足以支撑${focus}的论文贡献。${context}正确回答必须指出方法机制、证据链和局限边界。`,
    misconception_check: `常见误区是把论文贡献当成已被完全证明的工程规律。${context}局限边界和威胁说明了哪些结论还不能迁移。`,
    transfer_challenge: `迁移任务要求把${focus}放到另一篇论文或新 agent 系统中。${context}只有研究问题同构、方法假设保留、证据路径可复现时，迁移边界才成立。`,
    summary_card: `最后用六格卡片压缩${focus}：研究问题、论文贡献、方法机制、实验/证据、局限边界、迁移边界。${context}复习时先检查论证链，再复述术语。`
  };
  return `${templates[pageBlueprint.pageType] ?? templates.problem_scene}${mustInclude ? ` 你要抓住：${mustInclude}。` : ""}`;
}

function visualDescriptionForPage(focus: string, pageBlueprint: TrialPageBlueprint): string {
  const visualPurpose: Record<string, string> = {
    problem_scene: "用问题场景图标出失败状态和决策分叉",
    intuition_visual: "用对照图展示直觉模型成立和失效的位置",
    structure_diagram: "用节点和边标出机制、证据、反例和迁移关系",
    process_animation: "用 timeline 或 stepper 展示状态变化",
    interactive_model: "用前后状态对照展示学习者选择造成的差异",
    code_walkthrough: "用短代码或公式高亮结构映射",
    quiz: "把题目放回前面的机制图中定位判断依据",
    misconception_check: "用 before/after 或反例图显示误区失败点",
    transfer_challenge: "用两个场景的结构映射图展示可迁移部分",
    summary_card: "用一张 summary card 压缩问题、机制、边界和迁移"
  };
  return `${visualPurpose[pageBlueprint.pageType] ?? pageBlueprint.visualRequirement}；图中显式标注${focus}的问题、机制、证据边界和迁移路径。`;
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

function sourceContextSentence(unit: TrialUnitBlueprint): string {
  const terms = uniqueStrings([...(unit.semanticHints?.keyTerms ?? []), ...termsFromTeachingMoves(unit.semanticHints?.teachingMoves ?? [])]).slice(0, 3);
  const termSentence = terms.length > 0 ? `来源术语：${terms.join("、")}。` : "";
  const evidenceSentence = unit.semanticHints?.evidenceHints?.length ? "来源证据链需要单独核对。" : "";
  const limitationSentence = unit.semanticHints?.limitationHints?.length ? "来源局限边界需要显式标出。" : "";
  return `${termSentence}${evidenceSentence}${limitationSentence}`;
}

function termsFromTeachingMoves(moves: string[]): string[] {
  return moves
    .map((move) => /来源术语\s+(.+?)\s+设计/u.exec(move)?.[1]?.trim() ?? "")
    .filter(Boolean);
}

function compactMustInclude(items: string[]): string {
  return uniqueStrings(items.map(compactChecklistItem).filter(Boolean)).slice(0, 4).join("；");
}

function compactChecklistItem(item: string): string {
  if (item.startsWith("聚焦概念")) return "聚焦概念";
  if (item.startsWith("受众可理解的例子")) return "直觉例子";
  if (item.startsWith("核心结构")) return "核心结构";
  if (item.startsWith("交互目标")) return "可见交互结果";
  if (item.startsWith("检查类型")) return "非记忆判断题";
  if (item.includes("trivia")) return "非记忆判断题";
  if (item.includes("feedbackSpec")) return "解释性反馈";
  if (item.startsWith("误区必须围绕")) return "误区反例";
  if (item.startsWith("迁移概念")) return "迁移映射";
  if (item.startsWith("把总览地图迁移")) return "后续单元迁移";
  if (item.startsWith("把该概念迁移")) return "新场景迁移";
  if (item.startsWith("一句话模型")) return "一句话模型";
  if (item.startsWith("来源术语")) return "来源术语";
  if (item.includes("证据链")) return "来源证据链";
  if (item.includes("局限边界")) return "来源局限边界";
  if (item.includes("课程定位")) return "课程定位：大学课程";
  return trimLabel(item, 18);
}

function focusLabel(unit: TrialUnitBlueprint): string {
  if (unit.unitKind === "overview") {
    return "总览地图";
  }
  const concept = unit.focusConcepts.find(Boolean) ?? unit.title.split("：").at(-1) ?? unit.title;
  return trimLabel(concept, 18);
}

function trimLabel(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
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
