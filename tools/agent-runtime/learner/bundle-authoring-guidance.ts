import { courseIntentLabel } from "./course-intent.js";
import type { LearnerBrief } from "./learner-project-service.js";
import { difficultyLabel } from "./learner-project-service.js";

export function buildBundleAuthoringGuidance(brief: LearnerBrief): string {
  const sourceGroundingRule = brief.sourcePath
    ? "因为这是 source-backed 项目，每个 lesson 必须包含 sourceContext.sourceAnchorIds；如果只在页面级标注，也必须在相关 page.sourceAnchorIds 中给出来源锚点。推理页或类比页必须显式设置 grounding.kind 为 inferred 或 analogy。"
    : "如果是纯 topic 项目，也要避免编造来源；把没有来源的推理明确写成教学推理。";

  return [
    "请基于 learner brief 和用户资料生成 coursePack 与 lessons，然后调用 learning_agent.publish_learning_course。",
    `目标学习者：${brief.audience ?? "中文学习者"}`,
    `课程形态：${courseIntentLabel(brief.courseIntent)}（${brief.courseIntent}）。`,
    brief.difficultyLevel ? `教学难度层级：${difficultyLabel(brief.difficultyLevel)}（${brief.difficultyLevel}）。` : undefined,
    `课程组织：${brief.strategy}，每个单元 ${brief.unitPages} 页，输出语言 ${brief.language}。`,
    strategyInstruction(brief.strategy),
    brief.selectedChapters?.length ? `指定章节：${brief.selectedChapters.join("、")}。` : undefined,
    brief.selectedTopics?.length ? `指定 topics：${brief.selectedTopics.join("、")}。` : undefined,
    "生成要求：",
    "1. 所有 learner-facing 文案必须中文优先；技术术语可以保留英文，但解释必须中文。",
    "2. 每个 lesson 必须包含 learningObjectives、prerequisites、pages、misconceptions、transferTasks、summary。",
    ...intentAuthoringRules(brief),
    `来源约束：${sourceGroundingRule}`,
    "coursePack 约束：coursePack.units 必须引用已生成 lessonId，并保留 sourceAnchorIds、conceptIds、targetPageCount。",
    publishSelfCheck(brief)
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}

function intentAuthoringRules(brief: LearnerBrief): string[] {
  if (brief.courseIntent === "professor_lecture_deck") {
    return [
      "3. 教授式 Web Deck 采用教材式知识链路 knowledgeBoard：headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine。",
      "4. 内容逻辑必须是 source proposition -> decomposition -> evidence -> reconstruction；不要只写一个 narrative 段落。",
      "5. leftColumn 放知识链、机制链、定义或推导；rightColumn 放例子、反例、来源证据或边界；sourceTrace 保留来源支持关系。",
      "6. 至少包含本讲定位、先修要求、知识节点、关键链路、核心定义、经典例题/推导/案例、方法比较、边界案例和总结图。",
      "7. 页面正文不要显性出现教学设计包装词；这些可以作为内部结构，但不应成为学生看到的模块。",
      "8. 不要写 PPTX、Slides 或导出文件话术，产物仍是 Web Deck。"
    ];
  }
  if (brief.courseIntent === "student_self_study_textbook") {
    return [
      "3. 学生自学 Web 教材要求每页直接讲内容：标题是学习者问题或知识命题，正文是可自读的解释，不是给老师的授课提示。",
      "4. 标题必须是内容命题或学习者真正会问的问题；不要用页面角色当标题，例如“直观模型”“机制链路”“来源证据”。",
      "5. 不要写“本页围绕...讲一个可自学知识片段”“本页从...入手”等 authoring scaffold 句；这些是内部写作过程，不是学生要学的内容。",
      "6. Codex/Claude 自主设计每页的知识角色和顺序；不要按固定模板填充“学习问题/直观模型/结构板书”等页面。",
      "7. 每页必须优先填写 knowledgeBoard：headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine；title/narrative 只做兼容摘要。",
      "8. leftColumn 放概念、机制、因果链、定义或推导；rightColumn 放例子、反例、来源证据或适用边界；sourceTrace 必须标出来源支持关系。",
      "9. 同一 lesson 内每页必须推进不同知识节点或关键链路，禁止复制同一套 headline、coreProposition、左右栏或 bottomLine。",
      "10. 不要写本讲定位、课堂讨论、教授讲义、课后作业、教学目标、教学设计、识别本页中的作用等教师视角话术。",
      "11. 页面必须一屏可读；如果一个知识片段放不下，就拆成下一页，不要用长段落或纵向滚动硬塞。",
      pageBudgetInstruction(brief)
    ];
  }
  return [
    "3. 每个 lesson 至少包含 3 个 visualSpec、2 个 meaningful interactionSpec、2 个 assessmentSpec，并且 assessment 页面必须有 feedbackSpec。",
    "4. interactionSpec 必须说明 learnerAction、expectedObservation、cognitivePurpose；选项必须提供 explanation。",
    "5. feedbackSpec 不能只说对/错，必须解释学习者可能误解了什么，以及正确心智模型如何更新。",
    "6. transferTasks 必须把同一机制迁移到新但相关的场景，不能只是复述。"
  ];
}

function pageBudgetInstruction(brief: LearnerBrief): string {
  if (brief.targetTotalPages) {
    return brief.totalPagesSpecified
      ? `12. 当前用户指定总页数约 ${brief.targetTotalPages} 页，按该预算拆分；不要擅自恢复为默认页数。`
      : `12. 100 页只是长书默认建议；当前总页预算约 ${brief.targetTotalPages} 页，如内容不足或过密，按一屏可读原则微调。`;
  }
  return "12. 100 页只是长书默认建议；未给总页数时按每单元页数规划，内容太多就拆单元。";
}

function publishSelfCheck(brief: LearnerBrief): string {
  if (brief.courseIntent === "professor_lecture_deck") {
    return "发布前自查：如果缺中文、缺少可见结构、缺少知识节点、关键链路、例子、边界或来源锚点，不要调用 publish，先修订 bundle。";
  }
  if (brief.courseIntent === "student_self_study_textbook") {
    return "发布前自查：如果缺中文、缺少自学教材结构、缺直接解释、缺例子/边界、缺 knowledgeBoard 或缺来源锚点，不要调用 publish，先修订 bundle。";
  }
  return "发布前自查：如果缺中文、缺互动、缺反馈、缺迁移、缺来源锚点，不要调用 publish，先修订 bundle。";
}

function strategyInstruction(strategy: string): string {
  if (strategy === "chapter_guided") {
    return "拆课要求：按原书章节或小节推进，coursePack.units.kind 优先使用 chapter；每个 unit 保留 chapterRefs 和 sourceAnchorIds。";
  }
  if (strategy === "topic_guided") {
    return "拆课要求：按概念簇重构学习路径，同时保留每个 topic 对应的章节或来源映射。";
  }
  if (strategy === "task_guided") {
    return "拆课要求：按学习者要完成的任务或实践动作组织单元，每个任务仍需标注来源依据。";
  }
  if (strategy === "hybrid") {
    return "拆课要求：先给总览课，再按教学 topic 组织学习路径，同时保留原书章节映射。";
  }
  return "拆课要求：先给总览课，再按核心 topic 拆课，并保留章节或来源映射。";
}
