import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";
import type { CliInitArgs, RunConfig } from "../types.js";
import { difficultyLabel } from "../learner/learner-project-service.js";
import { parseRunIntent, type RunIntent } from "./run-intent.js";

export type RunPlanStatus = "draft" | "approved" | "rejected";

export type RunPlan = {
  schemaVersion: 1;
  runId: string;
  status: RunPlanStatus;
  rawRequest: string;
  intent: RunIntent;
  initArgs: CliInitArgs;
  summary: string[];
  reviewItems: string[];
  createdAt: string;
  approvedAt?: string;
};

export type CreateRunPlanOptions = {
  runId?: string;
  adapter?: string;
  now?: Date;
};

export type InitializeRunFromPlanOptions = {
  approve?: boolean;
};

export type InitializeRunFromPlanResult = {
  status: "initialized";
  runId: string;
  runPath: string;
  config: RunConfig;
  planPath: string;
};

export class RunPlanService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  createPlan(request: string, options: CreateRunPlanOptions = {}): RunPlan {
    const intent = parseRunIntent(request);
    const plannedIntent: RunIntent = {
      ...intent,
      adapter: options.adapter ?? intent.adapter
    };
    const initArgs = toInitArgs(plannedIntent);
    const provisionalConfig = createRunConfigFromArgs({
      ...initArgs,
      run: options.runId
    });
    const runId = provisionalConfig.runId;
    const plannedInitArgs: CliInitArgs = {
      ...initArgs,
      run: runId
    };

    return {
      schemaVersion: 1,
      runId,
      status: "draft",
      rawRequest: plannedIntent.rawRequest,
      intent: plannedIntent,
      initArgs: plannedInitArgs,
      summary: buildSummary(plannedIntent, runId),
      reviewItems: buildReviewItems(plannedIntent),
      createdAt: (options.now || new Date()).toISOString()
    };
  }

  async writePlan(plan: RunPlan): Promise<string> {
    const planPath = this.getPlanPath(plan.runId);
    await mkdir(path.dirname(planPath), { recursive: true });
    await writeJson(planPath, plan);
    return planPath;
  }

  async readPlan(runId: string): Promise<RunPlan> {
    const rawPlan = await readFile(this.getPlanPath(runId), "utf8");
    return JSON.parse(rawPlan) as RunPlan;
  }

  async approvePlan(runId: string): Promise<RunPlan> {
    const plan = await this.readPlan(runId);
    const approvedPlan: RunPlan = {
      ...plan,
      status: "approved",
      approvedAt: new Date().toISOString()
    };
    await this.writePlan(approvedPlan);
    return approvedPlan;
  }

  async initializeRunFromPlan(
    runId: string,
    options: InitializeRunFromPlanOptions = {}
  ): Promise<InitializeRunFromPlanResult> {
    const plan = options.approve ? await this.approvePlan(runId) : await this.readPlan(runId);

    if (plan.status !== "approved") {
      throw new Error("run plan must be approved before initialization");
    }

    const config = createRunConfigFromArgs(plan.initArgs);
    if (config.runId !== plan.runId) {
      throw new Error(`run plan mismatch: initArgs run ${config.runId} does not match plan run ${plan.runId}`);
    }

    const runPath = await new RunStore(this.workspaceRoot).createRun(config);
    return {
      status: "initialized",
      runId: config.runId,
      runPath,
      config,
      planPath: this.getPlanPath(config.runId)
    };
  }

  getPlanPath(runId: string): string {
    return path.join(new RunStore(this.workspaceRoot).getRunPath(runId), "run.plan.json");
  }
}

function toInitArgs(intent: RunIntent): CliInitArgs {
  const initArgs: CliInitArgs = {
    unitPages: String(intent.unitPages),
    targetTotalPages: intent.targetTotalPages ? String(intent.targetTotalPages) : undefined,
    sourceKind: intent.source.kind,
    planningMode: intent.planningMode,
    strategy: intent.strategy,
    audience: intent.audience,
    difficultyLevel: intent.difficultyLevel,
    language: intent.language,
    adapter: intent.adapter
  };

  if (intent.source.type === "topic") {
    initArgs.topic = intent.source.value;
  } else if (intent.source.type === "file") {
    initArgs.sourceFile = intent.source.value;
    initArgs.sourceTitle = intent.source.title;
  } else if (intent.source.type === "folder") {
    initArgs.sourceFolder = intent.source.value;
    initArgs.sourceTitle = intent.source.title;
  } else if (intent.source.type === "url") {
    initArgs.sourceUrl = intent.source.value;
  } else {
    initArgs.sourceText = intent.source.value;
    initArgs.sourceTitle = intent.source.title;
  }

  return initArgs;
}

function buildSummary(intent: RunIntent, runId: string): string[] {
  return [
    `runId=${runId}`,
    `source=${intent.source.type}:${intent.source.value}`,
    `sourceKind=${intent.source.kind}`,
    `strategy=${intent.strategy}`,
    `planningMode=${intent.planningMode}`,
    `unitPages=${intent.unitPages}`,
    intent.targetTotalPages ? `targetTotalPages=${intent.targetTotalPages}` : "targetTotalPages=unspecified",
    intent.difficultyLevel ? `difficultyLevel=${intent.difficultyLevel}` : "difficultyLevel=unspecified",
    `language=${intent.language}`,
    `adapter=${intent.adapter}`
  ];
}

function buildReviewItems(intent: RunIntent): string[] {
  return [
    `确认 sourceKind=${intent.source.kind} 是否符合输入资料。`,
    `确认每个学习单元 ${intent.unitPages} 页是否符合学习节奏。`,
    intent.targetTotalPages
      ? `确认整套课程总页数约 ${intent.targetTotalPages} 页是否符合学习目标。`
      : "确认是否需要指定整套课程总页数；未指定时会按课程形态使用默认建议。",
    intent.difficultyLevel
      ? `确认 teaching difficulty=${difficultyLabel(intent.difficultyLevel)} 是否符合学习目标。`
      : "确认教学难度层级：入门衔接、本科核心课程、大学高年级/研究生课程，或研究论文精读/前沿讨论。",
    `确认 strategy=${intent.strategy} 与 planningMode=${intent.planningMode} 是否符合课程组织方式。`,
    "确认 audience 是否足够具体，后续课程会按该学习者画像生成中文内容。"
  ];
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
