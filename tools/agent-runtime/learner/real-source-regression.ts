import { access, readFile } from "node:fs/promises";

import { GroundedCourseService } from "./grounded-course-service.js";
import { LearnerProjectService } from "./learner-project-service.js";

export type RealSourceRegressionSemanticStatus = "passed" | "warning" | "failed";

export type RealSourceRegressionSample = {
  id: string;
  title: string;
  sourceKind: "book" | "paper" | "patent" | "blog";
  sourceType: "file" | "url";
  sourcePath: string;
  strategy: "overview_plus_topic" | "chapter_guided" | "topic_guided" | "task_guided" | "hybrid";
  selectedChapters?: string[];
  selectedTopics?: string[];
  unitPages: number;
  audience: string;
  acceptanceChecks: string[];
};

export type RealSourceRegressionSampleResult = {
  id: string;
  runId: string;
  title: string;
  sourceKind: RealSourceRegressionSample["sourceKind"];
  sourceType: RealSourceRegressionSample["sourceType"];
  sourcePath: string;
  sourceAvailable: boolean;
  status: "project_ready" | "clarification_required";
  groundedCourseStatus?: "preview_ready" | "revision_required";
  sourceAnchorCount?: number;
  sourceIngestWarningCount?: number;
  strategy: string;
  selectedChapters?: string[];
  selectedTopics?: string[];
  unitPages: number;
  acceptanceChecks: string[];
  generatedUnitCount: number;
  semanticStatus: RealSourceRegressionSemanticStatus;
  missingConceptLabels: string[];
  semanticExpectations: {
    expectedConceptLabels: string[];
    matchedConceptLabels: string[];
    missingConceptLabels: string[];
  };
  clarificationQuestions?: string[];
};

export type RealSourceRegressionResult = {
  summary: {
    total: number;
    ready: number;
    groundedReady: number;
    missingLocalSources: number;
  };
  samples: RealSourceRegressionSampleResult[];
};

export type RunRealSourceRegressionOptions = {
  samples?: RealSourceRegressionSample[];
  generateGroundedCourse?: boolean;
};

export const realSourceRegressionSamples: RealSourceRegressionSample[] = [
  {
    id: "book-agentic-design",
    title: "Agentic Design Patterns",
    sourceKind: "book",
    sourceType: "file",
    sourcePath: "/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf",
    strategy: "hybrid",
    selectedTopics: ["agent loop", "tool use", "multi-agent review"],
    unitPages: 8,
    audience: "有编程基础但缺少智能体系统心智模型的中文学习者",
    acceptanceChecks: [
      "overview unit covers the whole book map",
      "topic units preserve chapter/source mapping",
      "source-backed lessons require source anchors"
    ]
  },
  {
    id: "paper-talk-reasoner",
    title: "Agents Thinking Fast and Slow: A Talker-Reasoner Architecture",
    sourceKind: "paper",
    sourceType: "file",
    sourcePath: "/Users/dm/Documents/1.书籍资料/1.基础模型训练/推理/Agents Thinking Fast and Slow- A Talker-Reasoner Architecture.pdf",
    strategy: "topic_guided",
    selectedTopics: ["problem", "architecture", "evaluation", "limitations", "transfer"],
    unitPages: 8,
    audience: "希望用中文理解智能体论文方法边界和系统结构的学习者",
    acceptanceChecks: [
      "overview separates problem, method, evidence, and limitations",
      "method units preserve source anchors",
      "transfer task asks learner to apply the method boundary to a new system"
    ]
  },
  {
    id: "patent-rag-legal-research",
    title: "Retrieval-augmented content generation for legal research",
    sourceKind: "patent",
    sourceType: "url",
    sourcePath: "https://patents.google.com/patent/WO2025085566A1/en",
    strategy: "hybrid",
    selectedTopics: ["claims", "technical solution", "embodiments", "risk boundary"],
    unitPages: 8,
    audience: "需要用中文理解 AI 专利权利要求和技术边界的学习者",
    acceptanceChecks: [
      "claim units distinguish claim text from explanatory analogy",
      "technical solution units preserve source anchors",
      "risk transfer task asks learner to evaluate claim boundary"
    ]
  },
  {
    id: "blog-agentic-rag",
    title: "Bonus Journey: Agentic RAG",
    sourceKind: "blog",
    sourceType: "url",
    sourcePath: "https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/bonus-rag-time-journey-agentic-rag/4404652",
    strategy: "task_guided",
    selectedTopics: ["agentic RAG workflow", "tool choice", "evaluation"],
    unitPages: 8,
    audience: "希望把技术博客转成可操作中文教程的学习者",
    acceptanceChecks: [
      "lesson starts from a practical implementation problem",
      "at least two interactions require learner decisions",
      "source-backed claims cite blog anchors or mark inferred background"
    ]
  }
];

const expectedSemanticConceptLabelsByKind: Record<RealSourceRegressionSample["sourceKind"], string[]> = {
  book: ["全局地图", "核心机制"],
  paper: ["研究问题", "方法结构", "证据边界"],
  patent: ["权利要求边界", "技术方案", "实施例"],
  blog: ["实践问题", "操作流程"]
};

export async function runRealSourceRegressionSuite(
  workspaceRoot: string,
  options: RunRealSourceRegressionOptions = {}
): Promise<RealSourceRegressionResult> {
  const samples = options.samples ?? realSourceRegressionSamples;
  const service = new LearnerProjectService(workspaceRoot);
  const groundedCourseService = new GroundedCourseService(workspaceRoot);
  const results: RealSourceRegressionSampleResult[] = [];

  for (const sample of samples) {
    const sourceAvailable = await isSourceAvailable(sample);
    const runId = `regression-${sample.id}`;
    const project = await service.createProject({
      request: buildRegressionRequest(sample),
      runId,
      sourcePath: sample.sourcePath,
      sourceKind: sample.sourceKind,
      audience: sample.audience,
      unitPages: sample.unitPages,
      strategy: sample.strategy,
      selectedChapters: sample.selectedChapters,
      selectedTopics: sample.selectedTopics
    });
    const groundedCourse =
      options.generateGroundedCourse && project.status === "project_ready"
        ? await groundedCourseService.generate({ runId })
        : undefined;
    const semanticExpectations = await buildSemanticExpectations(sample.sourceKind, groundedCourse?.sourceIngest.artifactPath);
    const generatedUnitCount = groundedCourse?.status === "preview_ready" ? groundedCourse.lessonPaths.length : 0;
    const missingConceptLabels = semanticExpectations.missingConceptLabels;
    const semanticStatus = resolveSemanticStatus({
      sourceKind: sample.sourceKind,
      generatedUnitCount,
      missingConceptLabels,
      sourceIngestWarningCount: groundedCourse?.sourceIngest.warningCount ?? 0
    });

    results.push({
      id: sample.id,
      runId,
      title: sample.title,
      sourceKind: sample.sourceKind,
      sourceType: sample.sourceType,
      sourcePath: sample.sourcePath,
      sourceAvailable,
      status: project.status,
      groundedCourseStatus: groundedCourse?.status,
      sourceAnchorCount: groundedCourse?.sourceIngest.anchorCount,
      sourceIngestWarningCount: groundedCourse?.sourceIngest.warningCount,
      strategy: project.brief.strategy,
      selectedChapters: project.brief.selectedChapters,
      selectedTopics: project.brief.selectedTopics,
      unitPages: project.brief.unitPages,
      acceptanceChecks: sample.acceptanceChecks,
      generatedUnitCount,
      semanticStatus,
      missingConceptLabels,
      semanticExpectations,
      ...(project.status === "clarification_required" ? { clarificationQuestions: project.clarificationQuestions } : {})
    });
  }

  return {
    summary: {
      total: results.length,
      ready: results.filter((sample) => sample.status === "project_ready").length,
      groundedReady: results.filter((sample) => sample.groundedCourseStatus === "preview_ready").length,
      missingLocalSources: results.filter((sample) => sample.sourceType === "file" && !sample.sourceAvailable).length
    },
    samples: results
  };
}

export function resolveSemanticStatus(input: {
  sourceKind: RealSourceRegressionSample["sourceKind"];
  generatedUnitCount: number;
  missingConceptLabels: string[];
  sourceIngestWarningCount: number;
}): RealSourceRegressionSemanticStatus {
  if (input.generatedUnitCount < 3) {
    return "failed";
  }

  if (input.missingConceptLabels.length > 0 && input.sourceKind !== "blog") {
    return "failed";
  }

  if (input.sourceKind === "blog" && input.sourceIngestWarningCount > 0 && input.generatedUnitCount > 0) {
    return "warning";
  }

  return "passed";
}

async function isSourceAvailable(sample: RealSourceRegressionSample): Promise<boolean> {
  if (sample.sourceType === "url") {
    return /^https?:\/\//u.test(sample.sourcePath);
  }

  try {
    await access(sample.sourcePath);
    return true;
  } catch {
    return false;
  }
}

async function buildSemanticExpectations(
  sourceKind: RealSourceRegressionSample["sourceKind"],
  sourceIngestPath: string | undefined
): Promise<RealSourceRegressionSampleResult["semanticExpectations"]> {
  const expectedConceptLabels = expectedSemanticConceptLabelsByKind[sourceKind];
  const actualConceptLabels = sourceIngestPath ? await readSourceIngestConceptLabels(sourceIngestPath) : [];
  const matchedConceptLabels = expectedConceptLabels.filter((label) => actualConceptLabels.includes(label));

  return {
    expectedConceptLabels,
    matchedConceptLabels,
    missingConceptLabels: expectedConceptLabels.filter((label) => !matchedConceptLabels.includes(label))
  };
}

async function readSourceIngestConceptLabels(sourceIngestPath: string): Promise<string[]> {
  try {
    const sourceIngest = JSON.parse(await readFile(sourceIngestPath, "utf8")) as {
      concepts?: Array<{ label?: unknown }>;
    };
    return Array.from(
      new Set(
        (sourceIngest.concepts ?? [])
          .map((concept) => concept.label)
          .filter((label): label is string => typeof label === "string" && label.trim().length > 0)
      )
    );
  } catch {
    return [];
  }
}

function buildRegressionRequest(sample: RealSourceRegressionSample): string {
  return [
    `请使用 learningAgent MCP 服务把这份${sample.sourceKind}生成中文学习网页：${sample.sourcePath}`,
    `课程组织方式：strategy=${sample.strategy}。每个单元 ${sample.unitPages} 页。`,
    sample.selectedChapters?.length ? `指定章节：${sample.selectedChapters.join("、")}。` : undefined,
    sample.selectedTopics?.length ? `指定 topics：${sample.selectedTopics.join("、")}。` : undefined,
    `面向${sample.audience}。`,
    "不要让我审批内部 artifacts；请直接生成 course bundle 并调用 publish_learning_course。"
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}
