import type { LearnerBrief } from "./learner-project-service.js";

export function buildBundleAuthoringGuidance(brief: LearnerBrief): string {
  const sourceGroundingRule = brief.sourcePath
    ? "因为这是 source-backed 项目，每个 lesson 必须包含 sourceContext.sourceAnchorIds；如果只在页面级标注，也必须在相关 page.sourceAnchorIds 中给出来源锚点。推理页或类比页必须显式设置 grounding.kind 为 inferred 或 analogy。"
    : "如果是纯 topic 项目，也要避免编造来源；把没有来源的推理明确写成教学推理。";

  return [
    "请基于 learner brief 和用户资料生成 coursePack 与 lessons，然后调用 learning_agent.publish_learning_course。",
    `目标学习者：${brief.audience ?? "中文学习者"}`,
    `课程组织：${brief.strategy}，每个单元 ${brief.unitPages} 页，输出语言 ${brief.language}。`,
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
  ].join("\n");
}
