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
    ...(brief.courseIntent === "professor_lecture_deck"
      ? [
          "3. 教授式 Web Deck 采用教材式知识链路 knowledgeBoard：headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine。",
          "4. 内容逻辑必须是 source proposition -> decomposition -> evidence -> reconstruction；不要只写一个 narrative 段落。",
          "5. leftColumn 放知识链、机制链、定义或推导；rightColumn 放例子、反例、来源证据或边界；sourceTrace 保留来源支持关系。",
          "6. 至少包含本讲定位、先修要求、知识节点、关键链路、核心定义、经典例题/推导/案例、方法比较、边界案例和总结图。",
          "7. 页面正文不要显性出现教学设计包装词；这些可以作为内部结构，但不应成为学生看到的模块。",
          "8. 不要写 PPTX、Slides 或导出文件话术，产物仍是 Web Deck。"
        ]
      : [
          "3. 每个 lesson 至少包含 3 个 visualSpec、2 个 meaningful interactionSpec、2 个 assessmentSpec，并且 assessment 页面必须有 feedbackSpec。",
          "4. interactionSpec 必须说明 learnerAction、expectedObservation、cognitivePurpose；选项必须提供 explanation。",
          "5. feedbackSpec 不能只说对/错，必须解释学习者可能误解了什么，以及正确心智模型如何更新。",
          "6. transferTasks 必须把同一机制迁移到新但相关的场景，不能只是复述。"
        ]),
    `来源约束：${sourceGroundingRule}`,
    "coursePack 约束：coursePack.units 必须引用已生成 lessonId，并保留 sourceAnchorIds、conceptIds、targetPageCount。",
    brief.courseIntent === "professor_lecture_deck"
      ? "发布前自查：如果缺中文、缺少可见结构、缺少知识节点、关键链路、例子、边界或来源锚点，不要调用 publish，先修订 bundle。"
      : "发布前自查：如果缺中文、缺互动、缺反馈、缺迁移、缺来源锚点，不要调用 publish，先修订 bundle。"
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
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
