import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { LearningPreviewService, type LearningPreviewResult } from "./learning-preview-service.js";

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
    const revisionId = await nextRevisionId(revisionsDir);
    const previewResult = await new LearningPreviewService(this.workspaceRoot).getPreview(input.runId);
    const currentPreview = previewResult.status === "preview_ready" ? previewResult.preview : undefined;
    const revisionBrief = {
      schemaVersion: 1,
      runId: input.runId,
      revisionId,
      feedback,
      focus: input.focus,
      currentPreview,
      createdAt: new Date().toISOString(),
      instruction:
        "Codex should revise the existing Chinese course bundle according to this learner feedback, preserve source grounding, and call learning_agent.publish_learning_course again."
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
  const entries = await readdir(revisionsDir).catch((error: unknown) => {
    if (isFileNotFound(error)) {
      return [];
    }
    throw error;
  });
  const latest = entries
    .map((entry) => /^revision-(?<index>[0-9]{3})\.json$/u.exec(entry)?.groups?.index)
    .filter((index): index is string => index !== undefined)
    .map(Number)
    .sort((left, right) => right - left)[0];
  return `revision-${String((latest ?? 0) + 1).padStart(3, "0")}`;
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
