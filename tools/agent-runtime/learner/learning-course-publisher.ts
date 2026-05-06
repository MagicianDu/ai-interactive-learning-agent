import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { validateChineseFirstLesson } from "../quality/chinese-first-validator.js";
import {
  buildCourseQualityReport,
  toCompactCourseQualityReport,
  writeCourseQualityReport,
  type CompactCourseQualityReport
} from "../quality/course-quality-report.js";
import { validateLessonQuality } from "../quality/lesson-quality-validator.js";
import { analyzeSourceEvidence } from "../quality/source-evidence-analyzer.js";
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
  outputMode?: "preview" | "source";
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
      outputMode: "preview" | "source";
      coursePackPath: string;
      lessonPaths: string[];
      previewManifestPath: string;
      preview: LearningPreviewInfo;
      qualityReport: CompactCourseQualityReport;
      quality: {
        checkedLessons: number;
        blockingIssueCount: 0;
      };
    }
  | {
      status: "revision_required";
      runId: string;
      userMessage: string;
      qualityReport: CompactCourseQualityReport;
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
  localUrl: string;
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
    const sourceEvidence = sourceGroundingConfig ? analyzeSourceEvidence(lessons, sourceGroundingConfig) : undefined;
    const courseQualityReport = buildCourseQualityReport({
      runId: input.runId,
      coursePackId: coursePack.id,
      lessons,
      sourceGroundingConfig,
      sourceEvidence
    });
    const courseQualityReportPath = await writeCourseQualityReport(this.workspaceRoot, input.runId, courseQualityReport);
    const compactQualityReport = toCompactCourseQualityReport(courseQualityReport, courseQualityReportPath);

    const blockingIssues = collectBlockingIssues(lessons, sourceGroundingConfig);
    if (blockingIssues.length > 0) {
      return {
        status: "revision_required",
        runId: input.runId,
        userMessage: "课程还不能发布：需要 Codex 先修订中文学习内容和质量问题。",
        qualityReport: compactQualityReport,
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

    const outputMode = input.outputMode ?? "preview";
    const preview = buildPreviewInfo(input.runId, coursePack);
    const publishedPaths =
      outputMode === "source" ? await this.writeSourceBundle(lessons, coursePack) : await this.writePreviewBundle(input.runId, lessons, coursePack);
    const previewManifestPath = await this.writePreviewManifest({
      runId: input.runId,
      coursePack,
      lessonPaths: publishedPaths.lessonPaths,
      coursePackPath: publishedPaths.coursePackPath,
      preview,
      publishNotes: input.publishNotes,
      outputMode,
      qualityReport: compactQualityReport,
      previewRelativeCoursePackPath: publishedPaths.previewRelativeCoursePackPath,
      previewRelativeLessonPaths: publishedPaths.previewRelativeLessonPaths
    });

    return {
      status: "preview_ready",
      runId: input.runId,
      coursePackId: coursePack.id,
      outputMode,
      coursePackPath: publishedPaths.coursePackPath,
      lessonPaths: publishedPaths.lessonPaths,
      previewManifestPath,
      preview,
      qualityReport: compactQualityReport,
      quality: {
        checkedLessons: lessons.length,
        blockingIssueCount: 0
      }
    };
  }

  private async writeSourceBundle(lessons: LessonLike[], coursePack: CoursePackLike): Promise<PublishedPaths> {
    const lessonPaths = await Promise.all(lessons.map((lesson) => this.writeLessonSource(lesson)));
    const coursePackPath = await this.writeCoursePackSource(coursePack);
    return {
      coursePackPath,
      lessonPaths,
      previewRelativeCoursePackPath: undefined,
      previewRelativeLessonPaths: undefined
    };
  }

  private async writePreviewBundle(runId: string, lessons: LessonLike[], coursePack: CoursePackLike): Promise<PublishedPaths> {
    const previewDir = assertSafeChildPath(path.join(this.workspaceRoot, "runs"), runId, "runId");
    const previewRoot = path.join(previewDir, "preview");
    const lessonsDir = path.join(previewRoot, "lessons");
    await mkdir(lessonsDir, { recursive: true });
    const coursePackPath = path.join(previewRoot, "course-pack.json");
    await writeJsonFile(coursePackPath, coursePack);
    const lessonPaths = await Promise.all(
      lessons.map(async (lesson) => {
        const lessonPath = path.join(lessonsDir, `${lesson.id}.json`);
        await writeJsonFile(lessonPath, lesson);
        return lessonPath;
      })
    );

    return {
      coursePackPath,
      lessonPaths,
      previewRelativeCoursePackPath: "course-pack.json",
      previewRelativeLessonPaths: lessons.map((lesson) => `lessons/${lesson.id}.json`)
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

  private async writeLessonSource(lesson: LessonLike): Promise<string> {
    const lessonDir = assertSafeChildPath(path.join(this.workspaceRoot, "src", "lessons"), lesson.id, "lesson id");
    await mkdir(lessonDir, { recursive: true });
    const lessonPath = path.join(lessonDir, "lesson.ts");
    await writeFile(lessonPath, renderLessonSource(lesson), "utf8");
    return lessonPath;
  }

  private async writeCoursePackSource(coursePack: CoursePackLike): Promise<string> {
    const coursePackDir = assertSafeChildPath(path.join(this.workspaceRoot, "src", "course-packs"), coursePack.id, "course pack id");
    await mkdir(coursePackDir, { recursive: true });
    const coursePackPath = path.join(coursePackDir, "coursePack.ts");
    await writeFile(coursePackPath, renderCoursePackSource(coursePack), "utf8");
    return coursePackPath;
  }

  private async writePreviewManifest({
    runId,
    coursePack,
    lessonPaths,
    coursePackPath,
    preview,
    publishNotes,
    outputMode,
    qualityReport,
    previewRelativeCoursePackPath,
    previewRelativeLessonPaths
  }: {
    runId: string;
    coursePack: CoursePackLike;
    lessonPaths: string[];
    coursePackPath: string;
    preview: LearningPreviewInfo;
    publishNotes: string | undefined;
    outputMode: "preview" | "source";
    qualityReport: CompactCourseQualityReport;
    previewRelativeCoursePackPath: string | undefined;
    previewRelativeLessonPaths: string[] | undefined;
  }): Promise<string> {
    const runDir = assertSafeChildPath(path.join(this.workspaceRoot, "runs"), runId, "runId");
    const previewDir = path.join(runDir, "preview");
    await mkdir(runDir, { recursive: true });
    await mkdir(previewDir, { recursive: true });
    const previewManifestPath = path.join(previewDir, "manifest.json");
    const previewManifest = {
      schemaVersion: 1,
      status: "preview_ready",
      outputMode,
      runId,
      coursePackId: coursePack.id,
      courseTitle: coursePack.title,
      lessonCount: lessonPaths.length,
      coursePackPath: previewRelativeCoursePackPath ?? coursePackPath,
      lessonPaths: previewRelativeLessonPaths ?? lessonPaths,
      preview,
      qualityReport,
      publishNotes
    };
    await writeJsonFile(previewManifestPath, previewManifest);
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify(
        {
          status: "preview_ready",
          schemaVersion: 2,
          outputMode,
          runId,
          coursePackId: coursePack.id,
          courseTitle: coursePack.title,
          lessonCount: lessonPaths.length,
          coursePackPath,
          lessonPaths,
          previewManifestPath,
          preview,
          qualityReport,
          publishNotes
        },
        null,
        2
      ),
      "utf8"
    );
    return previewManifestPath;
  }
}

type PublishedPaths = {
  coursePackPath: string;
  lessonPaths: string[];
  previewRelativeCoursePackPath: string | undefined;
  previewRelativeLessonPaths: string[] | undefined;
};

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

function buildPreviewInfo(runId: string, coursePack: CoursePackLike): LearningPreviewInfo {
  return {
    devCommand: "npm run dev",
    localUrl: `http://127.0.0.1:5173/#/preview/${runId}`,
    instructions: [
      "在项目根目录运行 npm run dev。",
      `打开 http://127.0.0.1:5173/#/preview/${runId}，直接查看「${coursePack.title}」。`,
      "预览数据从 runs/<run-id>/preview/ 读取，不需要写入 src。"
    ]
  };
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
