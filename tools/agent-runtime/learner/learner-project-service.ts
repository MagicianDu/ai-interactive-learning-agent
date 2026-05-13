import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { courseIntentLabel, inferCourseIntent, normalizeCourseIntent, type CourseIntent } from "./course-intent.js";
import { ProjectRegistry } from "./project-registry.js";

export type TeachingDifficultyLevel = "introductory" | "undergraduate_core" | "upper_undergraduate_or_graduate" | "research";

export type CreateLearnerProjectInput = {
  request: string;
  runId?: string;
  sourcePath?: string;
  sourceKind?: string;
  audience?: string;
  difficultyLevel?: TeachingDifficultyLevel;
  unitPages?: number;
  targetTotalPages?: number;
  strategy?: string;
  selectedChapters?: string[];
  selectedTopics?: string[];
  courseIntent?: CourseIntent;
};

export type LearnerBrief = {
  topic?: string;
  sourcePath?: string;
  sourceKind: string;
  audience?: string;
  difficultyLevel?: TeachingDifficultyLevel;
  unitPages: number;
  unitPagesSpecified?: boolean;
  targetTotalPages?: number;
  totalPagesSpecified?: boolean;
  strategy: string;
  selectedChapters?: string[];
  selectedTopics?: string[];
  language: "zh-CN";
  courseIntent: CourseIntent;
};

export type CreateLearnerProjectResult =
  | {
      status: "clarification_required";
      runId: string;
      clarificationQuestions: string[];
      brief: LearnerBrief;
    }
  | {
      status: "project_ready";
      runId: string;
      brief: LearnerBrief;
      next: {
        recommendedTool: "learning_agent.get_authoring_context";
        codexInstruction: string;
      };
    };

export class LearnerProjectService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async createProject(input: CreateLearnerProjectInput): Promise<CreateLearnerProjectResult> {
    if (!input.request.trim()) {
      throw new Error("request is required");
    }

    const runId = input.runId ?? slugFromText(input.request);
    const brief = buildBrief(input);
    const clarificationQuestions = buildClarificationQuestions(brief);

    await this.writeBrief(runId, brief, input.request);

    if (clarificationQuestions.length > 0) {
      return { status: "clarification_required", runId, clarificationQuestions, brief };
    }

    return {
      status: "project_ready",
      runId,
      brief,
      next: {
        recommendedTool: "learning_agent.get_authoring_context",
        codexInstruction: buildAuthoringContextGuidance(runId, brief)
      }
    };
  }

  private async writeBrief(runId: string, brief: LearnerBrief, request: string): Promise<void> {
    const runPath = path.join(this.workspaceRoot, "runs", runId);
    await new ProjectRegistry(this.workspaceRoot).upsertProject({
      projectId: runId,
      title: brief.topic ?? runId,
      sourceKind: brief.sourceKind,
      sourceRefs: brief.sourcePath ? [brief.sourcePath] : [],
      audience: brief.audience,
      difficultyLevel: brief.difficultyLevel,
      language: "zh-CN",
      strategy: brief.strategy,
      unitPageCount: brief.unitPages,
      targetTotalPages: brief.targetTotalPages,
      selectedChapters: brief.selectedChapters,
      selectedTopics: brief.selectedTopics,
      courseIntent: brief.courseIntent,
      status: "draft"
    });
    const projectPath = path.join(runPath, "learner-project.json");
    const current = JSON.parse(await readFile(projectPath, "utf8")) as Record<string, unknown>;
    await writeFile(projectPath, `${JSON.stringify({ ...current, runId, request, brief }, null, 2)}\n`, "utf8");
  }
}

function buildAuthoringContextGuidance(runId: string, brief: LearnerBrief): string {
  return [
    "learner brief 已记录。下一步请调用 learning_agent.get_authoring_context 获取来源锚点、推荐单元和发布约束。",
    `runId：${runId}`,
    `输出语言：${brief.language}`,
    `课程形态：${courseIntentLabel(brief.courseIntent)}（${brief.courseIntent}）。`,
    `目标学习者：${brief.audience ?? "中文学习者"}`,
    brief.difficultyLevel ? `教学难度层级：${difficultyLabel(brief.difficultyLevel)}（${brief.difficultyLevel}）。` : undefined,
    `课程组织：${brief.strategy}，每个单元 ${brief.unitPages} 页。`,
    pageBudgetGuidance(brief),
    brief.sourcePath ? `资料路径：${brief.sourcePath}` : undefined,
    `资料类型：${brief.sourceKind}`,
    brief.selectedChapters?.length ? `指定章节：${brief.selectedChapters.join("、")}。` : undefined,
    brief.selectedTopics?.length ? `指定 topics：${brief.selectedTopics.join("、")}。` : undefined,
    "拿到 authoring context 后，由 Codex/Claude 创作 coursePack 与 lessons，再调用 learning_agent.publish_learning_course。"
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}

function buildBrief(input: CreateLearnerProjectInput): LearnerBrief {
  const request = input.request;
  const sourceKind = input.sourceKind ?? inferSourceKind(request);
  const courseIntent = normalizeCourseIntent(input.courseIntent) ?? inferCourseIntent(request);
  const inferredPages = inferPages(request, courseIntent);
  const inferredTotalPages = inferTargetTotalPages(request, courseIntent);
  const targetTotalPages = normalizeTargetTotalPages(
    input.targetTotalPages ?? inferredTotalPages ?? defaultTargetTotalPages(courseIntent, sourceKind)
  );
  const unitPages = normalizeUnitPages(input.unitPages ?? inferredPages ?? defaultUnitPages(courseIntent));
  return {
    topic: inferTopic(request),
    sourcePath: input.sourcePath ?? inferPath(request),
    sourceKind,
    audience: input.audience ?? inferAudience(request),
    difficultyLevel: input.difficultyLevel ?? inferTeachingDifficultyLevel(request),
    unitPages,
    unitPagesSpecified: input.unitPages !== undefined || inferredPages !== undefined,
    targetTotalPages,
    totalPagesSpecified: input.targetTotalPages !== undefined || inferredTotalPages !== undefined,
    strategy: input.strategy ?? inferStrategy(request),
    selectedChapters: normalizeList(input.selectedChapters) ?? inferSelectedChapters(request),
    selectedTopics: normalizeList(input.selectedTopics) ?? inferSelectedTopics(request),
    language: "zh-CN",
    courseIntent
  };
}

function buildClarificationQuestions(brief: LearnerBrief): string[] {
  const questions: string[] = [];
  if (!brief.sourcePath && !brief.topic) {
    questions.push("请提供资料路径、URL，或明确要学习的主题。");
  }
  if (!brief.audience) {
    questions.push("这套材料面向谁？例如：有编程基础但缺少系统心智模型的中文学习者。");
  }
  if (!brief.difficultyLevel) {
    questions.push("希望教学内容难度层级是什么？例如：入门衔接、本科核心、大学高年级/研究生课程，或研究论文精读/前沿讨论。");
  }
  if (
    brief.unitPagesSpecified === false &&
    !(brief.courseIntent === "student_self_study_textbook" && brief.targetTotalPages !== undefined)
  ) {
    questions.push("希望每个单元多少页？例如：6、8、10 或 12 页。");
  }
  return questions;
}

function pageBudgetGuidance(brief: LearnerBrief): string | undefined {
  if (brief.courseIntent !== "student_self_study_textbook" || brief.targetTotalPages === undefined) {
    return undefined;
  }
  if (brief.totalPagesSpecified === false) {
    if ((brief.selectedTopics?.length ?? 0) > 0 || (brief.selectedChapters?.length ?? 0) > 0) {
      return `页数策略：默认约 ${brief.targetTotalPages} 页适用于全书展开；当前已指定范围，先按每个单元 ${brief.unitPages} 页规划。`;
    }
    return `页数策略：我会先按默认约 ${brief.targetTotalPages} 页的一屏式 Web 教材规划；如果你希望更短或更长，可以直接说总页数或每个单元页数。`;
  }
  return `页数策略：总页数约 ${brief.targetTotalPages} 页，每个单元约 ${brief.unitPages} 页。`;
}

function defaultUnitPages(courseIntent: CourseIntent): number {
  return courseIntent === "student_self_study_textbook" ? 10 : 8;
}

function defaultTargetTotalPages(courseIntent: CourseIntent, sourceKind: string): number | undefined {
  return courseIntent === "student_self_study_textbook" && sourceKind === "book" ? 100 : undefined;
}

function inferTargetTotalPages(request: string, courseIntent: CourseIntent): number | undefined {
  const match = /(?:总共|总计|总页数|全部|整套|整体|压缩成)\s*(?<pages>\d{1,3})\s*页/u.exec(request);
  const withoutPerUnitPages = request
    .replace(/每(?:个)?(?:学习)?(?:单元|课|课程单元)?\s*\d{1,2}\s*页/gu, "")
    .replace(/\d{2,4}\s*页(?:的)?(?:书|大部头|资料)/gu, "");
  const standalone =
    courseIntent === "student_self_study_textbook" ? /(?<pages>\d{2,3})\s*页/u.exec(withoutPerUnitPages)?.groups?.pages : undefined;
  const value = match?.groups?.pages ?? (standalone && Number(standalone) > 40 ? standalone : undefined);
  return normalizeTargetTotalPages(value ? Number(value) : undefined);
}

function normalizeTargetTotalPages(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 5 || value > 300) {
    throw new Error("target total page count must be between 5 and 300");
  }
  return value;
}

function slugFromText(value: string): string {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return ascii || `learner-${Date.now()}`;
}

function inferPath(request: string): string | undefined {
  const quoted = /["“](?<path>[^"”]+)["”]/u.exec(request)?.groups?.path;
  if (quoted && looksLikePathOrUrl(quoted)) {
    return quoted;
  }

  return /(?<path>(?:\/|https?:\/\/)[^\s，。；,;]+)/u.exec(request)?.groups?.path;
}

function inferSourceKind(request: string): string {
  if (/论文|paper/iu.test(request)) {
    return "paper";
  }
  if (/专利|patent/iu.test(request)) {
    return "patent";
  }
  if (/博客|blog/iu.test(request)) {
    return "blog";
  }
  if (/文档|documentation|docs/iu.test(request)) {
    return "documentation";
  }
  if (/笔记|notes/iu.test(request)) {
    return "notes";
  }
  if (/书|book|pdf/iu.test(request)) {
    return "book";
  }
  return "topic";
}

function inferAudience(request: string): string | undefined {
  return /面向(?<audience>[^，。；,;]+)/u.exec(request)?.groups?.audience?.trim();
}

export function inferTeachingDifficultyLevel(request: string): TeachingDifficultyLevel | undefined {
  const explicit = /(?:教学)?难度(?:层级)?\s*[=＝:：]?\s*(?<level>introductory|undergraduate_core|upper_undergraduate_or_graduate|research)\b/iu.exec(
    request
  )?.groups?.level;
  if (explicit) {
    return explicit.toLowerCase() as TeachingDifficultyLevel;
  }
  if (/研究论文精读|论文精读|前沿讨论|研究前沿|博士|专家级|research/iu.test(request)) {
    return "research";
  }
  if (/大学高年级|研究生课程|研究生级|研究生/u.test(request)) {
    return "upper_undergraduate_or_graduate";
  }
  if (/本科核心|本科课程|大学本科|本科/u.test(request)) {
    return "undergraduate_core";
  }
  if (/入门衔接|零基础|入门|基础课/u.test(request)) {
    return "introductory";
  }
  return undefined;
}

function normalizeUnitPages(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 40) {
    throw new Error("unit page count must be between 1 and 40");
  }
  return value;
}

function inferPages(request: string, courseIntent: CourseIntent): number | undefined {
  const withoutTotalPages = request
    .replace(/(?:总共|总计|总页数|全部|整套|整体|压缩成)\s*\d{1,3}\s*页/gu, "")
    .replace(/\d{2,4}\s*页(?:的)?(?:书|大部头|资料)/gu, "");
  const match = /(?:每个单元|每单元|单元)?\s*(?<pages>[1-9][0-9]?)\s*页/u.exec(withoutTotalPages);
  if (!match?.groups?.pages) {
    return undefined;
  }
  const parsed = Number(match.groups.pages);
  return courseIntent === "student_self_study_textbook" && parsed > 40 ? undefined : parsed;
}

function inferStrategy(request: string): string {
  const explicitStrategy = /strategy\s*=\s*(?<strategy>overview_plus_topic|chapter_guided|topic_guided|task_guided|hybrid)/iu.exec(
    request
  )?.groups?.strategy;
  if (explicitStrategy) {
    return explicitStrategy.toLowerCase();
  }
  if (/按章节|章节顺序|chapter/iu.test(request)) {
    return "chapter_guided";
  }
  if (/按任务|实践导向|动手|task/iu.test(request)) {
    return "task_guided";
  }
  if (/章节映射|混合|hybrid/iu.test(request)) {
    return "hybrid";
  }
  if (/按\s*topic|核心\s*topic|按主题|topic/iu.test(request)) {
    return "overview_plus_topic";
  }
  return "overview_plus_topic";
}

function inferSelectedChapters(request: string): string[] | undefined {
  const chapters = Array.from(request.matchAll(/第\s*[一二三四五六七八九十百0-9]+\s*[章节]/gu))
    .map((match) => match[0].replace(/\s+/g, " "))
    .map((value) => value.trim());
  return normalizeList(chapters);
}

function inferSelectedTopics(request: string): string[] | undefined {
  const match = /(?:topics?|主题|topic)\s*[:：]\s*(?<topics>[^。；;\n]+)/iu.exec(request)?.groups?.topics;
  if (!match) {
    return undefined;
  }
  return normalizeList(match.split(/[，,、]/u));
}

function normalizeList(values: string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function inferTopic(request: string): string | undefined {
  const topic = /(?:学习|生成|关于)(?<topic>[\p{Script=Han}A-Za-z0-9 _-]{2,32})(?:中文|课程|学习材料|网页|，|。|$)/u.exec(request)
    ?.groups?.topic;
  if (!topic) {
    return undefined;
  }
  const normalized = topic.replace(/这本书|这篇论文|这份专利|材料|资料/g, "").trim();
  return normalized || undefined;
}

function looksLikePathOrUrl(value: string): boolean {
  return value.startsWith("/") || /^https?:\/\//u.test(value);
}

export function difficultyLabel(level: TeachingDifficultyLevel): string {
  switch (level) {
    case "introductory":
      return "入门衔接";
    case "undergraduate_core":
      return "本科核心课程";
    case "upper_undergraduate_or_graduate":
      return "大学高年级/研究生课程";
    case "research":
      return "研究论文精读/前沿讨论";
  }
}
