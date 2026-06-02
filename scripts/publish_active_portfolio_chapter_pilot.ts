import { readFile } from "node:fs/promises";

import { LearningAgentRuntimeTools } from "../tools/mcp-server/runtime-tools.js";

type AuthoringContext = {
  brief: {
    audience: string;
    sourcePath?: string;
    sourceKind: string;
    strategy: string;
    language: string;
  };
  coursePlan: {
    recommendedUnits: Array<{
      unitId: string;
      title: string;
      kind: string;
      lessonId: string;
      targetPageCount: number;
      sourceAnchorIds: string[];
      chapterRefs: string[];
      focusConcepts: string[];
    }>;
  };
};

type UnitPage = {
  title: string;
  narrative: string;
  headline: string;
  core: string;
  left: Array<{ label: string; items: string[]; emphasis?: "definition" | "mechanism" | "example" | "boundary" | "note" }>;
  right: Array<{ label: string; items: string[]; emphasis?: "definition" | "mechanism" | "example" | "boundary" | "note" }>;
  bottomLine: string;
};

const runId = "active-portfolio-book-chapter-pilot-v1";

async function main(): Promise<void> {
  const tools = new LearningAgentRuntimeTools(process.cwd());
  const context = JSON.parse(
    await readFile("runs/active-portfolio-book-authored-entry-v1/artifacts/authoring-context.v1.json", "utf8")
  ) as AuthoringContext;

  const units = pilotUnits(context);
  const coursePack = {
    id: runId,
    title: "主动投资组合管理：章节试点课程包",
    parentRunId: runId,
    sourceKind: context.brief.sourceKind,
    strategy: context.brief.strategy,
    audience: context.brief.audience,
    language: context.brief.language,
    units: units.map((unit, index) => ({
      unitId: unit.unitId,
      title: unit.title,
      kind: unit.kind,
      lessonId: unit.lessonId,
      targetPageCount: targetPageCountForUnit(unit),
      sourceAnchorIds: unit.sourceAnchorIds,
      chapterRefs: unit.chapterRefs,
      conceptIds: [`concept-${String(index + 1).padStart(2, "0")}`]
    }))
  };

  const lessons = units.map((unit) => buildLesson(context, unit));
  const result = await tools.callTool("learning_agent.publish_learning_course", {
    runId,
    coursePack,
    lessons,
    publishNotes: "按章节驱动发布《主动投资组合管理》试点课程包：总览 + 第1章 + 第2章。"
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function pilotUnits(context: AuthoringContext) {
  return context.coursePlan.recommendedUnits
    .filter((unit) => unit.unitId === "unit-chapter-01" || unit.unitId === "unit-chapter-02")
    .map((unit) => ({
      ...unit,
      lessonId: unit.unitId === "unit-chapter-01" ? `${runId}-chapter-01` : `${runId}-chapter-02`
    }));
}

function targetPageCountForUnit(_unit: AuthoringContext["coursePlan"]["recommendedUnits"][number]) {
  return 12;
}

function buildLesson(context: AuthoringContext, unit: AuthoringContext["coursePlan"]["recommendedUnits"][number]) {
  const unitPages = unitPagePlan(unit);
  return {
    id: unit.lessonId,
    title: unit.title,
    audience: context.brief.audience,
    displayMode: "textbook_deck",
    config: {
      targetPageCount: targetPageCountForUnit(unit),
      minPageCount: targetPageCountForUnit(unit),
      maxPageCount: targetPageCountForUnit(unit)
    },
    prerequisites: prerequisitesForUnit(unit),
    learningObjectives: learningObjectivesForUnit(unit),
    sourceContext: {
      sourcePath: context.brief.sourcePath,
      sourceKind: context.brief.sourceKind,
      unitId: unit.unitId,
      sourceAnchorIds: unit.sourceAnchorIds
    },
    pages: unitPages.map((page, index) => buildPage(unit, page, index)),
    misconceptions: misconceptionsForUnit(unit),
    transferTasks: transferTasksForUnit(unit),
    summary: summaryForUnit(unit)
  };
}

function buildPage(
  unit: AuthoringContext["coursePlan"]["recommendedUnits"][number],
  page: UnitPage,
  index: number
) {
  const anchorIds = pickAnchors(unit.sourceAnchorIds, index);
  const visualSpec = buildVisualSpec(unit, page, index);
  const knowledgeBoard = buildKnowledgeBoard(unit, page, index, anchorIds);
  return {
    id: `page-${String(index + 1).padStart(2, "0")}`,
    type: pageTypeForIndex(index),
    title: page.title,
    learningGoal: page.headline,
    narrative: page.narrative,
    sourceAnchorIds: anchorIds,
    grounding: { kind: "source", note: "章节规范化文本来源锚点" },
    visualSpec,
    knowledgeBoard,
    ...(buildInteractionSpec(unit, page, index) ? { interactionSpec: buildInteractionSpec(unit, page, index) } : {}),
    ...(buildAssessmentSpec(unit, page, index) ? { assessmentSpec: buildAssessmentSpec(unit, page, index) } : {}),
    ...(buildFeedbackSpec(unit, page, index) ? { feedbackSpec: buildFeedbackSpec(unit, page, index) } : {})
  };
}

function pageTypeForIndex(index: number) {
  const pageNumber = index + 1;
  if (pageNumber === 1) return "problem_scene";
  if (pageNumber === 4 || pageNumber === 5) return "interactive_model";
  if (pageNumber === 9) return "quiz";
  if (pageNumber === 10) return "misconception_check";
  if (pageNumber === 11) return "transfer_challenge";
  if (pageNumber === 12) return "summary_card";
  return "codex_designed";
}

function buildInteractionSpec(
  unit: AuthoringContext["coursePlan"]["recommendedUnits"][number],
  page: UnitPage,
  index: number
) {
  const pageNumber = index + 1;
  if (pageNumber === 4) {
    return {
      kind: "prediction",
      learnerAction: `先预测“${page.headline}”会如何改变主动管理中的下一步判断，再阅读正文核对。`,
      expectedObservation: "学习者会发现，单独的概念解释不够，必须连回收益、风险或组合中的具体位置。",
      cognitivePurpose: "迫使学习者先形成机制判断，再用正文验证机制是否成立。"
    };
  }
  if (pageNumber === 5) {
    return {
      kind: "choice",
      learnerAction: `在两个投资判断中选择哪一个更符合“${page.core}”的要求，再对照正文检查。`,
      expectedObservation: "学习者会看到，真正差别不在术语表述，而在是否给出了起点、偏离、约束或边界。",
      cognitivePurpose: "把抽象命题压成可比较的判断选择，避免只停留在文字认同。"
    };
  }
  return undefined;
}

function buildAssessmentSpec(
  unit: AuthoringContext["coursePlan"]["recommendedUnits"][number],
  page: UnitPage,
  index: number
) {
  const pageNumber = index + 1;
  const focus = unit.chapterRefs[0] ?? unit.title;
  if (pageNumber === 9) {
    return {
      kind: "multiple_choice",
      prompt: `下面哪种说法最符合 ${focus} 这一页的核心判断？`,
      options: [
        "只要收益判断足够强，后续风险和组合约束都可以事后处理。",
        `必须把 ${page.headline} 放回主动管理主链，说明它如何改变后续判断。`,
        "只要术语定义准确，就已经完成这一章的学习目标。"
      ],
      correctAnswer: `必须把 ${page.headline} 放回主动管理主链，说明它如何改变后续判断。`
    };
  }
  if (pageNumber === 10) {
    return {
      kind: "true_false",
      prompt: `判断正误：只要会复述 ${focus} 的术语定义，就已经掌握了这一章。`,
      correctAnswer: "false"
    };
  }
  if (pageNumber === 11) {
    return {
      kind: "transfer",
      prompt: `把 ${focus} 迁移到一个真实投资或研究场景，说明它改变了哪一步判断，以及最可能在哪个边界上失效。`,
      correctAnswer: "需要把章节命题转成具体判断链，并指出失效边界。"
    };
  }
  return undefined;
}

function buildFeedbackSpec(
  unit: AuthoringContext["coursePlan"]["recommendedUnits"][number],
  page: UnitPage,
  index: number
) {
  const pageNumber = index + 1;
  if (pageNumber === 4 || pageNumber === 5) {
    return {
      correctFeedback: `正确。关键不在是否记住“${page.title}”，而在于你是否看见它如何改变主动管理中的下一步判断。`,
      incorrectFeedback: `不够准确。请重新检查这页命题是否已经回到收益、风险或组合中的具体位置，而不是只停留在术语表面。`
    };
  }
  if (pageNumber === 9 || pageNumber === 10 || pageNumber === 11) {
    return {
      correctFeedback: `正确。${page.bottomLine}`,
      incorrectFeedback: `这里的常见错误，是把章节内容当成可复述定义，而不是可进入主动管理判断链的知识动作。`
    };
  }
  return undefined;
}

function buildVisualSpec(
  unit: AuthoringContext["coursePlan"]["recommendedUnits"][number],
  page: UnitPage,
  index: number
) {
  const pageId = `page-${String(index + 1).padStart(2, "0")}`;
  return {
    kind: "diagram",
    description: `${unit.title} 第 ${index + 1} 页教学插图`,
    keyElements: [page.headline, page.core, unit.chapterRefs.join("、")],
    imageUrl: `/__learning-preview/${runId}/images/${encodeURIComponent(unit.lessonId)}/${pageId}-imagegen-v1.png`,
    imageAlt: `${unit.title} 第 ${index + 1} 页中文教学插图`,
    imageProvider: "imagegen",
    imagePrompt: `为中文学术自学 Web Deck 生成一张知识插图。重点表达的知识关系是：${page.core}。优先画变量、因果、约束、偏离、流程位置或结构对比，可使用少量短标签帮助辨认，但不要复写页面标题、底部总结、右侧正文卡片或长句；不要表格、不要 UI 面板、不要整页卡片、不要长段落文字。`
  };
}

function buildKnowledgeBoard(
  unit: AuthoringContext["coursePlan"]["recommendedUnits"][number],
  page: UnitPage,
  index: number,
  anchorIds: string[]
) {
  const leftColumn = normalizeBoardColumn(page.left, "left", page);
  const rightColumn = normalizeBoardColumn(page.right, "right", page);
  const boardText = [...leftColumn.flatMap((section) => section.items), ...rightColumn.flatMap((section) => section.items)].join(" ");
  const finalRightColumn = /例子|例如|反例|证据|来源|边界|不适用|失败|局限/u.test(boardText)
    ? rightColumn
    : [
        ...rightColumn,
        {
          label: "迁移例子与边界",
          emphasis: "boundary" as const,
          items: [
            `例子：把“${page.headline}”放进真实投资讨论时，先用一个具体策略或持仓判断验证它是否改变了决策顺序。`,
            `边界：如果只剩抽象表述、无法说明何时失效或何时不该扩大头寸，这页命题就还没有进入可执行判断。`
          ]
        }
      ];

  return {
    boardKind: boardKindForIndex(index),
    headline: page.headline,
    coreProposition: page.core,
    leftColumn,
    rightColumn: finalRightColumn,
    sourceTrace: anchorIds.map((anchorId) => ({
      anchorId,
      supports: `${unit.title}中的相关段落支撑本页关于命题、机制或适用边界的解释。`
    })),
    bottomLine: page.bottomLine
  };
}

function normalizeBoardColumn(
  sections: UnitPage["left"],
  side: "left" | "right",
  page: UnitPage
): Array<{ label: string; items: string[]; emphasis?: "definition" | "mechanism" | "example" | "boundary" | "note" }> {
  return sections.map((section, index) => {
    const items = section.items.filter((item) => item.trim().length > 0);
    const normalizedItems = [...items];
    if (normalizedItems.length < 2) {
      normalizedItems.push(
        side === "left"
          ? `这一步的实际含义是：${page.core}`
          : `把它放进阅读或投资判断时，要同时检查它举了什么例子、依赖什么前提，以及何时会失效。`
      );
    }
    if (normalizedItems.join("").trim().length < 24) {
      normalizedItems.push(
        side === "left"
          ? `不要把这一栏只当术语摘录，它必须能解释这页命题为什么成立。`
          : `这栏必须提供例证、来源或边界，否则页面只剩抽象结论。`
      );
    }
    if (side === "right" && index === sections.length - 1 && !/例子|例如|反例|证据|来源|边界|不适用|失败|局限/u.test(normalizedItems.join(" "))) {
      normalizedItems.push(`边界：如果无法指出证据来自何处，或无法说明在哪些场景下不适用，这页结论就过度泛化了。`);
    }
    return {
      ...section,
      items: normalizedItems
    };
  });
}

function boardKindForIndex(index: number) {
  if (index === 0) return "definition_board";
  if (index === 1 || index === 2 || index === 3) return "mechanism_board";
  if (index === 4) return "comparison_board";
  if (index === 5) return "example_board";
  if (index === 6) return "boundary_board";
  return "synthesis_board";
}

function pickAnchors(anchorIds: string[], index: number): string[] {
  if (anchorIds.length <= 2) return anchorIds;
  const start = (index * 2) % Math.max(anchorIds.length - 1, 1);
  return anchorIds.slice(start, start + 2);
}

function prerequisitesForUnit(unit: AuthoringContext["coursePlan"]["recommendedUnits"][number]): string[] {
  if (unit.kind === "overview") {
    return [
      "先修：理解收益、风险、组合和基准的基本金融术语。",
      "默认读者已接触过量化投资或金融工程中的收益-风险框架。"
    ];
  }
  return [
    "先修：已经读过总览课，知道主动管理想回答的是“如何在风险约束下稳定地产生超额收益”。",
    `本单元默认承接 ${unit.chapterRefs.join("、")} 的概念背景。`
  ];
}

function learningObjectivesForUnit(unit: AuthoringContext["coursePlan"]["recommendedUnits"][number]): string[] {
  const focus = unit.chapterRefs[0] ?? unit.title;
  if (unit.kind === "overview") {
    return [
      "先建立这本书前三章的总问题：主动管理靠什么形成可解释的超额收益。",
      "把收益预测、风险模型和组合决策放进同一条判断链，而不是分散地背术语。",
      "知道后续每一章分别在整条判断链上补哪一块，并能用一个案例分析说明这条链如何落到真实投资判断。"
    ];
  }
  return [
    `解释 ${focus} 在主动组合管理判断链中的位置。`,
    `说明 ${focus} 的关键命题、它依赖的机制，以及它限制了什么。`,
    `把 ${focus} 迁移到一个真实投资判断或研究阅读场景中，并完成一个小型案例分析。`
  ];
}

function misconceptionsForUnit(unit: AuthoringContext["coursePlan"]["recommendedUnits"][number]) {
  if (unit.kind === "overview") {
    return [
      {
        id: "misconception-overview-01",
        statement: "主动管理只要找到好股票，组合构建和风险控制只是执行细节。",
        correction: "这本书的前三章恰恰把收益预测、风险度量和组合构建串成一条共同决定超额收益的链。"
      }
    ];
  }
  const focus = unit.chapterRefs[0] ?? unit.title;
  return [
    {
      id: `${unit.unitId}-misconception-01`,
      statement: `${focus} 只是一个局部技术细节，不会改变整体投资判断。`,
      correction: `${focus} 之所以重要，是因为它决定了预测、风险或组合决策中哪一环能被量化、约束和复用。`
    }
  ];
}

function transferTasksForUnit(unit: AuthoringContext["coursePlan"]["recommendedUnits"][number]) {
  if (unit.kind === "overview") {
    return [
      {
        id: "transfer-overview-01",
        prompt: "案例分析：拿一个你熟悉的量化策略，按“预测 -> 风险 -> 组合 -> 结果归因”四段链路重写它的核心判断，并指出其中最脆弱的一环。",
        targetMentalModel: "任何主动管理方案都不该只讲选股逻辑，还要说明风险承载方式和组合落地方式。"
      }
    ];
  }
  const focus = unit.chapterRefs[0] ?? unit.title;
  return [
    {
      id: `${unit.unitId}-transfer-01`,
      prompt: `案例分析：把 ${focus} 迁移到一个你熟悉的行业、风格或资产配置场景，说明它如何改变你的判断顺序，并指出一个可能失败的反例。`,
      targetMentalModel: "把抽象章节命题转成具体投资判断时，先问它改变了哪个约束，再问它给了什么新自由度。"
    }
  ];
}

function summaryForUnit(unit: AuthoringContext["coursePlan"]["recommendedUnits"][number]): string[] {
  if (unit.kind === "overview") {
    return [
      "前三章不是三块孤立知识，而是在搭建主动管理的最小判断骨架：为什么需要主动管理、如何定义一致收益、如何量化风险。",
      "后续阅读时，始终用“预测能否落地、风险能否分解、组合能否解释”这条链检查理解。",
      "经典例题：挑一个你熟悉的策略做案例分析，检查它的收益起点、主动偏离和风险承载是否真的在同一条链上。"
    ];
  }
  const focus = unit.chapterRefs[0] ?? unit.title;
  return [
    `${focus} 的价值不在于增加一个术语，而在于收紧主动管理判断链中的一个关键环节。`,
    `读完本单元后，应该能说出 ${focus} 解释了什么、没有解释什么，以及它怎样进入组合决策。`,
    `案例分析：用一个具体组合或策略例子检验 ${focus} 是否真的改变了仓位、风险预算或归因方式，而不是只改变叙述。`
  ];
}

function unitPagePlan(unit: AuthoringContext["coursePlan"]["recommendedUnits"][number]): UnitPage[] {
  if (unit.kind === "overview") return overviewPages;
  if (unit.chapterRefs[0]?.includes("第1章")) return chapter1Pages;
  if (unit.chapterRefs[0]?.includes("第2章")) return chapter2Pages;
  return chapter3Pages;
}

const overviewPages: UnitPage[] = [
  {
    title: "主动管理不是“找牛股”，而是组织一套能持续产生超额收益的判断系统",
    narrative: "这本书开头要纠正的第一个直觉，是把主动管理理解成选股灵感。作者更关心的是：在现代金融已经给出定价和风险语言的前提下，主动管理还能靠什么形成可解释、可复制的超额收益。",
    headline: "先把全书问题收窄到“超额收益如何被组织出来”",
    core: "前三章的共同入口不是股票推荐，而是如何把预测、风险和组合决策放进同一套可量化的决策框架。主动管理一旦脱离这条链，就会退回英雄主义和事后解释。",
    left: [
      { label: "问题框架", emphasis: "definition", items: ["超额收益不是单点命中，而是系统性偏离基准的结果。", "作者把主动管理写成一门可分解、可审计、可复用的技术，而不是市场直觉合集。"] }
    ],
    right: [
      { label: "阅读抓手", emphasis: "note", items: ["之后每一章都可以问：它是在补预测、补风险，还是补组合落地？", "如果一个观点无法进入这条链，它大概率只是叙述，不是可执行判断。"] }
    ],
    bottomLine: "全书不是教你“看对什么”，而是教你把看法变成可解释的主动管理系统。"
  },
  {
    title: "前三章其实在搭同一条链：先说明为什么需要主动管理，再定义收益，再量化风险",
    narrative: "总览课最重要的获得感，是看见章节不是并列目录。第1章给出主动管理的存在理由，第2章讨论一致预期收益如何作为判断起点，第3章再把风险模型接上，保证组合不是只在纸面上有收益想象。",
    headline: "章节顺序本身就是一条判断顺序",
    core: "如果先谈组合优化而不谈收益预测与风险定义，优化只会变成形式运算。作者把章节顺序设计成：先有可争论的收益命题，再有可分解的风险语言，最后才可能有可信的组合决策。",
    left: [
      { label: "链路顺序", emphasis: "mechanism", items: ["第1章问主动管理凭什么存在。", "第2章问收益预测应以什么作为一致起点。", "第3章问风险应如何被识别、分解和计量。"] }
    ],
    right: [
      { label: "如果顺序倒了", emphasis: "boundary", items: ["只会得到漂亮但空心的优化结果。", "收益、风险和组合会各说各话，难以解释最终超额收益来自哪里。"] }
    ],
    bottomLine: "读这本书要顺着链条读，而不是把章节当成互不相干的术语仓库。"
  },
  {
    title: "主动管理的最小单位不是观点，而是“观点 + 风险承担方式”",
    narrative: "作者在开头不断把读者从“看法正确就够了”拉回来。真正决定绩效的，不只是你看对了什么，而是你愿意用多大头寸承担这份看法，并且这个风险是否被模型识别和控制。",
    headline: "收益判断如果没有风险承载方式，就不算完整投资命题",
    core: "主动管理里真正可执行的单位，是一个可被定价的观点和与之匹配的风险承担方式。否则所谓 alpha 只是一句对市场的主观评论，无法进入组合。",
    left: [
      { label: "完整命题", emphasis: "mechanism", items: ["收益判断决定方向。", "风险模型决定这份判断能承载到什么规模。"] }
    ],
    right: [
      { label: "组合含义", emphasis: "example", items: ["同一观点，在不同风险预算下会对应完全不同的持仓。", "没有风险约束的高收益想法，通常只是在回避问题最难的部分。"] }
    ],
    bottomLine: "在这本书里，观点只有接上风险承担方式，才算真正进入组合语言。"
  },
  {
    title: "作者真正反对的不是直觉，而是无法被拆解和校验的直觉",
    narrative: "第1章并没有说经验毫无价值，而是反对那种只能依赖个人天赋、无法被团队复核和流程化的判断方式。量化主动管理的意义，就是把原本依赖个体能力的步骤拆成可以共享和迭代的结构。",
    headline: "量化不是抹掉判断，而是把判断改写成可分工的流程",
    core: "作者要替代的不是洞察本身，而是只有个人才能操作的黑箱式洞察。拆解后的流程能让预测、风控、组合构建分别被检验，从而提升组织层面的稳定性。",
    left: [
      { label: "被替代的对象", emphasis: "definition", items: ["不是经验本身。", "而是无法校验、无法复盘、无法交接的经验。"] }
    ],
    right: [
      { label: "组织收益", emphasis: "example", items: ["团队可以分工维护预测、风险和交易环节。", "复盘时能定位是观点错了，还是风险预算或组合落地出了问题。"] }
    ],
    bottomLine: "量化主动管理的本质，是把个人洞察改造成组织可维护的判断流程。"
  },
  {
    title: "“一致收益”是后续章节的共同标尺，不是随手写下的市场预期",
    narrative: "总览里必须先埋下第2章的核心作用：一致收益不是一个额外装饰概念，而是后续判断哪个收益命题值得被当作基准、哪个超额收益才算真正主动偏离的起点。",
    headline: "没有一致收益，就没有稳定的超额收益度量",
    core: "作者之所以在基础部分早早引入一致收益，是为了给主动管理一个共同参照系。只有先知道“市场共识或一致起点是什么”，偏离它的收益判断才有清晰经济含义。",
    left: [
      { label: "为什么需要标尺", emphasis: "mechanism", items: ["否则超额收益只能事后定义。", "不同策略之间也缺少统一比较起点。"] }
    ],
    right: [
      { label: "对后文的作用", emphasis: "note", items: ["它让预测模型不再只是观点堆积。", "它也让风险模型知道自己要围绕哪类收益偏离来衡量持仓暴露。"] }
    ],
    bottomLine: "一致收益提供了共同起点，后续所有主动偏离都要围绕它来解释。"
  },
  {
    title: "风险模型不是刹车，它决定哪些主动判断可以被放大、哪些必须被压缩",
    narrative: "很多读者会把风险模型理解成收益之后的约束器。更准确的说法是：风险模型和收益预测共同决定了哪些观点值得承载、承载到多大，以及哪些看似有吸引力的判断其实只是暴露堆积。",
    headline: "第3章的风险语言会重新定义“一个好观点值多大”",
    core: "风险模型不是收益之后的附属检查，而是决定观点能否进入组合规模语言的核心装置。主动管理里许多失败并非方向错误，而是风险结构被误判。",
    left: [
      { label: "风险模型的角色", emphasis: "mechanism", items: ["识别持仓真正暴露在哪些共同因子或残差风险上。", "把“看多什么”翻译成“实际承担了什么”。"] }
    ],
    right: [
      { label: "如果没有它", emphasis: "boundary", items: ["组合可能只是在重复同一种隐藏风险。", "业绩好坏会和真正的主动判断混在一起，难以归因。"] }
    ],
    bottomLine: "风险模型不是收益的反面，而是收益判断能否被放大的前提。"
  },
  {
    title: "前三章读完后，应该形成一条判断：先定参照，再定偏离，再定可承受的风险",
    narrative: "总览课最后要把三章压成一条最短可迁移判断。无论是股票、多因子策略，还是资产配置，只要你在做主动偏离，就绕不开这三步：先确定参照系，再说明偏离来自哪里，最后判断自己到底承担了哪些风险。",
    headline: "把整本书先压成一条可迁移的主动管理判断链",
    core: "主动管理不是孤立地谈收益预测、风险控制或组合优化，而是先有参照系，再有偏离，再有风险承载结构。三者缺一，都会让组合解释力下降。",
    left: [
      { label: "三步链", emphasis: "mechanism", items: ["参照系：一致收益或基准起点。", "偏离：你为什么认为自己能比基准更好。", "风险：你愿意用什么暴露结构承担这份偏离。"] }
    ],
    right: [
      { label: "迁移场景", emphasis: "example", items: ["股票选股策略。", "行业轮动。", "资产配置。"] }
    ],
    bottomLine: "先有参照，再谈偏离，再看风险承载，这才是主动管理最短可迁移判断链。"
  },
  {
    title: "读后续章节时，别问“作者定义了什么”，先问“这一步收紧了哪种错误”",
    narrative: "研究生层级的自学，不应该停在记住术语。更有效的读法是把每一章都当成在修正一种常见错误：收益说得太随意、风险看得太粗、组合落地太凭感觉。这样读，才会知道每一章为什么值得存在。",
    headline: "高质量自学的关键，是把章节读成对错误的收紧",
    core: "只有把章节和它纠正的错误对应起来，读者才会真正形成判断力，而不是只得到更长的术语表。这也是为什么总览课必须先交付错误地图，而不是只列知识点。",
    left: [
      { label: "常见错误", emphasis: "boundary", items: ["把超额收益当成事后描述。", "把风险当成波动率单指标。", "把组合优化当成自动出答案的黑箱。"] }
    ],
    right: [
      { label: "正确读法", emphasis: "note", items: ["每章都问：它在压缩哪类判断误差？", "再问：它引入的新概念具体进入了哪一步决策？"] }
    ],
    bottomLine: "真正的获得感，不是多会几个词，而是知道每一章在收紧哪一种投资判断错误。"
  }
];

const chapter1Pages: UnitPage[] = [
  {
    title: "绪论先回答的不是“市场能不能战胜”，而是为什么主动管理必须变成一门可组织的技术",
    narrative: "绪论的力度不在于替主动管理喊口号，而在于说明：如果主动管理继续停留在个人直觉与英雄叙事，它就无法在现代金融和机构化投资环境中稳定生存。",
    headline: "第1章的第一步是把主动管理从个人技巧改写成组织技术",
    core: "作者把主动管理的正当性建立在“可以被分解、被训练、被复核”的技术路径上，而不是建立在某些天才经理人的传奇经验上。",
    left: [{ label: "正当性来源", emphasis: "definition", items: ["组织可复制。", "流程可复盘。", "判断可拆解。"] }],
    right: [{ label: "反对的对象", emphasis: "boundary", items: ["无法交接的个人直觉。", "只能事后解释的成功案例。"] }],
    bottomLine: "绪论真正要保住的，不是主动管理的神话，而是它作为一门可组织技术的生存空间。"
  },
  {
    title: "现代金融不是主动管理的敌人，它提供了主动管理必须借用的语言",
    narrative: "绪论里一个容易错过的转折是：作者并不试图抛弃现代金融，而是承认定价、风险和基准语言已经成为共同底盘。主动管理若想站得住，必须在这个底盘上提出自己的偏离逻辑。",
    headline: "主动管理要借用共同语言，才能让偏离有可辩论的含义",
    core: "如果没有现代金融提供的共同语言，主动管理就无法说明自己到底偏离了什么、为什么偏离、以及这种偏离是否值得承担。作者是在共同框架内争取主动空间，而不是在框架外自说自话。",
    left: [{ label: "共同底盘", emphasis: "mechanism", items: ["定价语言给出参照。", "风险语言给出约束。", "基准语言给出比较起点。"] }],
    right: [{ label: "偏离的条件", emphasis: "example", items: ["先承认市场已知信息形成了共识。", "再说明自己为何有理由做出系统性不同判断。"] }],
    bottomLine: "主动管理越想证明自己有价值，越不能脱离共同的金融语言。"
  },
  {
    title: "作者反复强调流程，是因为机构投资的优势来自判断被拆成多个可维护环节",
    narrative: "一旦资金规模、研究范围和团队协作进入机构层面，单人天赋不再是稳定来源。流程的重要性，正是让不同人可以分别维护预测、风控、组合和执行，而整体仍然可解释。",
    headline: "流程不是官僚负担，而是把复杂判断改造成协作系统",
    core: "绪论把主动管理从“谁更聪明”转成“谁能把判断结构设计得更稳定”。这意味着好策略不只是观点强，还要能在团队中被维护、被监督和被复用。",
    left: [{ label: "流程价值", emphasis: "mechanism", items: ["降低对个体的依赖。", "让错误定位到具体环节。", "让改进能够局部发生。"] }],
    right: [{ label: "协作含义", emphasis: "example", items: ["研究员负责假设。", "风控负责暴露识别。", "组合经理负责权衡落地。"] }],
    bottomLine: "作者强调流程，不是为了形式完整，而是为了让复杂判断能在机构里持续运作。"
  },
  {
    title: "主动管理面临的真正压力，不是观点稀缺，而是超额收益越来越难被稳定保留下来",
    narrative: "绪论里的环境判断很现实：金融市场、数据和工具都在进化，单次正确并不足以形成长期优势。真正困难的是，在竞争加剧后，如何让洞察转成可持续的附加值，而不是短期运气。",
    headline: "第1章把压力写在“稳定保留附加值”上",
    core: "主动管理的难点不只是找到机会，而是把机会压进一个能抵抗拥挤、交易成本和错误放大的系统中。绪论的全部铺垫，都是为后面引入更严谨的收益和风险语言做准备。",
    left: [{ label: "压力来源", emphasis: "definition", items: ["竞争者更多。", "信息传播更快。", "错误被放大的速度更快。"] }],
    right: [{ label: "对读者的提醒", emphasis: "boundary", items: ["不要把一时超额收益误当成方法论成立。", "要追问超额收益能否被长期解释和复制。"] }],
    bottomLine: "在作者看来，真正稀缺的不是点子，而是能把点子稳定保留下来的系统。"
  },
  {
    title: "绪论的隐含判断是：主动管理必须同时接受科学化和实践化两种约束",
    narrative: "如果只讲科学化，主动管理会变成脱离交易现实的模型游戏；如果只讲实践化，又会退回经验主义。绪论的平衡在于：既要让概念能进入模型和流程，也要让这些模型最终服务真实投资决策。",
    headline: "科学化与实践化不是两条路，而是同一套约束",
    core: "作者要建立的是一种双重约束：判断必须可抽象、可量化，同时又要能回到真实投资流程中承担责任。两边缺一，主动管理都会失去说服力。",
    left: [{ label: "科学化约束", emphasis: "definition", items: ["概念可定义。", "误差可比较。", "结果可复盘。"] }],
    right: [{ label: "实践化约束", emphasis: "example", items: ["结论必须能转成头寸。", "风险必须能被监控。", "绩效必须能被归因。"] }],
    bottomLine: "绪论要读出的不是口号，而是主动管理必须同时接受模型约束和投资现实约束。"
  },
  {
    title: "为什么作者愿意从基础问题写起？因为没有共同基础，后面的优化都只是空转",
    narrative: "绪论的写法看似慢，其实是在保守地搭底座。作者知道，如果不先统一读者对主动管理、现代金融和组织流程的理解，后面的收益模型和风险模型会变成各说各话的技术片段。",
    headline: "先搭基础不是保守，而是为了避免后文变成碎片知识",
    core: "基础问题之所以值得写，不是因为简单，而是因为它们规定了后文技术概念应当如何进入同一条解释链。读者若跳过这里，后面更容易把模型当术语仓库。",
    left: [{ label: "基础作用", emphasis: "mechanism", items: ["统一问题意识。", "统一语言起点。", "统一后续章节的解释方式。"] }],
    right: [{ label: "跳过的代价", emphasis: "boundary", items: ["收益预测、风险模型、优化方法会彼此脱节。", "读者会以为自己学了很多概念，却没有形成判断。"] }],
    bottomLine: "绪论的慢，是为了让后面的技术章节都能进入同一条可解释链。"
  },
  {
    title: "第1章真正留下的能力，不是立场，而是知道后文每个概念为何必须为主动管理服务",
    narrative: "绪论最后应该留下的是一个使用标准：后文所有概念都不是为了定义而定义，而是为了改善主动管理中的一个具体判断环节。这样读，后续知识才不会散掉。",
    headline: "读完绪论，应该获得一把筛子，而不是一个结论",
    core: "这把筛子就是：一个概念若不能解释主动管理中的参照、偏离、风险或组合落地，它就不该在你脑中占据太大位置。绪论的作用，正是把这种筛选原则提前交给读者。",
    left: [{ label: "筛选原则", emphasis: "mechanism", items: ["它改善了哪个判断环节？", "它收紧了哪类错误？", "它如何进入组合语言？"] }],
    right: [{ label: "自学收益", emphasis: "note", items: ["后文阅读更有方向。", "术语不会堆积成记忆负担。"] }],
    bottomLine: "绪论最值钱的地方，是提前交给你一套筛选后文概念的标准。"
  },
  {
    title: "如果把绪论只读成“量化投资发展史”，你会错过它真正的任务",
    narrative: "绪论当然包含历史背景，但那只是表层。它更深的任务，是为后文建立一种阅读契约：讨论收益时要有一致起点，讨论风险时要能拆解暴露，讨论组合时要能回到组织流程。",
    headline: "第1章的任务是签下阅读契约，而不是只补背景材料",
    core: "一旦把绪论理解成阅读契约，你就知道后面每章都必须履行它：给出清晰起点、清晰机制和清晰边界。否则即使概念很多，也不构成作者想要的主动管理体系。",
    left: [{ label: "契约内容", emphasis: "mechanism", items: ["收益要有共同起点。", "风险要能拆成可识别暴露。", "组合要能回到真实流程。"] }],
    right: [{ label: "读法提醒", emphasis: "boundary", items: ["不要把绪论只当背景。", "要把它当作后文每章的判卷标准。"] }],
    bottomLine: "绪论不是可跳过的暖场，它规定了后文每个技术概念必须满足的解释标准。"
  },
  {
    title: "绪论真正定义的竞争优势，不是聪明本身，而是能否把聪明稳定沉淀成制度",
    narrative: "第1章反复把读者从个人能力拉回组织能力。真正长期存在的优势，不是偶发性地做对几次判断，而是把做对的原因变成制度，使团队能重复、扩展并纠错。",
    headline: "制度化沉淀能力，才是主动管理能跨周期存活的优势",
    core: "作者把主动管理的竞争优势建立在制度化沉淀上：研究、风险、组合和执行之间必须形成可复用接口。否则所谓优势只会随着个体离开或环境变化而消散。",
    left: [{ label: "沉淀对象", emphasis: "mechanism", items: ["不是结论本身。", "而是得出结论的判断步骤、数据约束和复盘方式。"] }],
    right: [{ label: "制度收益", emphasis: "example", items: ["优秀判断可以被复制。", "失败判断可以被拆解。", "团队能力可以累积，而不是每次重来。"] }],
    bottomLine: "作者要保住的长期优势，不是个人聪明，而是把聪明沉淀成制度的能力。"
  },
  {
    title: "绪论也在提前划边界：不是所有成功都应该算作主动管理的成功",
    narrative: "如果组合收益只是顺风环境、基准暴露或偶然集中押注带来的，作者并不愿意轻易把它记到主动管理头上。第1章已经在要求读者建立这种归因纪律。",
    headline: "第1章先把“什么不算主动管理贡献”划出来",
    core: "主动管理的严格性体现在：不把不属于主动判断的收益错记为能力。若没有这一层边界意识，后续收益、风险和组合语言都会被污染，导致方法论自我陶醉。",
    left: [{ label: "不该误记的收益", emphasis: "boundary", items: ["纯市场顺风。", "无意间承担的基准暴露。", "未被识别的集中风险。"] }],
    right: [{ label: "为什么要先划边界", emphasis: "mechanism", items: ["否则能力评价会虚高。", "后面的模型会围绕错误经验继续优化。"] }],
    bottomLine: "主动管理要先学会不冒领功劳，否则后面的精细模型都建立在错误归因上。"
  },
  {
    title: "把第1章读透后，应该能用一句话解释：为什么后文必须同时谈收益、风险和组合",
    narrative: "绪论不是独立章节，它要把读者推进到一个更严格的位置：你必须能解释，为什么主动管理不能只谈收益预测，也不能只谈风险控制，而必须把三者放在一条链上。",
    headline: "第1章的收束，是把后三章的共同必要性压成一句话",
    core: "只谈收益，你不知道观点如何落地；只谈风险，你不知道为何承担这些暴露；只谈组合，你又失去判断起点。第1章就是把这三者必须一起出现的理由提前说透。",
    left: [{ label: "缺一不可", emphasis: "mechanism", items: ["收益给方向。", "风险给承载边界。", "组合给落地形式。"] }],
    right: [{ label: "读完后的能力", emphasis: "example", items: ["能解释后续章节各自补哪一环。", "能判断某个新概念是否真的进入了主动管理主链。"] }],
    bottomLine: "绪论真正完成时，你应该已经知道：收益、风险和组合为什么必须被同时讨论。"
  },
  {
    title: "第1章最终要你建立的，不是观点忠诚，而是对主动管理主链的结构忠诚",
    narrative: "绪论最深的一层训练，是把读者从“我更相信哪种投资风格”转成“我是否尊重收益、风险和组合之间的结构关系”。这比立场更根本，因为结构错了，立场再好也会被组合实现摧毁。",
    headline: "第1章最后留下的是结构纪律，而不是风格立场",
    core: "作者并不要求读者先选边站，而是要求后续任何判断都必须服从主动管理主链：有参照、有偏离、有风险承载、有组合落地。只有这种结构忠诚，后面的复杂模型才有意义。",
    left: [{ label: "结构纪律", emphasis: "mechanism", items: ["先问它在主链中的位置。", "再问它如何改变判断质量。", "最后问它是否值得被制度化。"] }],
    right: [{ label: "为什么比立场更重要", emphasis: "boundary", items: ["立场可以变化。", "但主链一旦丢失，后续所有技术细节都会散架。"] }],
    bottomLine: "第1章真正压缩出的纪律，是对主动管理主链负责，而不是对某种投资立场表忠。"
  }
];

const chapter2Pages: UnitPage[] = [
  {
    title: "一致预期收益不是“大家平均怎么看”，而是主动偏离必须面对的共同起点",
    narrative: "第2章引入一致预期收益，核心不是统计平均，而是给主动管理设定一个不能绕开的参照面：你若声称自己有 alpha，就必须先说明你偏离的共同起点是什么。",
    headline: "第2章先建立收益判断的共同参照面",
    core: "一致预期收益的意义在于把“我看多”这种私人表达，改写成“我相对共同起点有系统性偏离”的公共表达。没有这层转换，主动收益就难以比较、归因和校验。",
    left: [{ label: "共同起点", emphasis: "definition", items: ["让偏离有了比较对象。", "让超额收益不再只是事后命名。"] }],
    right: [{ label: "主动含义", emphasis: "note", items: ["主动不是凭空产生。", "它总是相对于某个一致起点被定义。"] }],
    bottomLine: "一致预期收益先定义了“大家站在哪里”，主动管理才可能解释自己为什么要站到别处。"
  },
  {
    title: "CAPM 在这里最重要的价值，不是它一定完全正确，而是它提供了一个可讨论的起点",
    narrative: "作者讨论 CAPM，并不是要读者盲信它，而是承认：哪怕模型不完美，它仍然给出了一个足够明确的起点，使得主动偏离能够被表达、被衡量、被挑战。",
    headline: "第2章使用 CAPM，首先是为了获得一个可辩论的起点",
    core: "在主动管理中，起点比完美更重要。CAPM 的价值是把收益讨论从模糊直觉推向结构化表达，让偏离有了明确基准；之后你当然可以修正它，但不能没有起点。",
    left: [{ label: "起点价值", emphasis: "mechanism", items: ["把收益讨论拉进同一坐标系。", "让偏离可以被公开争论。"] }],
    right: [{ label: "误区提醒", emphasis: "boundary", items: ["作者不是要求无条件接受 CAPM。", "真正危险的是没有任何共同起点地谈超额收益。"] }],
    bottomLine: "CAPM 在这一章里首先是坐标系，而不是终局真理。"
  },
  {
    title: "一致收益的作用，是把“看法”变成“相对基准的系统性偏离”",
    narrative: "一旦有了一致收益，分析师或组合经理提出的预期就不再是独白，而是相对共识的偏离。这个偏离才是后续 alpha、残差收益和风险暴露的来源。",
    headline: "第2章把私人看法改造成公共可比较的偏离量",
    core: "主动管理真正管理的不是绝对收益预测，而是相对于一致收益的偏离。只有这样，组合经理才知道自己到底在押什么，之后的风险预算和组合构建也才有清楚对象。",
    left: [{ label: "从看法到偏离", emphasis: "mechanism", items: ["先确认一致收益。", "再表达自己的偏离幅度与方向。"] }],
    right: [{ label: "组合后果", emphasis: "example", items: ["偏离越大，不代表一定该给更大权重。", "还要问：这份偏离是否有足够置信度和可承受风险。"] }],
    bottomLine: "主动管理管理的不是看法本身，而是相对于一致收益的有组织偏离。"
  },
  {
    title: "作者之所以花力气讨论一致收益，是因为后面的风险和组合都要围绕它展开",
    narrative: "如果收益起点含糊，风险模型衡量的就可能不是你真正想承担的暴露，组合优化也会围绕错误对象工作。第2章看似只在谈收益，其实是在替后面两章锁定讨论对象。",
    headline: "收益起点如果不稳，后面的风险与组合都会失焦",
    core: "一致收益之所以必须在前，是因为它定义了主动偏离的对象。风险模型和组合模型不是独立世界，它们都要服务于这份偏离的表达、控制和放大。",
    left: [{ label: "对风险的影响", emphasis: "mechanism", items: ["先知道偏离哪里，才知道要测哪种风险。", "否则风险预算会对着错误对象施力。"] }],
    right: [{ label: "对组合的影响", emphasis: "example", items: ["优化器只会放大你定义过的东西。", "如果定义错了，优化只是更高效地出错。"] }],
    bottomLine: "一致收益不是本章私事，它决定了后两章究竟在为谁服务。"
  },
  {
    title: "一致收益并不保证你正确，它只保证你的偏离是可被识别和复盘的",
    narrative: "这一章最容易被误读成“只要有一致收益框架，主动管理就科学了”。不对。它只能保证你的偏离被清晰写出来，至于偏离是否正确、是否值得押注，还要靠证据、风险和组合判断。",
    headline: "一致收益提供的是可识别性，不是正确性保证",
    core: "共同起点最多让偏离变得清楚，但不会自动替你提高预测质量。真正的研究能力体现在：为什么要偏离、证据是什么、失败时会怎样，而这些都超出一致收益本身。",
    left: [{ label: "它能保证什么", emphasis: "definition", items: ["偏离对象清楚。", "比较与归因更容易。"] }],
    right: [{ label: "它不能保证什么", emphasis: "boundary", items: ["不会自动提升预测正确率。", "不会自动决定仓位应该多大。"] }],
    bottomLine: "一致收益让偏离更清楚，但不会替你证明这份偏离值得下注。"
  },
  {
    title: "研究生读法要多问一步：为什么作者宁可用有争议的模型，也不接受无起点的表达",
    narrative: "这一章真正体现学术训练的地方，是容忍一个不完美但可辩论的模型，胜过接受一个看似灵活但无法比较的收益表达。作者在方法论上更重视共同语境，而不是个体叙述自由。",
    headline: "方法论上的保守，往往比表达上的灵活更有生产力",
    core: "一致收益的讨论背后是一种方法论选择：先给出可公开争论的简化模型，再逐步修正它。这样做的收益，是让不同策略、研究员和组合都能进入同一审查框架。",
    left: [{ label: "为什么值得保守", emphasis: "note", items: ["共同语境让争论更有效。", "简化模型比无坐标表达更容易累积知识。"] }],
    right: [{ label: "如果太灵活", emphasis: "boundary", items: ["每个人都在讲自己的收益故事。", "组合层面无法统一解释与比较。"] }],
    bottomLine: "第2章真正传递的方法论是：先要一个共同起点，再谈如何修正它。"
  },
  {
    title: "这一章最后应该留下的能力，是能把任何收益判断改写成“相对一致起点的偏离”",
    narrative: "不管你研究的是价值、成长、行业配置还是事件驱动，只要属于主动管理，就应当能把判断改写成：一致起点是什么，我偏离了哪里，为什么偏离，凭什么偏离。",
    headline: "把收益判断写成偏离句，是本章最该带走的技能",
    core: "一旦掌握这种改写方式，你就不会再用模糊语言描述 alpha，而是会自然地把问题变成偏离、证据和承载方式。这正是后续风险模型和组合构建能够接上的原因。",
    left: [{ label: "改写模板", emphasis: "mechanism", items: ["共同起点是什么？", "我的偏离是什么？", "偏离证据是什么？"] }],
    right: [{ label: "直接收益", emphasis: "example", items: ["研究报告更可比较。", "组合决策更易归因。"] }],
    bottomLine: "如果本章只记住一个动作，那就是把任何收益观点都改写成相对一致起点的偏离。"
  },
  {
    title: "第2章的价值，不在教你一个收益模型，而在逼你先把“超额收益”说清楚",
    narrative: "最后回看，这一章真正严格的地方不在模型推导，而在表达纪律。作者逼读者承认：若不能先说清共同起点和偏离对象，后面关于 alpha 的任何讨论都会过早跳步。",
    headline: "这一章最严厉的要求，是不允许模糊地谈超额收益",
    core: "主动管理中的很多争论，其实不是关于谁更聪明，而是关于谁愿意先把问题说清楚。第2章的意义，就是用一致收益这把尺子，先把模糊收益语言压缩成可分析对象。",
    left: [{ label: "表达纪律", emphasis: "mechanism", items: ["不能先喊 alpha，再补定义。", "不能先谈优劣，再隐藏起点。"] }],
    right: [{ label: "后续连接", emphasis: "note", items: ["第3章会问这些偏离对应了哪些风险。", "后面的组合章会问这些偏离该如何落地成头寸。"] }],
    bottomLine: "一致收益真正带来的，不是一套结论，而是一种不许含糊地谈超额收益的纪律。"
  },
  {
    title: "第2章还在替研究过程立规矩：任何收益判断都必须能回到一个公开可检查的参照面",
    narrative: "一致收益的重要性不只在组合层，也在研究层。它要求分析师、因子研究员和组合经理都用同一种方式表达偏离，避免每个人都发明自己的收益口径。",
    headline: "共同参照面首先统一的是研究表达，而不只是组合输入",
    core: "一旦收益判断共享同一参照面，团队内的研究比较、模型评估和组合沟通都会更清楚。作者真正要建立的，是一种跨角色都能接受的收益表达纪律。",
    left: [{ label: "研究层收益", emphasis: "mechanism", items: ["不同研究可以横向比较。", "偏离大小和方向更容易统一记录。"] }],
    right: [{ label: "跨角色价值", emphasis: "example", items: ["研究员提交的判断更容易被组合经理消费。", "风控也更容易识别偏离背后的暴露方向。"] }],
    bottomLine: "一致收益统一的不只是理论起点，更是团队内部的研究表达语法。"
  },
  {
    title: "如果不能说清偏离的证据结构，那么“高预期收益”只是修辞，不是研究结论",
    narrative: "第2章虽然重点在起点，但它也逼读者意识到：偏离不能只靠语气强调。你必须说明证据来自哪里、为何足以支持相对一致收益的偏离，以及失败时最可能错在哪一步。",
    headline: "偏离要成立，必须同时给出证据结构与失败路径",
    core: "一致收益让偏离有了对象，但真正使偏离成为研究结论的，是证据结构。否则高收益预期只是在词语上偏离了共识，在方法上却没有任何可检验内容。",
    left: [{ label: "偏离成立条件", emphasis: "mechanism", items: ["先有共同起点。", "再有偏离理由。", "还要有证据结构支撑这份理由。"] }],
    right: [{ label: "失败路径", emphasis: "boundary", items: ["证据过弱时，偏离只是态度。", "证据与偏离不匹配时，组合会承担错误风险。"] }],
    bottomLine: "超额收益判断若没有证据结构支撑，就还不是研究结论，只是情绪化偏离。"
  },
  {
    title: "把第2章真正学会，意味着你能把一个含糊看法压缩成可比较、可归因、可下单的收益命题",
    narrative: "这一章最后的获得感，不应只是理解 CAPM 或一致收益术语，而是能把原本模糊的市场看法重写成一个可比较、可归因、可传给组合决策的收益命题。",
    headline: "第2章的终点，是把收益语言从观点升级成可执行命题",
    core: "只要还能停留在“我觉得会涨”这种层次，这章就没有真正学会。真正学会的标志，是你能明确共同起点、偏离方向、偏离强度和它进入组合讨论的方式。",
    left: [{ label: "可执行命题的要素", emphasis: "mechanism", items: ["共同起点。", "偏离方向与幅度。", "证据与适用边界。"] }],
    right: [{ label: "为什么这很关键", emphasis: "example", items: ["组合经理才能比较不同偏离。", "风险模型才能判断该承担哪类额外暴露。"] }],
    bottomLine: "第2章学成的标志，是你已经能把含糊看法改写成可比较、可归因、可执行的收益命题。"
  },
  {
    title: "没有共同起点，就不要轻率宣称 alpha",
    narrative: "这一章的学术性，不只在于模型，更在于表达伦理。作者要求读者承认：如果还没交代共同起点、偏离对象和证据基础，就不应该轻易把自己的看法包装成超额收益能力。",
    headline: "一致收益最终约束的是你宣称 alpha 的资格",
    core: "一致收益不仅是技术起点，也是表达门槛。它要求任何 alpha 叙述先经过共同参照和偏离说明的检验，避免把含糊判断过早升级成能力主张。",
    left: [{ label: "表达伦理", emphasis: "mechanism", items: ["先交代共同起点。", "再说明偏离。", "最后才谈 alpha 价值。"] }],
    right: [{ label: "若跳过门槛", emphasis: "boundary", items: ["团队会高估研究质量。", "组合会在模糊叙述上承担真实风险。"] }],
    bottomLine: "第2章最后收紧的，是宣称 alpha 之前必须先交代共同起点和偏离逻辑。"
  }
];

const chapter3Pages: UnitPage[] = [
  {
    title: "风险模型在这本书里首先不是波动率工具，而是识别主动暴露来自哪里的语言",
    narrative: "第3章一开头就把风险从单一数字拉回结构问题。作者更关心的不是组合有多波动，而是这些波动分别来自哪些系统性因子、哪些残差暴露，以及哪些其实只是基准带来的风险。",
    headline: "第3章先把风险定义成暴露结构，而不是结果数字",
    core: "如果风险只被看成波动率，组合经理就很难知道自己到底在承担什么。风险模型的第一任务，是把表面的收益波动拆成可识别的风险来源，使主动判断能够被准确归因。",
    left: [{ label: "风险语言", emphasis: "definition", items: ["识别来源。", "区分结构。", "连接持仓。"] }],
    right: [{ label: "和收益的关系", emphasis: "note", items: ["收益告诉你想赚什么。", "风险模型告诉你实际上押了什么。"] }],
    bottomLine: "第3章不把风险当结果统计，而是把它当作主动暴露的结构语言。"
  },
  {
    title: "风险之所以要分解，是因为主动头寸的危险常常藏在“看起来无害的叠加”里",
    narrative: "很多组合错误不是单个头寸太极端，而是多个看似分散的头寸在同一种风险上重叠。作者强调分解，就是为了把隐藏的共同暴露从表面多样性里剥出来。",
    headline: "风险分解是在拆掉“看起来分散、实际上同押一个方向”的错觉",
    core: "若不分解风险，组合经理容易把多个相似暴露误当成多样化。风险模型的价值，在于揭示这些头寸在因子、行业、风格或残差层面究竟是互补还是堆叠。",
    left: [{ label: "为什么会错觉分散", emphasis: "mechanism", items: ["名字不同的资产可能暴露相同风险。", "多头组合也可能被同一宏观因素驱动。"] }],
    right: [{ label: "分解后的收益", emphasis: "example", items: ["更准确地配置风险预算。", "更早发现组合其实在重复押注。"] }],
    bottomLine: "风险分解的目的，是让组合知道自己到底分散了什么，又重复了什么。"
  },
  {
    title: "主动风险不等于总风险，它只指相对基准多承担出来的那一部分",
    narrative: "第3章的重要纪律之一，是区分组合本身固有的基准风险，和因为主动偏离才额外承担的主动风险。如果两者不分，组合经理就会错误地奖励或惩罚不属于主动判断的收益波动。",
    headline: "风险讨论若不先分清基准与主动，就会把归因彻底搞乱",
    core: "主动管理真正需要管理的，是相对于基准额外承担出来的风险。总风险中有一部分只是跟着基准走，不能被直接算作主动管理的成败。",
    left: [{ label: "两类风险", emphasis: "definition", items: ["基准风险：你无论是否主动都要承受。", "主动风险：因为偏离基准而新增的风险。"] }],
    right: [{ label: "归因后果", emphasis: "boundary", items: ["若两者混在一起，会误判经理人的真实贡献。", "也会让风险预算失去针对性。"] }],
    bottomLine: "主动风险只计算你主动偏离之后多承担的那部分，不是把全部波动都记到主动管理头上。"
  },
  {
    title: "风险模型真正约束的不是“能不能买”，而是“这份观点值得配多少头寸”",
    narrative: "一旦把风险当成结构而非禁令，风险模型的作用就更清楚了：它不是阻止你持有观点，而是决定这份观点在组合中能被放到多大，是否会压垮其他更高质量判断。",
    headline: "风险模型把观点翻译成头寸规模语言",
    core: "收益预测给出方向感，风险模型给出规模感。两者缺一都不能进入组合：只有方向没有规模，会让好观点变成坏仓位；只有规模没有方向，又会把组合变成空壳。",
    left: [{ label: "规模问题", emphasis: "mechanism", items: ["同一观点在不同风险结构下，最优仓位完全不同。", "风险预算实质上是在问：这份偏离值得占多少组合注意力。"] }],
    right: [{ label: "实战含义", emphasis: "example", items: ["不只是决定买不买。", "更决定买多少、与谁一起买、何时需要对冲。"] }],
    bottomLine: "第3章让风险从否决器变成定量分配器：它决定观点能被放大到什么规模。"
  },
  {
    title: "把风险看成可加总的一团数字，会掩盖真正昂贵的残差暴露",
    narrative: "作者特别强调某些风险并不适合被简单看作可加总总量。原因在于，不同风险成分的成本、可对冲性和对组合解释力的影响并不相同，粗暴加总会掩盖最昂贵的部分。",
    headline: "风险的成本结构不同，决定了不能只盯一个总量数字",
    core: "风险模型的成熟，不是更会报一个总风险，而是知道哪些风险可接受、哪些风险虽小却昂贵、哪些风险看似分散却在关键时刻一起爆发。第3章因此要求进一步分部件地看风险。",
    left: [{ label: "为什么总量会骗人", emphasis: "boundary", items: ["不同风险成分的可管理性不同。", "同样大小的风险，对组合稳定性的破坏可能完全不同。"] }],
    right: [{ label: "更好的读法", emphasis: "note", items: ["先看风险来自哪里。", "再看这些来源的成本、可控性和和基准关系。"] }],
    bottomLine: "风险数字相同，不代表风险质量相同；第3章要你开始区分风险的结构成本。"
  },
  {
    title: "研究生层级真正该追问的是：这个风险模型到底帮我们排除了哪类错觉",
    narrative: "学完第3章不能只会复述因子和残差。更重要的是知道：这个模型究竟防止了哪类常见误判，比如把基准波动当成主动能力、把重复押注误当成分散、把小概率大损失埋进平均数里。",
    headline: "好风险模型的价值，体现在它能提前拆掉哪些判断错觉",
    core: "风险模型不是中性工具，它总在帮助你抵御某种典型错误。因此评价模型时，不能只看拟合或报表，而要问它具体让哪类错觉更难发生。",
    left: [{ label: "典型错觉", emphasis: "boundary", items: ["把重复暴露看成分散。", "把基准波动误算成主动贡献。", "把便宜风险和昂贵风险一视同仁。"] }],
    right: [{ label: "评价角度", emphasis: "note", items: ["它让哪些错误更容易暴露？", "它让哪些组合解释更清楚？"] }],
    bottomLine: "风险模型之所以有价值，不在于它复杂，而在于它能拆掉你最容易犯的风险错觉。"
  },
  {
    title: "把第3章迁移到实战时，第一步永远不是优化，而是先确认你真正承担了什么",
    narrative: "很多实战讨论太快跳到优化和调仓，好像模型已经告诉你答案。第3章训练的第一反应应该是停一下：当前组合究竟承担了哪些主动暴露、哪些基准暴露、哪些残差暴露？这一步不清楚，后面都是漂浮的。",
    headline: "实战中的首要动作，是先识别暴露，再谈优化",
    core: "只要风险识别还模糊，优化就只是在放大不清楚的东西。第3章的迁移价值，就是把组合管理的第一反应改造成暴露盘点，而不是参数调节。",
    left: [{ label: "正确顺序", emphasis: "mechanism", items: ["先识别暴露。", "再区分主动与基准。", "最后才进入权重调整。"] }],
    right: [{ label: "为什么要慢一步", emphasis: "example", items: ["能避免优化器把隐藏风险放大。", "能让调仓理由更可解释。"] }],
    bottomLine: "第3章迁移到实战的第一步，不是求最优，而是先把自己到底承担了什么说清楚。"
  },
  {
    title: "这一章最后交付的，不是一个公式，而是一种“先拆风险、再谈收益”的职业习惯",
    narrative: "如果说第2章把收益语言规范化，第3章就是把风险语言职业化。读完后真正该留下的，是面对任何组合都习惯先问：风险成分是什么、它们怎样和基准纠缠、哪些是主动管理真正应当拥有的风险。",
    headline: "第3章最终交付的是一种风险阅读习惯",
    core: "职业化的主动管理不会在收益故事最精彩时忘记风险结构。第3章要让你形成一种稳定习惯：先拆风险，再决定哪些收益偏离值得被保留、放大或压缩。",
    left: [{ label: "习惯内容", emphasis: "mechanism", items: ["先拆风险来源。", "再看与基准关系。", "最后决定风险是否值得承受。"] }],
    right: [{ label: "和前两章的连接", emphasis: "note", items: ["第1章提供组织视角。", "第2章提供收益起点。", "第3章提供风险承载语言。"] }],
    bottomLine: "第3章最值钱的成果，是让你面对组合时自然先问风险结构，而不是先沉迷收益故事。"
  }
];

void main();
