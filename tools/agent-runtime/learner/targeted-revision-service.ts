import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Script } from "node:vm";

import { AgentRuntimeError } from "../errors.js";
import { LearningCoursePublisher } from "./learning-course-publisher.js";
import { LearningPreviewService, type LearningPreviewResult } from "./learning-preview-service.js";
import { parseRevisionTarget, type RevisionTarget } from "./revision-targeting.js";

type ReadyLearningPreview = Extract<LearningPreviewResult, { status: "preview_ready" }>["preview"];

type RevisionBrief = {
  revisionId: string;
  feedback: string;
  focus?: string;
  target?: RevisionTarget;
};

type PreviewManifest = {
  coursePackPath: string;
  lessonPaths: string[];
};

type LessonLike = Record<string, unknown> & {
  id: string;
  pages: Array<Record<string, unknown>>;
};

export type ApplyLearningRevisionInput = {
  runId: string;
};

export type ApplyLearningRevisionResult = {
  status: "revision_applied";
  runId: string;
  revisionId: string;
  changedLessonIds: string[];
  preview: ReadyLearningPreview;
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export class TargetedRevisionService {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  async applyLatestRevision(input: ApplyLearningRevisionInput): Promise<ApplyLearningRevisionResult> {
    assertSafeRunId(input.runId);
    const revisionBrief = await this.readLatestRevisionBrief(input.runId);
    const target = revisionBrief.target ?? parseRevisionTarget(revisionBrief.feedback, revisionBrief.focus);
    const previewManifest = await this.readPreviewManifest(input.runId);
    const lessons = await Promise.all(
      previewManifest.lessonPaths.map(async (lessonPath) => readGeneratedObject(resolveWorkspacePath(this.workspaceRoot, lessonPath), "generatedLesson", "Lesson"))
    );
    const coursePack = await readGeneratedObject(
      resolveWorkspacePath(this.workspaceRoot, previewManifest.coursePackPath),
      "generatedCoursePack",
      "CoursePack"
    );

    const changedLessonIds = applyTarget(lessons.map(normalizeLesson), target);
    const publishResult = await new LearningCoursePublisher(this.workspaceRoot).publish({
      runId: input.runId,
      lessons,
      coursePack,
      publishNotes: `${revisionBrief.revisionId}: ${target.requestedChange}`
    });
    if (publishResult.status !== "preview_ready") {
      throw new AgentRuntimeError(
        `targeted revision did not pass publish validation: ${publishResult.issues[0]?.message ?? "unknown issue"}`,
        "INVALID_LESSON"
      );
    }

    const previewResult = await new LearningPreviewService(this.workspaceRoot).getPreview(input.runId);
    if (previewResult.status !== "preview_ready") {
      throw new AgentRuntimeError("learning preview was not ready after targeted revision", "MISSING_ARTIFACT");
    }

    return {
      status: "revision_applied",
      runId: input.runId,
      revisionId: revisionBrief.revisionId,
      changedLessonIds,
      preview: previewResult.preview
    };
  }

  private async readLatestRevisionBrief(runId: string): Promise<RevisionBrief> {
    const revisionsDir = path.join(this.workspaceRoot, "runs", runId, "learning-revisions");
    const entries = await readdir(revisionsDir).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        throw new AgentRuntimeError(`no revision briefs found for runId: ${runId}`, "MISSING_ARTIFACT");
      }
      throw error;
    });
    const latest = entries.filter((entry) => /^revision-[0-9]{3}\.json$/u.test(entry)).sort().at(-1);
    if (!latest) {
      throw new AgentRuntimeError(`no revision briefs found for runId: ${runId}`, "MISSING_ARTIFACT");
    }

    const value = JSON.parse(await readFile(path.join(revisionsDir, latest), "utf8")) as unknown;
    if (!isRecord(value) || typeof value.revisionId !== "string" || typeof value.feedback !== "string") {
      throw new AgentRuntimeError(`revision brief is invalid: ${latest}`, "MISSING_ARTIFACT");
    }
    return {
      revisionId: value.revisionId,
      feedback: value.feedback,
      focus: typeof value.focus === "string" ? value.focus : undefined,
      target: isRevisionTarget(value.target) ? value.target : undefined
    };
  }

  private async readPreviewManifest(runId: string): Promise<PreviewManifest> {
    const manifestPath = path.join(this.workspaceRoot, "runs", runId, "learning-preview.json");
    const value = JSON.parse(await readFile(manifestPath, "utf8").catch((error: unknown) => {
      if (isFileNotFound(error)) {
        throw new AgentRuntimeError(`learning preview is missing for runId: ${runId}`, "MISSING_ARTIFACT");
      }
      throw error;
    })) as unknown;
    if (!isRecord(value) || typeof value.coursePackPath !== "string" || !isStringArray(value.lessonPaths)) {
      throw new AgentRuntimeError("learning-preview.json is missing published course paths", "MISSING_ARTIFACT");
    }
    return {
      coursePackPath: value.coursePackPath,
      lessonPaths: value.lessonPaths
    };
  }
}

function applyTarget(lessons: LessonLike[], target: RevisionTarget): string[] {
  if (target.scope !== "page") {
    return [];
  }

  for (const lesson of lessons) {
    const page = lesson.pages[target.pageIndex];
    if (page) {
      const narrative = typeof page.narrative === "string" ? page.narrative : "";
      page.narrative = `${narrative}\n\n修订说明：${target.requestedChange}`;
      return [lesson.id];
    }
  }

  throw new AgentRuntimeError(`page target is out of range: ${target.pageIndex + 1}`, "INVALID_LESSON");
}

function normalizeLesson(value: Record<string, unknown>): LessonLike {
  if (typeof value.id !== "string" || !Array.isArray(value.pages) || !value.pages.every(isRecord)) {
    throw new AgentRuntimeError("generated lesson is missing id or pages", "INVALID_LESSON");
  }
  return value as LessonLike;
}

function readGeneratedObject(filePath: string, exportName: string, typeName: string): Promise<Record<string, unknown>> {
  return readFile(filePath, "utf8").then((source) => {
    const marker = `export const ${exportName} = `;
    const start = source.indexOf(marker);
    const suffix = ` satisfies ${typeName};`;
    const end = source.lastIndexOf(suffix);
    if (start < 0 || end < 0 || end <= start + marker.length) {
      throw new AgentRuntimeError(`generated source has unexpected format: ${filePath}`, "MISSING_ARTIFACT");
    }

    const literal = source.slice(start + marker.length, end).trim();
    const value = new Script(`(${literal})`, { filename: filePath }).runInNewContext(Object.create(null), { timeout: 1000 }) as unknown;
    if (!isRecord(value)) {
      throw new AgentRuntimeError(`generated export is not an object: ${filePath}`, "MISSING_ARTIFACT");
    }
    return value;
  });
}

function resolveWorkspacePath(workspaceRoot: string, filePath: string): string {
  const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(workspaceRoot, filePath);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AgentRuntimeError(`published path resolves outside workspace: ${filePath}`, "MISSING_ARTIFACT");
  }
  return resolved;
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isRevisionTarget(value: unknown): value is RevisionTarget {
  if (!isRecord(value) || typeof value.scope !== "string" || typeof value.requestedChange !== "string") {
    return false;
  }
  if (value.scope === "page") {
    return Number.isInteger(value.pageIndex);
  }
  return ["course", "unit", "interaction", "assessment", "source"].includes(value.scope);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
