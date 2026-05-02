import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { LearningPreviewService, type LearningPreviewResult } from "./learning-preview-service.js";
import { parseRevisionTarget, type RevisionTarget } from "./revision-targeting.js";

type ReadyLearningPreview = Extract<LearningPreviewResult, { status: "preview_ready" }>["preview"];

export type RequestLearningRevisionInput = {
  runId: string;
  feedback: string;
  focus?: string;
};

export type RequestLearningRevisionResult = {
  status: "revision_brief_ready";
  runId: string;
  revisionId: string;
  revisionBriefPath: string;
  feedback: string;
  focus?: string;
  target: RevisionTarget;
  currentPreview?: ReadyLearningPreview;
  next: {
    recommendedTool: "learning_agent.publish_learning_course";
    codexInstruction: string;
  };
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export class LearningRevisionService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async requestRevision(input: RequestLearningRevisionInput): Promise<RequestLearningRevisionResult> {
    assertSafeRunId(input.runId);
    const feedback = input.feedback.trim();
    if (!feedback) {
      throw new AgentRuntimeError("feedback is required", "INVALID_RUN_CONFIG");
    }

    const revisionsDir = path.join(this.workspaceRoot, "runs", input.runId, "learning-revisions");
    await mkdir(revisionsDir, { recursive: true });
    const previousFeedbackCount = await countExistingRevisionBriefs(revisionsDir);
    const revisionId = await nextRevisionId(revisionsDir);
    const previewResult = await new LearningPreviewService(this.workspaceRoot).getPreview(input.runId);
    const currentPreview = previewResult.status === "preview_ready" ? previewResult.preview : undefined;
    const publishManifest = await readPublishManifest(this.workspaceRoot, input.runId);
    const target = parseRevisionTarget(feedback, input.focus);
    const revisionBrief = {
      schemaVersion: 1,
      runId: input.runId,
      revisionId,
      feedback,
      focus: input.focus,
      target,
      currentPreview,
      currentCoursePackPath: publishManifest?.coursePackPath,
      currentLessonPaths: publishManifest?.lessonPaths ?? [],
      previousFeedbackCount,
      createdAt: new Date().toISOString(),
      instruction:
        "Codex should read the current published lesson files, revise only the parts affected by learner feedback, preserve source grounding, and call learning_agent.publish_learning_course again."
    };
    const revisionBriefPath = path.join(revisionsDir, `${revisionId}.json`);
    await writeFile(revisionBriefPath, `${JSON.stringify(revisionBrief, null, 2)}\n`, "utf8");

    return {
      status: "revision_brief_ready",
      runId: input.runId,
      revisionId,
      revisionBriefPath,
      feedback,
      focus: input.focus,
      target,
      currentPreview,
      next: {
        recommendedTool: "learning_agent.publish_learning_course",
        codexInstruction:
          "请读取 revision brief 和当前课程，根据用户反馈修订 coursePack 与 lessons，保留中文、互动反馈和来源锚点，然后再次调用 learning_agent.publish_learning_course。"
      }
    };
  }
}

async function nextRevisionId(revisionsDir: string): Promise<string> {
  const latest = await latestRevisionIndex(revisionsDir);
  return `revision-${String((latest ?? 0) + 1).padStart(3, "0")}`;
}

async function countExistingRevisionBriefs(revisionsDir: string): Promise<number> {
  const entries = await readRevisionEntries(revisionsDir);
  return entries.length;
}

async function latestRevisionIndex(revisionsDir: string): Promise<number | undefined> {
  const entries = await readRevisionEntries(revisionsDir);
  return entries
    .map((entry) => Number(/^revision-(?<index>[0-9]{3})\.json$/u.exec(entry)?.groups?.index ?? 0))
    .filter((index) => index > 0)
    .sort((left, right) => right - left)[0];
}

async function readRevisionEntries(revisionsDir: string): Promise<string[]> {
  const entries = await readdir(revisionsDir).catch((error: unknown) => {
    if (isFileNotFound(error)) {
      return [];
    }
    throw error;
  });
  return entries.filter((entry) => /^revision-[0-9]{3}\.json$/u.test(entry));
}

async function readPublishManifest(
  workspaceRoot: string,
  runId: string
): Promise<{ coursePackPath?: string; lessonPaths?: string[] } | undefined> {
  try {
    const manifest = JSON.parse(await readFile(path.join(workspaceRoot, "runs", runId, "learning-preview.json"), "utf8")) as unknown;
    if (!isRecord(manifest)) {
      return undefined;
    }
    return {
      coursePackPath: typeof manifest.coursePackPath === "string" ? manifest.coursePackPath : undefined,
      lessonPaths: Array.isArray(manifest.lessonPaths) && manifest.lessonPaths.every((item) => typeof item === "string")
        ? manifest.lessonPaths
        : undefined
    };
  } catch (error) {
    if (isFileNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
