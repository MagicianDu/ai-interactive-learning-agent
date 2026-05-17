import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";

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
    return {
      status: "action_required",
      runId: state.runId,
      stage: state.stage,
      statePath: this.statePath(state.runId),
      nextAction: authorCourseBundleAction(state)
    };
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

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}
