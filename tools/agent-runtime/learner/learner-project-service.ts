import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildBundleAuthoringGuidance } from "./bundle-authoring-guidance.js";

export type CreateLearnerProjectInput = {
  request: string;
  runId?: string;
  sourcePath?: string;
  sourceKind?: string;
  audience?: string;
  unitPages?: number;
  strategy?: string;
  selectedChapters?: string[];
  selectedTopics?: string[];
};

export type LearnerBrief = {
  topic?: string;
  sourcePath?: string;
  sourceKind: string;
  audience?: string;
  unitPages: number;
  strategy: string;
  selectedChapters?: string[];
  selectedTopics?: string[];
  language: "zh-CN";
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
        recommendedTool: "learning_agent.publish_learning_course";
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
        recommendedTool: "learning_agent.publish_learning_course",
        codexInstruction: buildBundleAuthoringGuidance(brief)
      }
    };
  }

  private async writeBrief(runId: string, brief: LearnerBrief, request: string): Promise<void> {
    const runPath = path.join(this.workspaceRoot, "runs", runId);
    await mkdir(runPath, { recursive: true });
    await writeFile(path.join(runPath, "learner-project.json"), JSON.stringify({ runId, request, brief }, null, 2), "utf8");
  }
}

function buildBrief(input: CreateLearnerProjectInput): LearnerBrief {
  const request = input.request;
  return {
    topic: inferTopic(request),
    sourcePath: input.sourcePath ?? inferPath(request),
    sourceKind: input.sourceKind ?? inferSourceKind(request),
    audience: input.audience ?? inferAudience(request),
    unitPages: input.unitPages ?? inferPages(request) ?? 8,
    strategy: input.strategy ?? inferStrategy(request),
    selectedChapters: normalizeList(input.selectedChapters) ?? inferSelectedChapters(request),
    selectedTopics: normalizeList(input.selectedTopics) ?? inferSelectedTopics(request),
    language: "zh-CN"
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
  return questions;
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

function inferPages(request: string): number | undefined {
  const match = /(?:每个单元|每单元|单元)?\s*(?<pages>[1-9][0-9]?)\s*页/u.exec(request);
  if (!match?.groups?.pages) {
    return undefined;
  }
  return Number(match.groups.pages);
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
