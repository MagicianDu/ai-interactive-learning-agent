import { readFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";

export type EvaluateContentReviewLoopInput = {
  runId: string;
  maxRounds: number;
  minQualityScore: number;
};

export type ContentReviewLoopResult =
  | {
      status: "review_required";
      nextReviewRound: number;
      codexInstruction: string;
    }
  | {
      status: "revision_required";
      blockingReason: "review_reports_not_concrete" | "quality_score_below_threshold" | "review_verdict_not_pass";
      codexInstruction: string;
    }
  | {
      status: "ready_for_imagegen";
      completedRounds: number;
      latestScore: number;
    };

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

export class ContentReviewLoopService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async evaluate(input: EvaluateContentReviewLoopInput): Promise<ContentReviewLoopResult> {
    assertSafeRunId(input.runId);
    const state = await readJsonIfExists(this.reviewStatePath(input.runId));
    if (!isRecord(state)) {
      return {
        status: "review_required",
        nextReviewRound: 1,
        codexInstruction:
          "Act as content-review-agent. Read the content review brief, critique the course first, revise the course second, then record a concrete review report."
      };
    }
    const completedRounds = numberValue(state.completedRounds);
    const latestScore = numberValue(state.latestScore);
    const latestVerdict = stringValue(state.latestVerdict);
    const reports = Array.isArray(state.reports) ? state.reports : [];
    if (completedRounds < input.maxRounds) {
      return {
        status: "review_required",
        nextReviewRound: completedRounds + 1,
        codexInstruction: `Continue content review round ${completedRounds + 1}. Revise concrete weak pages and record measurable deltas before imagegen.`
      };
    }
    if (latestVerdict !== "pass") {
      return {
        status: "revision_required",
        blockingReason: "review_verdict_not_pass",
        codexInstruction: "Reviewer verdict is not pass. Revise the course and record another concrete review report."
      };
    }
    if (latestScore < input.minQualityScore) {
      return {
        status: "revision_required",
        blockingReason: "quality_score_below_threshold",
        codexInstruction: `Quality score ${latestScore} is below ${input.minQualityScore}. Revise before imagegen.`
      };
    }
    const concreteReports = reports.filter((report) => isRecord(report) && numberValue(report.concreteIssueCount) > 0).length;
    if (concreteReports < input.maxRounds) {
      return {
        status: "revision_required",
        blockingReason: "review_reports_not_concrete",
        codexInstruction:
          "All review rounds must include concrete page-level issues or explicit evidence-backed pass reasons. Vague pass reports cannot unlock imagegen."
      };
    }
    return {
      status: "ready_for_imagegen",
      completedRounds,
      latestScore
    };
  }

  private reviewStatePath(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId, "quality", "content-review", "content-review-state.json");
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

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}
