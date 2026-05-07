import type { PlannedCourseUnit } from "./course-unit-planner.js";
import { difficultyLabel, type TeachingDifficultyLevel } from "./learner-project-service.js";
import type { SourceSemantics } from "./source-semantic-extractor.js";

export type ContentBlueprint = {
  version: "content-blueprint/v1";
  globalRules: string[];
  units: UnitContentBlueprint[];
};

export type UnitContentBlueprint = {
  unitId: string;
  lessonId: string;
  title: string;
  targetPageCount: number;
  unitKind: PlannedCourseUnit["kind"];
  focusConcepts: string[];
  sourceAnchorIds: string[];
  semanticHints?: UnitSemanticHints;
  sourceRequirement: string;
  pageBlueprints: PageContentBlueprint[];
};

export type UnitSemanticHints = {
  keyTerms: string[];
  evidenceHints: string[];
  limitationHints: string[];
  teachingMoves: string[];
};

export type PageContentBlueprint = {
  pageNumber: number;
  pageType: string;
  teachingMove: string;
  learnerAction: string;
  visualRequirement: string;
  feedbackRequirement: string;
  sourceRequirement: string;
  mustInclude: string[];
};

export type BuildContentBlueprintInput = {
  audience: string;
  difficultyLevel?: TeachingDifficultyLevel;
  sourceKind: string;
  units: PlannedCourseUnit[];
  sourceSemantics?: SourceSemantics;
};

type PageTemplate = Omit<PageContentBlueprint, "pageNumber" | "sourceRequirement" | "mustInclude"> & {
  mustInclude: (unit: PlannedCourseUnit, sourceKind: string) => string[];
};

export function buildContentBlueprint(input: BuildContentBlueprintInput): ContentBlueprint {
  return {
    version: "content-blueprint/v1",
    globalRules: globalRules(input),
    units: input.units.map((unit) => buildUnitBlueprint(unit, input.sourceKind, input.difficultyLevel, input.sourceSemantics))
  };
}

function globalRules(input: BuildContentBlueprintInput): string[] {
  const levelLabel = difficultyLabel(input.difficultyLevel ?? "upper_undergraduate_or_graduate");
  return [
    `所有 learner-facing 内容必须中文优先，围绕 ${input.audience} 的已有知识和阅读习惯设计。`,
    `教学难度层级为${levelLabel}：要有先修概念、正式术语、来源阅读映射、课堂讨论题和课后作业感，避免泛泛科普。`,
    "不要把资料改写成摘要；每页必须有一个学习动作、一个可见结构或一个可检查判断。",
    "术语、公式、代码和定义必须放在直觉、视觉模型和 learner action 之后。",
    "反馈必须解释为什么，指出错误假设、因果机制和可迁移规则。",
    ...(requiresPaperResearchMoves(input.sourceKind, input.difficultyLevel)
      ? ["论文精读必须显式覆盖：研究问题、论文贡献、方法机制、实验/证据、局限/威胁、迁移判断。"]
      : []),
    ...(input.sourceKind === "patent"
      ? ["专利解读必须显式覆盖：权利要求边界、现有技术问题、技术方案/机制、实施例、法律/适用边界、规避或迁移判断。"]
      : []),
    ...(input.sourceKind === "blog"
      ? ["实践案例必须显式覆盖：实际问题、作者方案、实现路径、caveat/失败模式、可操作检查、迁移边界。"]
      : []),
    ...(input.units.some((unit) => unit.targetPageCount < 8)
      ? ["存在少于 8 页的 compact unit；必须合并页面职能但保留 learner action、误区检查、迁移和总结。"]
      : [])
  ];
}

function buildUnitBlueprint(
  unit: PlannedCourseUnit,
  sourceKind: string,
  difficultyLevel: TeachingDifficultyLevel | undefined,
  sourceSemantics: SourceSemantics | undefined
): UnitContentBlueprint {
  const sourceRequirement = sourceRequirementForUnit(unit, sourceKind);
  const semanticHints = semanticHintsForUnit(unit, sourceSemantics);
  return {
    unitId: unit.unitId,
    lessonId: unit.lessonId,
    title: unit.title,
    targetPageCount: unit.targetPageCount,
    unitKind: unit.kind,
    focusConcepts: unit.focusConcepts,
    sourceAnchorIds: unit.sourceAnchorIds,
    ...(semanticHints ? { semanticHints } : {}),
    sourceRequirement,
    pageBlueprints: templatesForPageCount(unit.targetPageCount).map((template, index) => ({
      pageNumber: index + 1,
      pageType: template.pageType,
      teachingMove: template.teachingMove,
      learnerAction: template.learnerAction,
      visualRequirement: template.visualRequirement,
      feedbackRequirement: template.feedbackRequirement,
      sourceRequirement,
      mustInclude: [
        ...template.mustInclude(unit, sourceKind),
        ...paperResearchMustInclude(template.pageType, sourceKind, difficultyLevel),
        ...sourceKindDepthMustInclude(template.pageType, sourceKind),
        ...mustIncludeSemanticHints(semanticHints)
      ]
    }))
  };
}

function requiresPaperResearchMoves(sourceKind: string, difficultyLevel: TeachingDifficultyLevel | undefined): boolean {
  return sourceKind === "paper" || difficultyLevel === "research";
}

function paperResearchMustInclude(pageType: string, sourceKind: string, difficultyLevel: TeachingDifficultyLevel | undefined): string[] {
  if (!requiresPaperResearchMoves(sourceKind, difficultyLevel)) {
    return [];
  }
  if (pageType === "problem_scene") {
    return ["研究问题", "论文贡献 claim"];
  }
  if (pageType === "structure_diagram") {
    return ["方法机制", "方法假设"];
  }
  if (pageType === "quiz") {
    return ["实验/证据路径"];
  }
  if (pageType === "misconception_check") {
    return ["局限/威胁", "过度外推风险"];
  }
  if (pageType === "transfer_challenge") {
    return ["迁移判断", "迁移边界"];
  }
  if (pageType === "summary_card") {
    return ["研究问题/贡献/机制/证据/局限/迁移"];
  }
  return [];
}

function sourceKindDepthMustInclude(pageType: string, sourceKind: string): string[] {
  if (sourceKind === "patent") {
    return patentMustInclude(pageType);
  }
  if (sourceKind === "blog") {
    return blogMustInclude(pageType);
  }
  return [];
}

function patentMustInclude(pageType: string): string[] {
  if (pageType === "problem_scene") {
    return ["权利要求边界", "现有技术问题"];
  }
  if (pageType === "structure_diagram") {
    return ["技术方案/机制", "实施例"];
  }
  if (pageType === "quiz") {
    return ["权利要求 vs 实施例"];
  }
  if (pageType === "misconception_check") {
    return ["法律/适用边界", "保护范围误读"];
  }
  if (pageType === "transfer_challenge") {
    return ["规避或迁移判断", "法律/适用边界"];
  }
  if (pageType === "summary_card") {
    return ["权利要求/问题/方案/实施例/边界/迁移"];
  }
  return [];
}

function blogMustInclude(pageType: string): string[] {
  if (pageType === "problem_scene") {
    return ["实际问题", "实践上下文"];
  }
  if (pageType === "structure_diagram") {
    return ["作者方案", "实现路径"];
  }
  if (pageType === "quiz") {
    return ["可操作检查"];
  }
  if (pageType === "misconception_check") {
    return ["caveat/失败模式", "过度泛化风险"];
  }
  if (pageType === "transfer_challenge") {
    return ["迁移边界", "可操作检查"];
  }
  if (pageType === "summary_card") {
    return ["实际问题/作者方案/实现路径/caveat/检查/迁移"];
  }
  return [];
}

function semanticHintsForUnit(unit: PlannedCourseUnit, sourceSemantics: SourceSemantics | undefined): UnitSemanticHints | undefined {
  if (!sourceSemantics) {
    return undefined;
  }
  const unitAnchorIds = new Set(unit.sourceAnchorIds);
  const matchesUnit = (anchorIds: string[]) => anchorIds.length === 0 || anchorIds.some((anchorId) => unitAnchorIds.has(anchorId));
  const keyTerms = sourceSemantics.keyTerms.filter((term) => matchesUnit(term.sourceAnchorIds)).map((term) => term.term).slice(0, 6);
  const evidenceHints = sourceSemantics.evidenceHints.filter((hint) => matchesUnit(hint.sourceAnchorIds)).map((hint) => hint.statement).slice(0, 3);
  const limitationHints = sourceSemantics.limitationHints.filter((hint) => matchesUnit(hint.sourceAnchorIds)).map((hint) => hint.statement).slice(0, 3);
  const teachingMoves = sourceSemantics.sourceSpecificTeachingMoves.slice(0, 4);
  if (keyTerms.length === 0 && evidenceHints.length === 0 && limitationHints.length === 0 && teachingMoves.length === 0) {
    return undefined;
  }
  return { keyTerms, evidenceHints, limitationHints, teachingMoves };
}

function mustIncludeSemanticHints(semanticHints: UnitSemanticHints | undefined): string[] {
  if (!semanticHints) {
    return [];
  }
  return [
    ...(semanticHints.keyTerms.length > 0 ? [`来源术语：${semanticHints.keyTerms.join("、")}`] : []),
    ...(semanticHints.evidenceHints.length > 0 ? ["来源证据链"] : []),
    ...(semanticHints.limitationHints.length > 0 ? ["来源局限边界"] : [])
  ];
}

function templatesForPageCount(targetPageCount: number): PageTemplate[] {
  if (targetPageCount < 8) {
    return compactTemplates.slice(0, Math.max(1, targetPageCount));
  }
  if (targetPageCount === 8) {
    return standardTemplates;
  }
  const extraCount = Math.max(0, targetPageCount - 8);
  const [problem, intuition, structure, interactive, quiz, misconception, transfer, summary] = standardTemplates as [
    PageTemplate,
    PageTemplate,
    PageTemplate,
    PageTemplate,
    PageTemplate,
    PageTemplate,
    PageTemplate,
    PageTemplate
  ];
  return [
    problem,
    intuition,
    structure,
    ...(extraCount >= 1 ? [deepeningTemplates[0] as PageTemplate] : []),
    interactive,
    ...(extraCount >= 2 ? [deepeningTemplates[1] as PageTemplate] : []),
    ...deepeningTemplates.slice(2, extraCount),
    quiz,
    misconception,
    transfer,
    summary
  ].slice(0, targetPageCount);
}

function sourceRequirementForUnit(unit: PlannedCourseUnit, sourceKind: string): string {
  if (sourceKind === "topic" || unit.sourceAnchorIds.length === 0) {
    return "topic-only 页面必须清楚区分常识、推理和示例；不要伪造 sourceAnchorIds。";
  }
  return "source-backed 页面必须包含 page.sourceAnchorIds；没有直接依据的推理页设置 grounding.kind 为 inferred，类比页设置为 analogy。";
}

const standardTemplates: PageTemplate[] = [
  {
    pageType: "problem_scene",
    teachingMove: "从真实问题进入，不先下定义。",
    learnerAction: "判断当前问题为什么值得学，以及如果没有该概念会卡在哪里。",
    visualRequirement: "画出问题场景、输入输出、失败状态或决策分叉。",
    feedbackRequirement: "解释这个问题暴露了哪个心智模型缺口。",
    mustInclude: (unit) => [`聚焦概念：${focusLabel(unit)}`, "课程定位：大学高年级/研究生课程", "一个真实或接近真实的问题"]
  },
  {
    pageType: "intuition_visual",
    teachingMove: "用直觉模型或类比建立第一层理解。",
    learnerAction: "预测直觉模型中的下一步变化。",
    visualRequirement: "使用可标注的图、流程、状态变化或对照关系。",
    feedbackRequirement: "说明类比成立和不成立的边界。",
    mustInclude: (unit) => [`受众可理解的例子：${focusLabel(unit)}`, "边界说明"]
  },
  {
    pageType: "structure_diagram",
    teachingMove: "揭示内部结构、组件关系或因果链。",
    learnerAction: "指出结构中哪个部分决定结果。",
    visualRequirement: "明确标注节点、边、状态、约束或数据流。",
    feedbackRequirement: "解释结构变化怎样导致结果变化。",
    mustInclude: (unit) => [`核心结构：${focusLabel(unit)}`, "关键标签"]
  },
  {
    pageType: "interactive_model",
    teachingMove: "让学习者操作模型，而不是只观看演示。",
    learnerAction: "操作参数、步骤、路径或策略，并预测观察结果。",
    visualRequirement: "交互前后状态必须可见，差异必须可比较。",
    feedbackRequirement: "反馈要解释因果机制和错误假设。",
    mustInclude: (unit) => [`交互目标：${unit.expectedInteractions.join("、") || "prediction"}`, "可见结果变化"]
  },
  {
    pageType: "quiz",
    teachingMove: "检查学习者是否能用模型做判断。",
    learnerAction: "选择、排序或预测一个非 trivia 问题。",
    visualRequirement: "题目应关联前面的结构或过程图。",
    feedbackRequirement: "正确和错误反馈都必须解释为什么。",
    mustInclude: (unit) => [`检查类型：${unit.expectedAssessments[0] ?? "prediction_check"}`, "大学课程级非 trivia 判断题", "解释性 feedbackSpec"]
  },
  {
    pageType: "misconception_check",
    teachingMove: "暴露常见错误信念。",
    learnerAction: "判断一个看似合理但有边界问题的说法。",
    visualRequirement: "用 before/after 或反例图显示误区失败点。",
    feedbackRequirement: "指出学习者可能相信了什么，以及应该更新成什么规则。",
    mustInclude: (unit) => [`误区必须围绕：${focusLabel(unit)}`, "反例或边界条件"]
  },
  {
    pageType: "transfer_challenge",
    teachingMove: "把同一心智模型迁移到新场景。",
    learnerAction: "在新问题中选择策略、解释结果或修复状态。",
    visualRequirement: "新场景要和原场景有结构相似性但表层不同。",
    feedbackRequirement: "解释哪些结构可迁移，哪些上下文不能迁移。",
    mustInclude: (unit) => [unit.transferExpectation, `迁移概念：${focusLabel(unit)}`]
  },
  {
    pageType: "summary_card",
    teachingMove: "压缩成可回忆的心智模型。",
    learnerAction: "用自己的话复述问题、结构、操作和迁移规则。",
    visualRequirement: "使用一张 summary card、流程短链或记忆框架。",
    feedbackRequirement: "总结必须包含使用边界和下一步练习方向。",
    mustInclude: (unit) => [`一句话模型：${focusLabel(unit)}`, "使用边界"]
  }
];

const deepeningTemplates: PageTemplate[] = [
  {
    pageType: "process_animation",
    teachingMove: "展示机制如何随时间推进。",
    learnerAction: "逐步预测下一状态或下一决策。",
    visualRequirement: "用 timeline、stepper 或状态转移图展示变化。",
    feedbackRequirement: "解释每一步变化的触发条件和结果。",
    mustInclude: (unit) => [`过程：${focusLabel(unit)}`, "状态变化"]
  },
  {
    pageType: "code_walkthrough",
    teachingMove: "把直觉模型连接到代码、公式或正式表达。",
    learnerAction: "定位短代码或公式中对应的结构部分。",
    visualRequirement: "只展示短片段，并高亮执行路径或变量变化。",
    feedbackRequirement: "解释代码/公式如何实现前面的心智模型。",
    mustInclude: (unit, sourceKind) => [`正式表达：${focusLabel(unit)}`, `${sourceKind} 来源边界`]
  }
];

const compactTemplates: PageTemplate[] = [
  standardTemplates[0] as PageTemplate,
  standardTemplates[2] as PageTemplate,
  standardTemplates[3] as PageTemplate,
  standardTemplates[4] as PageTemplate,
  standardTemplates[6] as PageTemplate,
  standardTemplates[7] as PageTemplate
];

function focusLabel(unit: PlannedCourseUnit): string {
  return unit.focusConcepts.filter(Boolean).join("、") || unit.title;
}
