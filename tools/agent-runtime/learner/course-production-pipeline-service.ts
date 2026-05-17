import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";
import { ContentReviewLoopService } from "./content-review-loop-service.js";
import { type ImagegenBatchItem, ImagegenBatchStateService } from "./imagegen-batch-state-service.js";
import type { PreviewLayoutSmokeIssue } from "./preview-layout-smoke-service.js";

export type CourseProductionStage =
  | "needs_authoring"
  | "content_review"
  | "needs_content_revision"
  | "imagegen_batch"
  | "needs_imagegen_retry"
  | "layout_smoke"
  | "needs_layout_fix"
  | "preview_ready";

export type CourseProductionDefaults = {
  difficulty: "beginner" | "undergraduate" | "graduate" | "expert";
  strategy: "overview_plus_topic" | "chapter_guided" | "topic_guided";
  overviewPages: number;
  topicPages: number;
  topicCount: number;
  reviewRounds: number;
  minQualityScore: number;
};

export type StartCourseProductionInput = {
  runId: string;
  sourceKind: "book" | "paper" | "patent" | "blog" | "notes" | "topic";
  learnerRequest: string;
  targetMode: "student_self_study_textbook" | "professor_web_deck";
  defaults: CourseProductionDefaults;
};

export type CourseProductionNextAction =
  | {
      kind: "author_course_bundle";
      audienceFacingMessage: string;
      codexInstruction: string;
    }
  | {
      kind: "run_content_review";
      reviewRound: number;
      briefPath: string;
      codexInstruction: string;
    }
  | {
      kind: "revise_from_content_review";
      reviewRound: number;
      requiredFixes: string[];
      codexInstruction: string;
    }
  | {
      kind: "generate_imagegen_assets";
      manifestPath: string;
      pendingItems: ImagegenBatchItem[];
      codexInstruction: string;
    }
  | {
      kind: "fix_imagegen_assets";
      manifestPath: string;
      pendingItems: ImagegenBatchItem[];
      failedItems: ImagegenBatchItem[];
      codexInstruction: string;
    }
  | {
      kind: "run_layout_smoke";
      command: string;
      codexInstruction: string;
    }
  | {
      kind: "fix_layout";
      reportPath: string;
      issues: PreviewLayoutSmokeIssue[];
      codexInstruction: string;
    }
  | {
      kind: "handoff_preview";
      previewUrl: string;
      qualitySummary: string;
      evidencePaths: string[];
    };

export type CourseProductionEvent = {
  eventKind: string;
  summary: string;
  artifactPaths: string[];
  createdAt: string;
};

export type RecordCourseProductionEventInput = {
  runId: string;
  eventKind: string;
  summary: string;
  artifactPaths: string[];
};

export type CourseProductionState = StartCourseProductionInput & {
  stage: CourseProductionStage;
  events: CourseProductionEvent[];
};

export type CourseProductionActionResult = {
  status: "production_started" | "action_required" | "preview_ready";
  runId: string;
  stage: CourseProductionStage;
  nextAction: CourseProductionNextAction;
  statePath: string;
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

export class CourseProductionPipelineService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async start(input: StartCourseProductionInput): Promise<CourseProductionActionResult> {
    assertSafeRunId(input.runId);
    const state: CourseProductionState = {
      ...input,
      stage: "needs_authoring",
      events: []
    };
    await this.writeState(state);
    return {
      status: "production_started",
      runId: input.runId,
      stage: state.stage,
      statePath: this.statePath(input.runId),
      nextAction: authorCourseBundleAction(input)
    };
  }

  async nextAction(input: { runId: string }): Promise<CourseProductionActionResult> {
    assertSafeRunId(input.runId);
    const state = await this.readState(input.runId);
    if (state.stage === "preview_ready") {
      return {
        status: "preview_ready",
        runId: state.runId,
        stage: state.stage,
        statePath: this.statePath(state.runId),
        nextAction: {
          kind: "handoff_preview",
          previewUrl: `http://127.0.0.1:5173/#/preview/${state.runId}`,
          qualitySummary: "课程生产流水线已完成。",
          evidencePaths: [
            `runs/${state.runId}/quality/course-quality-report.json`,
            `runs/${state.runId}/quality/imagegen/imagegen-prompt-manifest.json`,
            `runs/${state.runId}/quality/layout-smoke/layout-smoke-report.json`
          ]
        }
      };
    }
    if (hasEvent(state, "course_published")) {
      const review = await new ContentReviewLoopService(this.workspaceRoot).evaluate({
        runId: state.runId,
        maxRounds: state.defaults.reviewRounds,
        minQualityScore: state.defaults.minQualityScore
      });
      if (review.status === "review_required") {
        return {
          status: "action_required",
          runId: state.runId,
          stage: "content_review",
          statePath: this.statePath(state.runId),
          nextAction: {
            kind: "run_content_review",
            reviewRound: review.nextReviewRound,
            briefPath: `runs/${state.runId}/quality/content-review/round-${String(review.nextReviewRound).padStart(3, "0")}-content-review.json`,
            codexInstruction: review.codexInstruction
          }
        };
      }
      if (review.status === "revision_required") {
        return {
          status: "action_required",
          runId: state.runId,
          stage: "needs_content_revision",
          statePath: this.statePath(state.runId),
          nextAction: {
            kind: "revise_from_content_review",
            reviewRound: state.defaults.reviewRounds,
            requiredFixes: [review.blockingReason],
            codexInstruction: review.codexInstruction
          }
        };
      }
      const batch = await new ImagegenBatchStateService(this.workspaceRoot).readOrStart({ runId: state.runId });
      if (batch.status !== "batch_complete") {
        return {
          status: "action_required",
          runId: state.runId,
          stage: batch.failedItems.length > 0 ? "needs_imagegen_retry" : "imagegen_batch",
          statePath: this.statePath(state.runId),
          nextAction:
            batch.failedItems.length > 0
              ? {
                  kind: "fix_imagegen_assets",
                  manifestPath: `runs/${state.runId}/quality/imagegen/imagegen-prompt-manifest.json`,
                  pendingItems: batch.pendingItems,
                  failedItems: batch.failedItems,
                  codexInstruction: [
                    "Regenerate failed imagegen items, then validate assets again.",
                    ...batch.executionChecklist,
                    `Failed item summary: ${batch.retrySummary.reasons.join("; ") || "none"}.`
                  ].join("\n")
                }
              : {
                  kind: "generate_imagegen_assets",
                  manifestPath: `runs/${state.runId}/quality/imagegen/imagegen-prompt-manifest.json`,
                  pendingItems: batch.pendingItems,
                  codexInstruction: [
                    "Generate one independent imagegen teaching illustration for each pending item.",
                    ...batch.executionChecklist
                  ].join("\n")
          }
        };
      }
      const layout = await this.readLayoutSmokeReport(state.runId);
      if (!layout) {
        return {
          status: "action_required",
          runId: state.runId,
          stage: "layout_smoke",
          statePath: this.statePath(state.runId),
          nextAction: {
            kind: "run_layout_smoke",
            command: `npm run smoke:layout -- --runId ${state.runId} --desktop-only`,
            codexInstruction: "Run the layout smoke command. If it fails, fix page layout or content density before showing the preview."
          }
        };
      }
      if (layout.status !== "passed") {
        return {
          status: "action_required",
          runId: state.runId,
          stage: "needs_layout_fix",
          statePath: this.statePath(state.runId),
          nextAction: {
            kind: "fix_layout",
            reportPath: `runs/${state.runId}/quality/layout-smoke/layout-smoke-report.json`,
            issues: layout.issues,
            codexInstruction: "Fix every layout smoke issue, republish if needed, then rerun layout smoke."
          }
        };
      }
      return {
        status: "preview_ready",
        runId: state.runId,
        stage: "preview_ready",
        statePath: this.statePath(state.runId),
        nextAction: {
          kind: "handoff_preview",
          previewUrl: `http://127.0.0.1:5173/#/preview/${state.runId}`,
          qualitySummary: "内容审核、imagegen 资产校验和 layout smoke 均已通过。",
          evidencePaths: [
            `runs/${state.runId}/quality/content-review/content-review-state.json`,
            `runs/${state.runId}/quality/imagegen/imagegen-batch-state.json`,
            `runs/${state.runId}/quality/layout-smoke/layout-smoke-report.json`
          ]
        }
      };
    }
    return {
      status: "action_required",
      runId: state.runId,
      stage: state.stage,
      statePath: this.statePath(state.runId),
      nextAction: authorCourseBundleAction(state)
    };
  }

  async recordEvent(input: RecordCourseProductionEventInput): Promise<CourseProductionState> {
    assertSafeRunId(input.runId);
    const state = await this.readState(input.runId);
    state.events.push({
      eventKind: input.eventKind,
      summary: input.summary,
      artifactPaths: input.artifactPaths,
      createdAt: new Date().toISOString()
    });
    if (input.eventKind === "course_published") {
      state.stage = "content_review";
    }
    await this.writeState(state);
    return state;
  }

  private async readState(runId: string): Promise<CourseProductionState> {
    return JSON.parse(await readFile(this.statePath(runId), "utf8")) as CourseProductionState;
  }

  private async writeState(state: CourseProductionState): Promise<void> {
    const filePath = this.statePath(state.runId);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private statePath(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId, "quality", "production-pipeline", "pipeline-state.json");
  }

  private async readLayoutSmokeReport(runId: string): Promise<{ status: string; issues: PreviewLayoutSmokeIssue[] } | undefined> {
    try {
      const parsed = JSON.parse(
        await readFile(path.join(this.workspaceRoot, "runs", runId, "quality", "layout-smoke", "layout-smoke-report.json"), "utf8")
      ) as unknown;
      if (!isRecord(parsed)) {
        return undefined;
      }
      return {
        status: typeof parsed.status === "string" ? parsed.status : "",
        issues: Array.isArray(parsed.issues) ? (parsed.issues as PreviewLayoutSmokeIssue[]) : []
      };
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }
}

function authorCourseBundleAction(input: Pick<StartCourseProductionInput, "defaults" | "learnerRequest">): CourseProductionNextAction {
  return {
    kind: "author_course_bundle",
    audienceFacingMessage: `我会按${difficultyLabel(input.defaults.difficulty)}难度生成课程，策略为 ${input.defaults.strategy}，默认总览 ${input.defaults.overviewPages} 页，每个 topic ${input.defaults.topicPages} 页。`,
    codexInstruction:
      `Create and publish the initial course bundle from the learner request: ${input.learnerRequest}\n` +
      `Use defaults: ${JSON.stringify(input.defaults)}.\n` +
      "Do not show internal artifacts to the learner. Publish the course bundle, then call learning_agent.record_course_production_event with eventKind=course_published."
  };
}

function difficultyLabel(value: CourseProductionDefaults["difficulty"]): string {
  if (value === "graduate") {
    return "研究生";
  }
  if (value === "undergraduate") {
    return "大学";
  }
  if (value === "expert") {
    return "专家";
  }
  return "入门";
}

function hasEvent(state: CourseProductionState, eventKind: string): boolean {
  return state.events.some((event) => event.eventKind === eventKind);
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}
