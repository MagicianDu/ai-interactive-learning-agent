import path from "node:path";

import type { CoursePackStrategy, CurriculumPlanningMode, SourceMaterialKind } from "../corpus-types.js";
import { inferCourseIntent, type CourseIntent } from "../learner/course-intent.js";
import { inferTeachingDifficultyLevel, type TeachingDifficultyLevel } from "../learner/learner-project-service.js";

export type RunIntent = {
  rawRequest: string;
  source: {
    type: "topic" | "text" | "file" | "folder" | "url";
    value: string;
    kind: SourceMaterialKind;
    title?: string;
  };
  language: "zh-CN";
  unitPages: number;
  targetTotalPages?: number;
  strategy: CoursePackStrategy;
  planningMode: CurriculumPlanningMode;
  adapter: string;
  audience?: string;
  difficultyLevel?: TeachingDifficultyLevel;
  courseIntent: CourseIntent;
};

const defaultUnitPages = 10;

export function parseRunIntent(request: string): RunIntent {
  const rawRequest = request.trim();
  if (!rawRequest) {
    throw new Error("request is required");
  }

  const source = extractSource(rawRequest);
  const strategy = extractStrategy(rawRequest);
  const courseIntent = inferCourseIntent(rawRequest);

  return {
    rawRequest,
    source,
    language: "zh-CN",
    unitPages: extractUnitPages(rawRequest, courseIntent),
    targetTotalPages: extractTargetTotalPages(rawRequest, courseIntent),
    strategy,
    planningMode: extractPlanningMode(rawRequest, strategy),
    adapter: "codex",
    audience: extractAudience(rawRequest),
    difficultyLevel: inferTeachingDifficultyLevel(rawRequest),
    courseIntent
  };
}

function extractSource(request: string): RunIntent["source"] {
  const url = request.match(/https?:\/\/[^\s，。；、)）]+/u)?.[0];
  if (url) {
    return {
      type: "url",
      value: trimTrailingPunctuation(url),
      kind: extractSourceKind(request, "url")
    };
  }

  const quotedPath = request.match(/["“]([^"”]+)["”]/u)?.[1];
  const fileOrFolderPath = quotedPath || request.match(/\/[^\s，。；、)）]+/u)?.[0];
  if (fileOrFolderPath) {
    const value = trimTrailingPunctuation(fileOrFolderPath);
    return {
      type: looksLikeFolder(value) ? "folder" : "file",
      value,
      kind: extractSourceKind(request, "file"),
      title: deriveSourceTitle(value)
    };
  }

  return {
    type: "topic",
    value: extractTopic(request),
    kind: "unknown"
  };
}

function extractSourceKind(request: string, sourceType: "file" | "url"): SourceMaterialKind {
  if (/专利/u.test(request)) {
    return "patent";
  }
  if (/论文/u.test(request)) {
    return "paper";
  }
  if (/博客/u.test(request)) {
    return "blog";
  }
  if (/文档/u.test(request)) {
    return "documentation";
  }
  if (/书籍|这本书|本书|书/u.test(request)) {
    return "book";
  }
  if (/笔记/u.test(request)) {
    return "notes";
  }
  if (/\bpaper\b/i.test(request)) {
    return "paper";
  }
  if (/\bblog\b|\bpost\b/i.test(request)) {
    return "blog";
  }
  if (/\bdocumentation\b|\bdocs\b/i.test(request)) {
    return "documentation";
  }
  if (/\bnotes?\b/i.test(request)) {
    return "notes";
  }
  if (/课程|course/i.test(request)) {
    return "course";
  }
  if (sourceType === "url" && /blog|post|article/i.test(request)) {
    return "blog";
  }
  return "unknown";
}

function extractUnitPages(request: string, courseIntent: CourseIntent): number {
  const specific = request.match(/每(?:个)?(?:学习)?(?:单元|课|课程单元)?\s*(\d{1,2})\s*页/u)?.[1];
  const withoutTotalPages = request
    .replace(/(?:总共|总计|总页数|全部|整套|整体|压缩成)\s*\d{1,3}\s*页/gu, "")
    .replace(/\d{2,4}\s*页(?:的)?(?:书|大部头|资料)/gu, "");
  const generic = withoutTotalPages.match(/(\d{1,2})\s*页/u)?.[1];
  const genericNumber = generic ? Number(generic) : undefined;
  const genericUnitPages = courseIntent === "student_self_study_textbook" && genericNumber !== undefined && genericNumber > 40 ? undefined : generic;
  const parsed = Number(specific || genericUnitPages || defaultUnitPages);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 40) {
    throw new Error("unit page count must be between 1 and 40");
  }
  return parsed;
}

function extractTargetTotalPages(request: string, courseIntent: CourseIntent): number | undefined {
  const explicit = request.match(/(?:总共|总计|总页数|全部|整套|整体|压缩成)\s*(\d{1,3})\s*页/u)?.[1];
  const withoutPerUnitPages = request
    .replace(/每(?:个)?(?:学习)?(?:单元|课|课程单元)?\s*\d{1,2}\s*页/gu, "")
    .replace(/\d{2,4}\s*页(?:的)?(?:书|大部头|资料)/gu, "");
  const standalone = courseIntent === "student_self_study_textbook" ? withoutPerUnitPages.match(/(\d{2,3})\s*页/u)?.[1] : undefined;
  const value = explicit || (standalone && Number(standalone) > 40 ? standalone : undefined);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 5 || parsed > 300) {
    throw new Error("target total page count must be between 5 and 300");
  }
  return parsed;
}

function extractStrategy(request: string): CoursePackStrategy {
  if (/按章节|章节顺序|chapter/i.test(request)) {
    return "chapter_guided";
  }
  if (/按任务|实践导向|动手|task/i.test(request)) {
    return "task_guided";
  }
  if (/总览课|总览|overview/i.test(request)) {
    return "overview_plus_topic";
  }
  if (/核心\s*topic|按\s*topic|按主题|topic/i.test(request)) {
    return "overview_plus_topic";
  }
  return "overview_plus_topic";
}

function extractPlanningMode(request: string, strategy: CoursePackStrategy): CurriculumPlanningMode {
  if (strategy === "chapter_guided") {
    return "chapter_guided";
  }
  if (strategy === "task_guided") {
    return "task_guided";
  }
  if (/核心\s*topic|按\s*topic|按主题|topic/i.test(request)) {
    return "topic_guided";
  }
  return "hybrid";
}

function extractAudience(request: string): string | undefined {
  const match = request.match(/面向(.+?)(?:[。；;，,]|$)/u)?.[1]?.trim();
  return match || undefined;
}

function extractTopic(request: string): string {
  const fromUse = request.match(/(?:用|把|基于)\s*(.+?)\s*(?:生成|做|创建|制作)/u)?.[1]?.trim();
  const topic = fromUse || request.replace(/生成.*$/u, "").trim();
  const cleaned = topic.replace(/^(一个|一套|中文|技术)\s*/u, "").trim();
  if (!cleaned) {
    throw new Error("could not infer topic from request");
  }
  return cleaned;
}

function deriveSourceTitle(value: string): string {
  return path.basename(value).replace(/\.[^.]+$/u, "") || value;
}

function looksLikeFolder(value: string): boolean {
  return !/\.[a-z0-9]{1,8}$/iu.test(value);
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[。；;，,]+$/u, "");
}
