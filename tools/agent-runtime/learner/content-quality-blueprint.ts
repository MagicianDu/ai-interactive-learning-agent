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
    `教学难度层级为${levelLabel}：要有先修概念、正式术语、来源阅读映射、关键节点、关键链路、例子和边界条件，避免泛泛科普。`,
    ...courseIntentGlobalRules(input.courseIntent),
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

function courseIntentGlobalRules(courseIntent: CourseIntent | undefined): string[] {
  if (courseIntent === "professor_lecture_deck") {
    return [
      "课程形态为教材式知识链路 Web Deck：像大学/研究生课程课件，标题清楚、内容高密度、图表服务理解。",
      "每页只讲一个知识节点或一条关键链路；显性页面结构优先使用定义、公式/伪代码、图、例子、对比、边界和总结。",
      "教授式页面必须优先产出 page.knowledgeBoard，字段包括 headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine；title/narrative 只保留兼容摘要。",
      "knowledgeBoard 内容逻辑必须是 source proposition -> decomposition -> evidence -> reconstruction：先写原文命题，再拆解为结构化知识链，给出来源证据，最后重构为可迁移结论。",
      "每个 knowledgeBoard 至少包含两个结构化 sections：leftColumn 与 rightColumn；section 可承载 example、mechanism、comparison、boundary，sourceTrace 必须记录来源支持关系。",
      "不要生成 PPTX、Slides 或文件导出话术；最终产物仍是 Web Deck。",
      "教授式 Web Deck 不强制 interactionSpec 或页内 assessment；如果保留内部 spec，学生侧也不应显性看到教学设计包装。"
    ];
  }
  if (courseIntent === "student_self_study_textbook") {
    return [
      "课程形态为学生自学 Web 教材：每页必须直接讲清楚一个知识片段，而不是给老师提示该讲什么。",
      "每页优先产出 page.knowledgeBoard；headline 是学习者问题或知识命题，coreProposition 是本页要讲清楚的答案。",
      "leftColumn 放概念、机制、因果链、定义或推导；rightColumn 放例子、反例、来源证据或适用边界。",
      "不要出现本讲定位、课堂讨论、教授讲义、课后作业、教学目标、教学设计、识别本页中的作用等教师视角话术。",
      "如果内容放不下一屏，必须拆成多页；不要通过长段落或纵向滚动承载密度。",
      "100 页只是长书默认建议，不是硬限制；用户指定页数优先。"
    ];
  }
  return [
    "不要把资料改写成摘要；每页必须有一个学习动作、一个可见结构或一个可检查判断。",
    "术语、公式、代码和定义必须放在直觉、视觉模型和 learner action 之后。",
    "反馈必须解释为什么，指出错误假设、因果机制和可迁移规则。"
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
    courseIntent === "professor_lecture_deck"
      ? professorLectureTemplatesForPageCount(unit.targetPageCount)
      : courseIntent === "student_self_study_textbook"
        ? selfStudyTemplatesForPageCount(unit.targetPageCount)
        : templatesForPageCount(unit.targetPageCount);
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

function selfStudyTemplatesForPageCount(targetPageCount: number): PageTemplate[] {
  const templates: PageTemplate[] = [
    selfStudyTemplate(
      "problem_scene",
      "把本单元最重要的学习问题讲清楚：学习者为什么需要自己读懂这一段内容。",
      "根据页面给出的材料，先判断自己读懂这个问题需要抓住哪些关键条件。",
      "问题场景图、最小上下文和需要解释的核心矛盾。",
      "说明这个问题背后的知识缺口，以及后续页面会如何补齐。",
      ["学习问题", "最小上下文", "为什么重要"]
    ),
    selfStudyTemplate(
      "intuition_visual",
      "用直观图或小例子建立第一层理解，避免一开始堆术语。",
      "用自己的话复述这个直观模型，并指出它能解释什么、不能解释什么。",
      "直观模型、正例和反例边界。",
      "解释类比或直觉成立的条件，提醒哪些地方不能过度外推。",
      ["直观模型", "正例", "反例或边界"]
    ),
    selfStudyTemplate(
      "structure_diagram",
      "拆出本页的概念结构：节点是什么，节点之间靠什么关系连接。",
      "顺着结构图自己读懂每个节点在整条知识链里的位置。",
      "概念图、层级图或依赖关系图。",
      "说明每个结构节点的功能，以及缺失某节点会导致什么理解断裂。",
      ["概念节点", "依赖关系", "结构功能"]
    ),
    selfStudyTemplate(
      "process_animation",
      "讲清楚关键机制如何一步步发生，不停留在静态定义。",
      "沿着步骤解释每一步为什么会导向下一步。",
      "时间线、状态迁移图或流程板书。",
      "说明每一步的触发条件、结果和失败信号。",
      ["机制步骤", "触发条件", "结果变化"]
    ),
    selfStudyTemplate(
      "code_walkthrough",
      "把来源中的公式、伪代码、架构片段或术语连接到前面的结构。",
      "定位正式表达中对应的概念节点，并解释它为什么必要。",
      "短公式/伪代码/术语表加高亮注释。",
      "解释正式表达如何压缩前面的直观机制，避免只背符号。",
      ["正式表达", "符号含义", "和前页结构的对应关系"]
    ),
    selfStudyTemplate(
      "structure_diagram",
      "比较两个容易混淆的概念、模式、条件或设计选择。",
      "根据对比表判断什么时候该用哪个解释，什么时候不能用。",
      "对比表、二维坐标或条件分叉图。",
      "说明差异来自条件变化、目标变化还是假设变化。",
      ["概念比较", "适用条件", "混淆边界"]
    ),
    selfStudyTemplate(
      "misconception_check",
      "指出一个读者很容易形成的错误理解，并用反例拆掉它。",
      "判断这个说法错在哪里，再把它改写成有边界的正确说法。",
      "错误说法、反例和修正后规则。",
      "解释错误理解偷换了哪个条件，正确规则应如何限定。",
      ["常见误解", "反例", "修正规则"]
    ),
    selfStudyTemplate(
      "summary_card",
      "压缩本单元的关键节点和关键链路，形成可复习的板书。",
      "用一条短链路复述从问题到结论的结构。",
      "一屏总结板书：问题、结构、机制、例子、边界。",
      "说明这张总结如何帮助继续阅读下一单元。",
      ["关键节点", "关键链路", "复习句"]
    )
  ];
  const extensionTemplates: PageTemplate[] = [
    selfStudyTemplate(
      "structure_diagram",
      "补充来源证据链：哪些原文片段支持本单元的核心结论。",
      "把来源证据和前面的知识节点逐一对应起来。",
      "来源片段到知识节点的映射表。",
      "说明哪些结论有直接来源支持，哪些属于教学推理。",
      ["来源证据链", "source-backed claim", "教学推理边界"]
    ),
    selfStudyTemplate(
      "summary_card",
      "补充一页自学回看：把本单元放回整本资料或整门课的上下文。",
      "判断自己是否能用本单元结构继续读后续章节。",
      "本单元到相邻章节/topic 的衔接图。",
      "说明下一步阅读会复用哪些节点，哪些暂时不用展开。",
      ["章节衔接", "继续阅读路径", "暂不展开内容"]
    )
  ];
  if (targetPageCount < 8) {
    const compact = [templates[0]!, templates[2]!, templates[3]!, templates[5]!, templates[6]!, templates[7]!];
    return compact.slice(0, Math.max(1, targetPageCount));
  }
  if (targetPageCount === 8) {
    return templates;
  }
  return [...templates, ...extensionTemplates].slice(0, targetPageCount);
}

function professorLectureTemplatesForPageCount(targetPageCount: number): PageTemplate[] {
  const templates: PageTemplate[] = [
    professorTemplate(
      "course_framing",
      "problem_scene",
      "说明本单元在整门课中的位置、核心问题和不覆盖的边界。",
      "沿着页面给出的主线识别本单元要解释的关键问题。",
      "课程路线图或问题空间地图。",
      "解释为什么这个问题是理解本章的入口，以及哪些直觉会误导后续阅读。",
      ["本讲定位", "核心问题", "覆盖边界"]
    ),
    professorTemplate(
      "prerequisite_map",
      "structure_diagram",
      "列出理解本单元前必须知道的先修、符号和术语。",
      "识别哪些先修会在后续链路中被反复使用。",
      "先修知识依赖图和术语表。",
      "解释缺少哪些先修会导致后续关键链路断裂。",
      ["先修要求", "术语表", "知识依赖"]
    ),
    professorTemplate(
      "concept_framework",
      "structure_diagram",
      "给出本单元概念地图、方法谱系或理论框架，并标出概念间依赖。",
      "指出核心概念之间的依赖、对比、层级和不可混淆处。",
      "概念地图、分类树或方法谱系图。",
      "解释概念之间的关系，而不是逐条摘要；指出每个概念在后续推理中的用途。",
      ["知识节点", "概念框架", "方法谱系", "概念依赖", "易混概念"]
    ),
    professorTemplate(
      "formal_definition",
      "intuition_visual",
      "引入关键定义、记号或正式术语，并说明定义解决了什么歧义。",
      "把正式定义改写成自己的话，并给出一个正例和一个反例。",
      "定义卡片、正例/反例和最小判别条件。",
      "说明定义如何支撑后续机制推导，而不是停留在术语记忆。",
      ["关键定义", "正式术语", "判别条件", "正例/反例"]
    ),
    professorTemplate(
      "knowledge_link",
      "interactive_model",
      "逐步拆解核心机制、理论结构、状态变化或算法流程。",
      "顺着关键链路解释每一步为什么会进入下一步。",
      "流程图、状态图、系统图或推导链。",
      "说明结构中每一步的因果角色、失败信号和适用条件。",
      ["关键链路", "因果角色", "状态变化", "适用条件"]
    ),
    professorTemplate(
      "worked_example",
      "code_walkthrough",
      "用经典例题、案例、推导或 proof sketch 连接抽象和应用。",
      "跟随例题判断每一步为什么成立，并补全缺失的中间理由。",
      "例题分步板书、公式推导或案例表。",
      "解释例题暴露了什么通用解题模式，以及哪些条件改变后结论会失效。",
      ["经典例题", "推导步骤", "case analysis", "可复用解法"]
    ),
    professorTemplate(
      "comparison_taxonomy",
      "misconception_check",
      "比较相关方法、理论分支、设计选择或常见边界误用。",
      "根据条件选择适合的方法，并说明权衡、边界和反例。",
      "对比表、二维坐标或 taxonomy。",
      "解释不同方法的适用边界和取舍，并指出一个常见错误判断。",
      ["方法比较", "taxonomy", "权衡", "反例", "边界条件"]
    ),
    professorTemplate(
      "application_case",
      "quiz",
      "给出一个短应用案例，用来说明前面节点和链路如何落到具体判断。",
      "根据案例识别可复用结构、限制条件和可能失效点。",
      "案例表、判断表或短场景图。",
      "说明案例如何连接定义、链路和边界条件。",
      ["应用案例", "判断依据", "边界条件"]
    ),
    professorTemplate(
      "boundary_case",
      "transfer_challenge",
      "给出一个相邻场景或反例，标出原有结论在哪些条件下仍然成立。",
      "比较原场景和新场景，识别保留条件与断裂条件。",
      "边界案例、反例或条件对照表。",
      "说明哪些结构可以沿用，哪些条件改变后结论不再成立。",
      ["相邻场景", "反例", "保留条件", "断裂条件"]
    ),
    professorTemplate(
      "summary_map",
      "summary_card",
      "压缩本单元最该记住的知识节点、关键链路、例子和边界。",
      "用短链路复述本单元从问题到结论的结构。",
      "总结图、要点表和下一单元衔接。",
      "说明这些要点如何帮助之后阅读相邻章节。",
      ["总结图", "知识节点", "关键链路", "下一单元衔接"]
    )
  ];
  const extensionTemplates: PageTemplate[] = [
    professorTemplate(
      "reading_path",
      "structure_diagram",
      "补充本单元之后的来源阅读路径、章节定位和扩展材料。",
      "选择一条阅读路径并说明它补齐哪一类理解缺口。",
      "来源阅读路径图或章节到概念映射。",
      "说明不同阅读路径适合的学习目标和先修状态。",
      ["阅读路径", "来源章节", "扩展材料"]
    ),
    professorTemplate(
      "synthesis_review",
      "quiz",
      "补充一页综合回看，把定义、关键链路、例子和边界连成完整结构。",
      "顺着综合图回看本单元的节点和链路。",
      "综合结构图和回看路径。",
      "解释各节点之间的依赖和常见遗漏。",
      ["综合回看", "知识节点", "关键链路", "回看路径"]
    )
  ];
  if (targetPageCount <= 6) {
    return [templates[0]!, templates[4]!, templates[6]!, templates[7]!, templates[8]!, templates[9]!].slice(0, Math.max(1, targetPageCount));
  }
  if (targetPageCount === 7) {
    return [templates[0]!, templates[1]!, templates[2]!, templates[4]!, templates[5]!, templates[6]!, templates[9]!];
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
    mustInclude: () => [...mustInclude, ...professorKnowledgeBoardMustInclude]
  };
}

const professorKnowledgeBoardMustInclude = ["knowledgeBoard", "coreProposition", "leftColumn", "rightColumn", "sourceTrace", "bottomLine"];

function selfStudyTemplate(
  pageType: string,
  teachingMove: string,
  learnerAction: string,
  visualRequirement: string,
  feedbackRequirement: string,
  mustInclude: string[]
): PageTemplate {
  return {
    pageType,
    teachingMove,
    learnerAction,
    visualRequirement,
    feedbackRequirement,
    mustInclude: () => [...mustInclude, ...selfStudyKnowledgeBoardMustInclude]
  };
}

const selfStudyKnowledgeBoardMustInclude = ["knowledgeBoard", "learner-facing headline", "concrete explanation", "sourceTrace", "bottomLine"];

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
