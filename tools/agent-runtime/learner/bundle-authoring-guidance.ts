import type { LearnerBrief } from "./learner-project-service.js";
import { difficultyLabel } from "./learner-project-service.js";

export function buildBundleAuthoringGuidance(brief: LearnerBrief): string {
  const sourceGroundingRule = brief.sourcePath
    ? "因为这是 source-backed 项目，每个 lesson 必须包含 sourceContext.sourceAnchorIds；如果只在页面级标注，也必须在相关 page.sourceAnchorIds 中给出来源锚点。推理页或类比页必须显式设置 grounding.kind 为 inferred 或 analogy。"
    : "如果是纯 topic 项目，也要避免编造来源；把没有来源的推理明确写成教学推理。";

  return [
    "请基于 learner brief 和用户资料生成 coursePack 与 lessons，然后调用 learning_agent.publish_learning_course。",
    `目标学习者：${brief.audience ?? "中文学习者"}`,
    brief.difficultyLevel ? `教学难度层级：${difficultyLabel(brief.difficultyLevel)}（${brief.difficultyLevel}）。` : undefined,
    `课程组织：${brief.strategy}，每个单元 ${brief.unitPages} 页，输出语言 ${brief.language}。`,
    strategyInstruction(brief.strategy),
    brief.selectedChapters?.length ? `指定章节：${brief.selectedChapters.join("、")}。` : undefined,
    brief.selectedTopics?.length ? `指定 topics：${brief.selectedTopics.join("、")}。` : undefined,
    "生成要求：",
    "1. 所有 learner-facing 文案必须中文优先；技术术语可以保留英文，但解释必须中文。",
    "2. 每个 lesson 必须包含 learningObjectives、prerequisites、pages、misconceptions、transferTasks、summary。",
    "3. 每个 lesson 至少包含 3 个 visualSpec、2 个 meaningful interactionSpec、2 个 assessmentSpec，并且 assessment 页面必须有 feedbackSpec。",
    "4. interactionSpec 必须说明 learnerAction、expectedObservation、cognitivePurpose；选项必须提供 explanation。",
    "5. feedbackSpec 不能只说对/错，必须解释学习者可能误解了什么，以及正确心智模型如何更新。",
    "6. transferTasks 必须把同一机制迁移到新但相关的场景，不能只是复述。",
    `7. ${sourceGroundingRule}`,
    "8. coursePack.units 必须引用已生成 lessonId，并保留 sourceAnchorIds、conceptIds、targetPageCount。",
    "9. 发布前自查：如果缺中文、缺互动、缺反馈、缺迁移、缺来源锚点，不要调用 publish，先修订 bundle。"
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
