import type { PlannedCourseUnit } from "./course-unit-planner.js";
import { defaultCourseIntent, type CourseIntent } from "./course-intent.js";
import { difficultyLabel, type TeachingDifficultyLevel } from "./learner-project-service.js";
import type { SourceSemantics } from "./source-semantic-extractor.js";

export type ContentBlueprint = {
  version: "content-blueprint/v1";
  courseIntent: CourseIntent;
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
  lectureRole?: string;
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
  courseIntent?: CourseIntent;
  units: PlannedCourseUnit[];
  sourceSemantics?: SourceSemantics;
};

type PageTemplate = Omit<PageContentBlueprint, "pageNumber" | "sourceRequirement" | "mustInclude"> & {
  mustInclude: (unit: PlannedCourseUnit, sourceKind: string) => string[];
};

export function buildContentBlueprint(input: BuildContentBlueprintInput): ContentBlueprint {
  const courseIntent = input.courseIntent ?? defaultCourseIntent;
  return {
    version: "content-blueprint/v1",
    courseIntent,
    globalRules: globalRules({ ...input, courseIntent }),
    units: input.units.map((unit) => buildUnitBlueprint(unit, input.sourceKind, input.difficultyLevel, input.sourceSemantics, courseIntent))
  };
}

function globalRules(input: BuildContentBlueprintInput): string[] {
  const levelLabel = difficultyLabel(input.difficultyLevel ?? "upper_undergraduate_or_graduate");
  return [
    `所有 learner-facing 内容必须中文优先，围绕 ${input.audience} 的已有知识和阅读习惯设计。`,
    `教学难度层级为${levelLabel}：要有先修概念、正式术语、来源阅读映射、课堂讨论题和课后作业感，避免泛泛科普。`,
    ...(input.courseIntent === "professor_lecture_deck"
      ? [
          "课程形态为教授式课程讲义 Web Deck：像大学/研究生课堂讲义一样组织课程框架、概念地图、方法谱系、经典例题、课堂讨论和课后作业。",
          "不要生成 PPTX、Slides 或文件导出话术；最终产物仍是 Web Deck。",
          "不要求每页都有操作型 interaction，但每个 lesson 至少包含 2 个教学目的明确的 interactionSpec，且每页必须有清晰 lecture purpose、可见结构或课堂判断任务。"
        ]
      : [
          "不要把资料改写成摘要；每页必须有一个学习动作、一个可见结构或一个可检查判断。",
          "术语、公式、代码和定义必须放在直觉、视觉模型和 learner action 之后。",
          "反馈必须解释为什么，指出错误假设、因果机制和可迁移规则。"
        ]),
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
  sourceSemantics: SourceSemantics | undefined,
  courseIntent: CourseIntent
): UnitContentBlueprint {
  const sourceRequirement = sourceRequirementForUnit(unit, sourceKind);
  const semanticHints = semanticHintsForUnit(unit, sourceSemantics);
  const templates =
    courseIntent === "professor_lecture_deck" ? professorLectureTemplatesForPageCount(unit.targetPageCount) : templatesForPageCount(unit.targetPageCount);
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
    pageBlueprints: templates.map((template, index) => ({
      pageNumber: index + 1,
      pageType: template.pageType,
      ...(template.lectureRole ? { lectureRole: template.lectureRole } : {}),
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

function professorLectureTemplatesForPageCount(targetPageCount: number): PageTemplate[] {
  const templates: PageTemplate[] = [
    professorTemplate(
      "lecture_framing",
      "problem_scene",
      "用一页说明这门课/本单元的课程定位、核心问题和学习收益。",
      "判断这门课要解决什么问题，以及哪些内容不是本讲重点。",
      "课程框架图或问题空间地图。",
      "用课堂讲义式答案说明为什么这些问题构成课程主线。",
      ["课程框架", "核心问题", "本讲边界"]
    ),
    professorTemplate(
      "prerequisite_map",
      "structure_diagram",
      "列出先修知识、符号、术语和学习者需要补齐的背景。",
      "标记自己已掌握、需要复习和可以跳过的先修点。",
      "先修知识依赖图。",
      "解释缺少哪些先修会影响后续理解。",
      ["先修要求", "术语准备", "学习路径"]
    ),
    professorTemplate(
      "concept_framework",
      "structure_diagram",
      "给出本讲概念地图、方法谱系或理论框架。",
      "指出核心概念之间的依赖、对比和层级。",
      "概念地图、分类树或方法谱系图。",
      "解释概念之间的关系，而不是逐条摘要。",
      ["概念框架", "方法谱系", "课程骨架"]
    ),
    professorTemplate(
      "definition_block",
      "intuition_visual",
      "在课程语境中引入关键定义、记号或正式术语。",
      "把定义和前面的课程问题对应起来。",
      "定义卡片加例子/反例。",
      "说明定义服务于哪个后续推理或方法。",
      ["关键定义", "术语", "例子/反例"]
    ),
    professorTemplate(
      "method_structure",
      "interactive_model",
      "拆解核心方法、理论结构、机制或算法流程。",
      "沿结构图说明每个组成部分承担什么功能。",
      "可逐步操作的方法结构图、流程图或系统图。",
      "说明结构中每一步的因果角色。",
      ["方法结构", "机制", "适用条件"]
    ),
    professorTemplate(
      "worked_example",
      "code_walkthrough",
      "用经典例题、案例、推导或 proof sketch 连接抽象和应用。",
      "跟随例题判断每一步为什么成立。",
      "例题分步板书、公式推导或案例表。",
      "解释例题暴露了什么通用解题模式。",
      ["经典例题", "推导", "case analysis"]
    ),
    professorTemplate(
      "comparison_taxonomy",
      "misconception_check",
      "比较相关方法、理论分支、设计选择或常见路线。",
      "根据条件选择适合的方法，并说明权衡。",
      "对比表、二维坐标或 taxonomy。",
      "解释不同方法的适用边界和取舍。",
      ["方法比较", "taxonomy", "权衡"]
    ),
    professorTemplate(
      "discussion_prompt",
      "quiz",
      "提出课堂讨论题，要求学习者做诊断、批判或设计判断。",
      "给出自己的判断和依据。",
      "讨论题卡片和参考要点。",
      "提供课堂式参考答案，不只给对错。",
      ["课堂讨论题", "批判性问题", "参考要点"]
    ),
    professorTemplate(
      "homework_task",
      "transfer_challenge",
      "给出课后作业、阅读路径或小型 problem set。",
      "选择一道作业并说明需要回看哪些来源。",
      "作业列表、阅读路径或 problem set。",
      "说明作业如何巩固课程主线。",
      ["课后作业", "阅读路径", "problem set"]
    ),
    professorTemplate(
      "lecture_takeaway",
      "summary_card",
      "压缩本讲 takeaways、考试/研究/实践中最该带走的结构。",
      "复述三条 takeaway 并指出一条仍不清楚的点。",
      "takeaway 卡片和复习清单。",
      "说明这些 takeaway 如何指导后续学习。",
      ["本讲 takeaway", "复习清单", "下一讲衔接"]
    )
  ];
  const extensionTemplates: PageTemplate[] = [
    professorTemplate(
      "reading_path",
      "structure_diagram",
      "补充本讲之后的阅读路径、来源章节和扩展材料定位。",
      "选择一条阅读路径并说明它补齐哪一类理解缺口。",
      "来源阅读路径图或章节到概念映射。",
      "说明不同阅读路径适合的学习目标和先修状态。",
      ["阅读路径", "来源章节", "扩展材料"]
    ),
    professorTemplate(
      "synthesis_review",
      "quiz",
      "用综合复盘题检查学习者能否把框架、方法和边界连起来。",
      "回答一个综合判断题，并指出需要回看的概念或例题。",
      "综合复盘题卡片和参考答案要点。",
      "用课堂式 answer notes 解释判断依据和常见遗漏。",
      ["综合复盘", "answer notes", "回看路径"]
    )
  ];
  if (targetPageCount <= 6) {
    return [templates[0]!, templates[4]!, templates[6]!, templates[7]!, templates[8]!, templates[9]!].slice(0, Math.max(1, targetPageCount));
  }
  if (targetPageCount <= 8) {
    return [templates[0]!, templates[1]!, templates[2]!, templates[4]!, templates[5]!, templates[6]!, templates[7]!, templates[9]!];
  }
  return [...templates, ...extensionTemplates].slice(0, targetPageCount);
}

function professorTemplate(
  lectureRole: string,
  pageType: string,
  teachingMove: string,
  learnerAction: string,
  visualRequirement: string,
  feedbackRequirement: string,
  mustInclude: string[]
): PageTemplate {
  return {
    lectureRole,
    pageType,
    teachingMove,
    learnerAction,
    visualRequirement,
    feedbackRequirement,
    mustInclude: () => mustInclude
  };
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
