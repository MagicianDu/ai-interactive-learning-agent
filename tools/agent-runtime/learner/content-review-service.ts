import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";

export type PrepareContentReviewInput = {
  runId: string;
  maxRounds?: number;
  minScore?: number;
};

export type PrepareContentReviewResult =
  | {
      status: "revision_required";
      runId: string;
      round: number;
      maxRounds: number;
      reviewBriefPath: string;
      codexInstruction: string;
    }
  | {
      status: "review_complete";
      runId: string;
      round: number;
      maxRounds: number;
      stopReason: string;
    };

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

export class ContentReviewService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async prepareReview(input: PrepareContentReviewInput): Promise<PrepareContentReviewResult> {
    assertSafeRunId(input.runId);
    const maxRounds = normalizeMaxRounds(input.maxRounds);
    const completedRounds = await this.countReviewRounds(input.runId);
    if (completedRounds >= maxRounds) {
      return {
        status: "review_complete",
        runId: input.runId,
        round: completedRounds,
        maxRounds,
        stopReason: "max review rounds reached; use the latest revised bundle for publishing"
      };
    }

    const round = completedRounds + 1;
    const coursePack = await this.readPreviewJson(input.runId, "course-pack.json");
    const lessonPaths = await this.listLessonPaths(input.runId);
    const lessons = await Promise.all(lessonPaths.map((lessonPath) => this.readPreviewJson(input.runId, `lessons/${lessonPath}`)));
    const quality = await this.readQuality(input.runId);
    const reviewBrief = {
      runId: input.runId,
      round,
      maxRounds,
      criticRole: "content-review-agent",
      targetQuality: {
        minScore: input.minScore ?? 90,
        learnerMode: inferLearnerMode(lessons)
      },
      roundFocus: roundFocus(round),
      reviewPrinciples: [
        "挑刺优先：指出内容泛、跳步、低密度、模板化、图文不匹配的位置。",
        "学生自学优先：每页必须能让学生获得一个明确知识判断。",
        "来源优先：source-backed 页面必须讲出来源材料的具体概念或关系。",
        "第三轮产出优先：第 3 轮只保留可发布内容，不保留批注过程。"
      ],
      reviewerOutputContract: {
        critiqueFirst: true,
        reviseSecond: true,
        finalRoundPublishesCleanBundle: round === maxRounds,
        preserveCoursePackUnits: true
      },
      coursePack,
      lessons,
      quality
    };
    const reviewBriefPath = await this.writeBrief(input.runId, round, reviewBrief);
    return {
      status: "revision_required",
      runId: input.runId,
      round,
      maxRounds,
      reviewBriefPath,
      codexInstruction: buildCodexInstruction(round, maxRounds, reviewBriefPath)
    };
  }

  private async readPreviewJson(runId: string, relativePath: string): Promise<unknown> {
    return JSON.parse(await readFile(path.join(this.previewRoot(runId), relativePath), "utf8")) as unknown;
  }

  private async readQuality(runId: string): Promise<unknown> {
    const qualityPath = path.join(this.runRoot(runId), "quality", "course-quality-report.json");
    return JSON.parse(await readFile(qualityPath, "utf8")) as unknown;
  }

  private async listLessonPaths(runId: string): Promise<string[]> {
    const lessonsDir = path.join(this.previewRoot(runId), "lessons");
    return (await readdir(lessonsDir)).filter((entry) => entry.endsWith(".json")).sort();
  }

  private async countReviewRounds(runId: string): Promise<number> {
    const entries = await readdir(this.reviewDir(runId)).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return [];
      }
      throw error;
    });
    return entries.filter((entry) => /^round-[0-9]{3}-content-review\.json$/u.test(entry)).length;
  }

  private async writeBrief(runId: string, round: number, brief: Record<string, unknown>): Promise<string> {
    const dir = this.reviewDir(runId);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `round-${String(round).padStart(3, "0")}-content-review.json`);
    await writeFile(filePath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
    return filePath;
  }

  private runRoot(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId);
  }

  private previewRoot(runId: string): string {
    return path.join(this.runRoot(runId), "preview");
  }

  private reviewDir(runId: string): string {
    return path.join(this.runRoot(runId), "quality", "content-review");
  }
}

function buildCodexInstruction(round: number, maxRounds: number, reviewBriefPath: string): string {
  return [
    `请执行第 ${round} / ${maxRounds} 轮内容审核。`,
    `读取 review brief: ${reviewBriefPath}`,
    "你现在扮演 content-review-agent，先给 Codex 挑刺，再输出修订后的 coursePack/lessons。",
    "重点检查：知识密度、来源具体性、图文匹配、模板化标题、学生是否能自学。",
    "不要改 coursePack.units、unit page counts、sourceAnchorIds，除非当前来源锚点明显错误。",
    round === maxRounds ? "这是第 3 轮：只产出可发布版本，去掉审核批注和过程性语言。" : "修订后调用 learning_agent.publish_learning_course，再进入下一轮审核。"
  ].join("\n");
}

function inferLearnerMode(lessons: unknown[]): string {
  return lessons.some((lesson) => isRecord(lesson) && lesson.displayMode === "textbook_deck") ? "student_self_study_textbook" : "learning_deck";
}

function roundFocus(round: number): string {
  if (round === 1) {
    return "structure-and-knowledge-chain";
  }
  if (round === 2) {
    return "source-fidelity-and-density";
  }
  return "learner-readability-and-image-text-fit";
}

function normalizeMaxRounds(value: number | undefined): number {
  if (value === undefined) {
    return 3;
  }
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AgentRuntimeError("maxRounds must be an integer between 1 and 5", "INVALID_RUN_CONFIG");
  }
  return value;
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
