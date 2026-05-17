import { readFile } from "node:fs/promises";
import path from "node:path";

import { isRecord } from "../quality/validation-result.js";

export type CourseProductionBenchmarkTarget = {
  sourceId: string;
  runIds: string[];
  minScore?: number;
  minReviewRounds?: number;
};

export type CourseProductionBenchmarkRun = {
  runId: string;
  status: "passed" | "warning" | "failed";
  score: number | null;
  reviewRounds: number;
  reviewVerdict: string | null;
  imagegenCompletedItems: number;
  imagegenTotalItems: number;
  layoutStatus: string | null;
  blockingReasons: string[];
  warnings: string[];
};

export type CourseProductionBenchmarkTargetReport = {
  sourceId: string;
  status: "passed" | "warning" | "failed";
  repeatCount: number;
  minScore: number;
  minReviewRounds: number;
  runs: CourseProductionBenchmarkRun[];
  blockingReasons: string[];
  warnings: string[];
};

export type CourseProductionBenchmarkReport = {
  status: "passed" | "warning" | "failed";
  summary: {
    targetCount: number;
    runCount: number;
    passedRunCount: number;
    failedRunCount: number;
    warningTargetCount: number;
  };
  targets: CourseProductionBenchmarkTargetReport[];
};

const DEFAULT_MIN_SCORE = 90;
const DEFAULT_MIN_REVIEW_ROUNDS = 3;
const REQUIRED_REPEAT_COUNT = 2;

export class CourseProductionBenchmarkService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async evaluate(input: { targets: CourseProductionBenchmarkTarget[] }): Promise<CourseProductionBenchmarkReport> {
    const targets = await Promise.all(input.targets.map((target) => this.evaluateTarget(target)));
    const runs = targets.flatMap((target) => target.runs);
    const failedRunCount = runs.filter((run) => run.status === "failed").length;
    const warningTargetCount = targets.filter((target) => target.status === "warning").length;
    const status =
      targets.some((target) => target.status === "failed") || failedRunCount > 0
        ? "failed"
        : warningTargetCount > 0
          ? "warning"
          : "passed";
    return {
      status,
      summary: {
        targetCount: targets.length,
        runCount: runs.length,
        passedRunCount: runs.filter((run) => run.status === "passed").length,
        failedRunCount,
        warningTargetCount
      },
      targets
    };
  }

  private async evaluateTarget(target: CourseProductionBenchmarkTarget): Promise<CourseProductionBenchmarkTargetReport> {
    const minScore = target.minScore ?? DEFAULT_MIN_SCORE;
    const minReviewRounds = target.minReviewRounds ?? DEFAULT_MIN_REVIEW_ROUNDS;
    const runs = await Promise.all(target.runIds.map((runId) => this.evaluateRun(runId, minScore, minReviewRounds)));
    const blockingReasons = runs.flatMap((run) => run.blockingReasons);
    const warnings = runs.flatMap((run) => run.warnings);
    if (target.runIds.length < REQUIRED_REPEAT_COUNT) {
      warnings.push(
        `${target.sourceId} needs at least ${REQUIRED_REPEAT_COUNT} production repeats; observed ${target.runIds.length}.`
      );
    }
    const status =
      blockingReasons.length > 0
        ? "failed"
        : warnings.length > 0
          ? "warning"
          : "passed";
    return {
      sourceId: target.sourceId,
      status,
      repeatCount: target.runIds.length,
      minScore,
      minReviewRounds,
      runs,
      blockingReasons,
      warnings
    };
  }

  private async evaluateRun(runId: string, minScore: number, minReviewRounds: number): Promise<CourseProductionBenchmarkRun> {
    const quality = await readJsonIfExists(this.qualityPath(runId));
    const review = await readJsonIfExists(this.reviewPath(runId));
    const imagegen = await readJsonIfExists(this.imagegenPath(runId));
    const layout = await readJsonIfExists(this.layoutPath(runId));
    const score = numericValue(quality, "score") ?? numericValue(quality, "qualityScore");
    const reviewRounds = reviewRoundCount(review);
    const reviewVerdict = stringValue(review, "latestVerdict") ?? stringValue(review, "finalVerdict");
    const imagegenTotalItems = imagegenTotalItemCount(imagegen);
    const imagegenCompletedItems = imagegenCompletedItemCount(imagegen);
    const layoutStatus = stringValue(layout, "status");
    const blockingReasons: string[] = [];

    if (score === null) {
      blockingReasons.push(`${runId} is missing course quality score.`);
    } else if (score < minScore) {
      blockingReasons.push(`${runId} quality score ${score} is below ${minScore}.`);
    }
    if (reviewRounds < minReviewRounds) {
      blockingReasons.push(`${runId} completed ${reviewRounds} content review rounds; expected at least ${minReviewRounds}.`);
    }
    if (reviewVerdict !== "pass") {
      blockingReasons.push(`${runId} latest content review verdict is ${reviewVerdict ?? "missing"}; expected pass.`);
    }
    if (imagegenTotalItems <= 0 || imagegenCompletedItems < imagegenTotalItems) {
      blockingReasons.push(`${runId} imagegen batch is incomplete: ${imagegenCompletedItems}/${imagegenTotalItems}.`);
    }
    if (layoutStatus !== "passed") {
      blockingReasons.push(`${runId} layout smoke status is ${layoutStatus ?? "missing"}; expected passed.`);
    }

    return {
      runId,
      status: blockingReasons.length > 0 ? "failed" : "passed",
      score,
      reviewRounds,
      reviewVerdict,
      imagegenCompletedItems,
      imagegenTotalItems,
      layoutStatus,
      blockingReasons,
      warnings: []
    };
  }

  private qualityPath(runId: string): string {
    return path.join(this.runRoot(runId), "quality", "course-quality-report.json");
  }

  private reviewPath(runId: string): string {
    return path.join(this.runRoot(runId), "quality", "content-review", "content-review-state.json");
  }

  private imagegenPath(runId: string): string {
    return path.join(this.runRoot(runId), "quality", "imagegen", "imagegen-batch-state.json");
  }

  private layoutPath(runId: string): string {
    return path.join(this.runRoot(runId), "quality", "layout-smoke", "layout-smoke-report.json");
  }

  private runRoot(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId);
  }
}

async function readJsonIfExists(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function numericValue(value: unknown, key: string): number | null {
  if (!isRecord(value)) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function stringValue(value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function reviewRoundCount(value: unknown): number {
  if (!isRecord(value)) {
    return 0;
  }
  const completedRounds = value.completedRounds;
  if (typeof completedRounds === "number" && Number.isInteger(completedRounds)) {
    return completedRounds;
  }
  const latestRound = value.latestRound;
  if (typeof latestRound === "number" && Number.isInteger(latestRound)) {
    return latestRound;
  }
  return Array.isArray(value.reports) ? value.reports.length : 0;
}

function imagegenTotalItemCount(value: unknown): number {
  if (!isRecord(value)) {
    return 0;
  }
  const totalItems = value.totalItems;
  if (typeof totalItems === "number" && Number.isInteger(totalItems)) {
    return totalItems;
  }
  return Array.isArray(value.items) ? value.items.length : 0;
}

function imagegenCompletedItemCount(value: unknown): number {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return 0;
  }
  return value.items.filter((item) => isRecord(item) && item.status === "succeeded").length;
}
