import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { validateChineseFirstLesson } from "../quality/chinese-first-validator.js";
import { validateLessonQuality } from "../quality/lesson-quality-validator.js";
import { validateSourceGrounding } from "../quality/source-grounding-validator.js";
import type { QualityIssue } from "../quality/validation-result.js";
import { isNonEmptyString, isRecord, isStringArray } from "../quality/validation-result.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";
import type { RunConfig } from "../types.js";

type LessonLike = Record<string, unknown> & {
  id: string;
  title: string;
  audience: string;
  config: {
    targetPageCount: number;
    minPageCount?: number;
    maxPageCount?: number;
  };
  prerequisites: string[];
  learningObjectives: string[];
  pages: Array<Record<string, unknown>>;
  misconceptions: unknown[];
  transferTasks: unknown[];
  summary: string[];
};

type CoursePackLike = {
  id: string;
  title: string;
  parentRunId: string;
  sourceKind?: string;
  strategy?: string;
  audience?: string;
  language?: string;
  overviewUnitId?: string;
  units: CoursePackUnitLike[];
};

type CoursePackUnitLike = {
  unitId: string;
  title: string;
  kind: string;
  lessonId?: string;
  targetPageCount: number;
  sourceAnchorIds: string[];
  sourceNodeIds?: string[];
  chapterRefs?: string[];
  conceptIds: string[];
};

export type PublishLearningCourseInput = {
  runId: string;
  lessons: unknown[];
  coursePack: unknown;
  publishNotes?: string;
};

type LearnerProjectFile = {
  brief?: {
    topic?: string;
    sourcePath?: string;
    sourceKind?: string;
    audience?: string;
    unitPages?: number;
    strategy?: string;
    selectedChapters?: string[];
    selectedTopics?: string[];
    language?: string;
  };
};

export type PublishLearningCourseResult =
  | {
      status: "preview_ready";
      runId: string;
      coursePackId: string;
      coursePackPath: string;
      lessonPaths: string[];
      preview: LearningPreviewInfo;
      quality: {
        checkedLessons: number;
        blockingIssueCount: 0;
      };
    }
  | {
      status: "revision_required";
      runId: string;
      userMessage: string;
      issues: Array<{
        lessonId: string;
        rule: string;
        message: string;
      }>;
      next: {
        recommendedAction: "Codex should revise the course bundle and call publish_learning_course again.";
      };
    };

type LearningPreviewInfo = {
  devCommand: "npm run dev";
  localUrl: "http://127.0.0.1:5173/";
  instructions: string[];
};

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const COURSE_UNIT_KINDS = new Set(["overview", "chapter", "topic", "task", "practice", "assessment", "teacher", "hybrid"]);

export class LearningCoursePublisher {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  async publish(input: PublishLearningCourseInput): Promise<PublishLearningCourseResult> {
    assertSafeId("runId", input.runId);
    const lessons = input.lessons.map(normalizeLesson);
    if (lessons.length === 0) {
      throw new AgentRuntimeError("lessons must be a non-empty array", "INVALID_LESSON");
    }
    const coursePack = normalizeCoursePack(input.coursePack, input.runId, new Set(lessons.map((lesson) => lesson.id)));
    const sourceGroundingConfig = await this.resolveSourceGroundingConfig(input.runId);

    const blockingIssues = collectBlockingIssues(lessons, sourceGroundingConfig);
    if (blockingIssues.length > 0) {
      return {
        status: "revision_required",
        runId: input.runId,
        userMessage: "课程还不能发布：需要 Codex 先修订中文学习内容和质量问题。",
        issues: blockingIssues.map((issue) => ({
          lessonId: issue.lessonId,
          rule: issue.issue.rule,
          message: `${issue.issue.path}: ${issue.issue.message}`
        })),
        next: {
          recommendedAction: "Codex should revise the course bundle and call publish_learning_course again."
        }
      };
    }

    const lessonPaths = await Promise.all(lessons.map((lesson) => this.writeLesson(lesson)));
    const coursePackPath = await this.writeCoursePack(coursePack);
    const preview = buildPreviewInfo(coursePack);
    await this.writePreviewManifest(input.runId, coursePack, lessonPaths, coursePackPath, preview, input.publishNotes);

    return {
      status: "preview_ready",
      runId: input.runId,
      coursePackId: coursePack.id,
      coursePackPath,
      lessonPaths,
      preview,
      quality: {
        checkedLessons: lessons.length,
        blockingIssueCount: 0
      }
    };
  }

  private async resolveSourceGroundingConfig(runId: string): Promise<RunConfig | undefined> {
    try {
      return await new RunStore(this.workspaceRoot).readConfig(runId);
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
    }

    const learnerProject = await readLearnerProject(this.workspaceRoot, runId);
    const brief = learnerProject?.brief;
    if (!brief?.sourcePath || brief.sourceKind === "topic") {
      return undefined;
    }

    const sourcePath = brief.sourcePath;
    const isUrl = /^https?:\/\//u.test(sourcePath);
    const sourceLooksLikeFolder = !isUrl && !/\.[a-z0-9]{1,8}$/iu.test(sourcePath);

    return createRunConfigFromArgs({
      run: runId,
      sourceFile: !isUrl && !sourceLooksLikeFolder ? sourcePath : undefined,
      sourceFolder: sourceLooksLikeFolder ? sourcePath : undefined,
      sourceUrl: isUrl ? sourcePath : undefined,
      sourceKind: brief.sourceKind,
      sourceTitle: brief.topic,
      unitPages: String(brief.unitPages ?? 8),
      strategy: brief.strategy,
      chapters: brief.selectedChapters?.join(","),
      topics: brief.selectedTopics?.join(","),
      audience: brief.audience,
      language: brief.language,
      adapter: "mock"
    });
  }

  private async writeLesson(lesson: LessonLike): Promise<string> {
    const lessonDir = assertSafeChildPath(path.join(this.workspaceRoot, "src", "lessons"), lesson.id, "lesson id");
    await mkdir(lessonDir, { recursive: true });
    const lessonPath = path.join(lessonDir, "lesson.ts");
    await writeFile(lessonPath, renderLessonSource(lesson), "utf8");
    return lessonPath;
  }

  private async writeCoursePack(coursePack: CoursePackLike): Promise<string> {
    const coursePackDir = assertSafeChildPath(path.join(this.workspaceRoot, "src", "course-packs"), coursePack.id, "course pack id");
    await mkdir(coursePackDir, { recursive: true });
    const coursePackPath = path.join(coursePackDir, "coursePack.ts");
    await writeFile(coursePackPath, renderCoursePackSource(coursePack), "utf8");
    return coursePackPath;
  }

  private async writePreviewManifest(
    runId: string,
    coursePack: CoursePackLike,
    lessonPaths: string[],
    coursePackPath: string,
    preview: LearningPreviewInfo,
    publishNotes: string | undefined
  ): Promise<void> {
    const runDir = assertSafeChildPath(path.join(this.workspaceRoot, "runs"), runId, "runId");
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify(
        {
          status: "preview_ready",
          runId,
          coursePackId: coursePack.id,
          courseTitle: coursePack.title,
          lessonCount: lessonPaths.length,
          coursePackPath,
          lessonPaths,
          preview,
          publishNotes
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function collectBlockingIssues(lessons: LessonLike[], sourceGroundingConfig: RunConfig | undefined): Array<{ lessonId: string; issue: QualityIssue }> {
  return lessons.flatMap((lesson) =>
    [
      ...validateLessonQuality(lesson).issues,
      ...validateChineseFirstLesson(lesson).issues,
      ...(sourceGroundingConfig ? validateSourceGrounding(lesson, sourceGroundingConfig).issues : [])
    ]
      .filter((issue) => issue.severity === "error")
      .map((issue) => ({ lessonId: lesson.id, issue }))
  );
}

async function readLearnerProject(workspaceRoot: string, runId: string): Promise<LearnerProjectFile | undefined> {
  try {
    return JSON.parse(await readFile(path.join(workspaceRoot, "runs", runId, "learner-project.json"), "utf8")) as LearnerProjectFile;
  } catch (error) {
    if (isFileNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

function normalizeLesson(value: unknown): LessonLike {
  if (!isRecord(value)) {
    throw new AgentRuntimeError("lesson must be an object", "INVALID_LESSON");
  }
  if (!isNonEmptyString(value.id)) {
    throw new AgentRuntimeError("lesson.id must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_LESSON");
  }
  assertSafeId("lesson.id", value.id);
  if (!isNonEmptyString(value.title) || !isNonEmptyString(value.audience)) {
    throw new AgentRuntimeError("lesson is missing title or audience", "INVALID_LESSON");
  }
  if (!isRecord(value.config) || !Number.isInteger(value.config.targetPageCount)) {
    throw new AgentRuntimeError("lesson config.targetPageCount must be an integer", "INVALID_LESSON");
  }
  if (!isStringArray(value.prerequisites) || !isStringArray(value.learningObjectives) || !isStringArray(value.summary)) {
    throw new AgentRuntimeError("lesson prerequisites, learningObjectives, and summary must be string arrays", "INVALID_LESSON");
  }
  if (!Array.isArray(value.pages) || !Array.isArray(value.misconceptions) || !Array.isArray(value.transferTasks)) {
    throw new AgentRuntimeError("lesson pages, misconceptions, and transferTasks must be arrays", "INVALID_LESSON");
  }

  return value as LessonLike;
}

function normalizeCoursePack(value: unknown, runId: string, lessonIds: Set<string>): CoursePackLike {
  if (!isRecord(value)) {
    throw new AgentRuntimeError("coursePack must be an object", "INVALID_LESSON");
  }
  const id = isNonEmptyString(value.id) ? value.id : runId;
  assertSafeId("coursePack.id", id);
  if (!isNonEmptyString(value.title)) {
    throw new AgentRuntimeError("coursePack.title is required", "INVALID_LESSON");
  }
  const units = Array.isArray(value.units) ? value.units.map((unit) => normalizeCoursePackUnit(unit, lessonIds)) : [];
  if (units.length === 0) {
    throw new AgentRuntimeError("coursePack.units must be a non-empty array", "INVALID_LESSON");
  }

  return compactObject({
    id,
    title: value.title,
    parentRunId: isNonEmptyString(value.parentRunId) ? value.parentRunId : runId,
    sourceKind: stringOrUndefined(value.sourceKind),
    strategy: stringOrUndefined(value.strategy),
    audience: stringOrUndefined(value.audience),
    language: stringOrUndefined(value.language) ?? "zh-CN",
    overviewUnitId: stringOrUndefined(value.overviewUnitId),
    units
  }) as CoursePackLike;
}

function normalizeCoursePackUnit(value: unknown, lessonIds: Set<string>): CoursePackUnitLike {
  if (!isRecord(value)) {
    throw new AgentRuntimeError("coursePack unit must be an object", "INVALID_LESSON");
  }
  if (!isNonEmptyString(value.unitId)) {
    throw new AgentRuntimeError("coursePack unitId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_LESSON");
  }
  assertSafeId("coursePack.unitId", value.unitId);
  if (!isNonEmptyString(value.title)) {
    throw new AgentRuntimeError("coursePack unit.title is required", "INVALID_LESSON");
  }
  const kind = isNonEmptyString(value.kind) ? value.kind : "topic";
  if (!COURSE_UNIT_KINDS.has(kind)) {
    throw new AgentRuntimeError("coursePack unit.kind is invalid", "INVALID_LESSON");
  }
  if (!Number.isInteger(value.targetPageCount) || typeof value.targetPageCount !== "number" || value.targetPageCount < 1) {
    throw new AgentRuntimeError("coursePack unit.targetPageCount must be a positive integer", "INVALID_LESSON");
  }
  const lessonId = stringOrUndefined(value.lessonId);
  if (lessonId !== undefined) {
    assertSafeId("coursePack unit.lessonId", lessonId);
    if (!lessonIds.has(lessonId)) {
      throw new AgentRuntimeError(`coursePack unit.lessonId does not match a published lesson: ${lessonId}`, "INVALID_LESSON");
    }
  }

  return compactObject({
    unitId: value.unitId,
    title: value.title,
    kind,
    lessonId,
    targetPageCount: value.targetPageCount,
    sourceAnchorIds: isStringArray(value.sourceAnchorIds) ? value.sourceAnchorIds : [],
    sourceNodeIds: isStringArray(value.sourceNodeIds) ? value.sourceNodeIds : undefined,
    chapterRefs: isStringArray(value.chapterRefs) ? value.chapterRefs : undefined,
    conceptIds: isStringArray(value.conceptIds) ? value.conceptIds : []
  }) as CoursePackUnitLike;
}

function buildPreviewInfo(coursePack: CoursePackLike): LearningPreviewInfo {
  return {
    devCommand: "npm run dev",
    localUrl: "http://127.0.0.1:5173/",
    instructions: [
      "在项目根目录运行 npm run dev。",
      `打开 http://127.0.0.1:5173/，在课程包列表中选择「${coursePack.title}」。`,
      "如果页面仍显示旧课程，请刷新浏览器或重启 Vite dev server。"
    ]
  };
}

function renderLessonSource(lesson: LessonLike): string {
  return [
    'import type { Lesson } from "../../schemas/lesson.schema";',
    "",
    `export const generatedLesson = ${toTypeScriptLiteral(lesson)} satisfies Lesson;`,
    ""
  ].join("\n");
}

function renderCoursePackSource(coursePack: CoursePackLike): string {
  return [
    'import type { CoursePack } from "../../schemas/course-pack.schema";',
    "",
    `export const generatedCoursePack = ${toTypeScriptLiteral(coursePack)} satisfies CoursePack;`,
    ""
  ].join("\n");
}

function assertSafeId(fieldName: string, value: string): void {
  if (!ID_PATTERN.test(value)) {
    throw new AgentRuntimeError(`${fieldName} must match /^[a-z][a-z0-9-]{0,63}$/`, "INVALID_LESSON");
  }
}

function assertSafeChildPath(parentPath: string, childSegment: string, label: string): string {
  const resolvedParent = path.resolve(parentPath);
  const resolvedChild = path.resolve(resolvedParent, childSegment);
  const relativePath = path.relative(resolvedParent, resolvedChild);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new AgentRuntimeError(`${label} resolves outside ${resolvedParent}`, "INVALID_LESSON");
  }
  return resolvedChild;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function compactObject<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function toTypeScriptLiteral(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    return `[\n${indent(value.map((item) => toTypeScriptLiteral(item)).join(",\n"))}\n]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }
    return `{\n${indent(entries.map(([key, item]) => `${formatPropertyKey(key)}: ${toTypeScriptLiteral(item)}`).join(",\n"))}\n}`;
  }
  return JSON.stringify(value);
}

function formatPropertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function indent(value: string): string {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
