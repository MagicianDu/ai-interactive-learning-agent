import {
  agentRuntimeVersion,
  AgentWorkflow,
  ApprovalService,
  ArtifactStore,
  CodexManualAdapter,
  createRunConfigFromArgs,
  CoursePackService,
  LessonPromotionService,
  ManualSubmissionService,
  MockRuntimeAdapter,
  RunStore
} from "./index.js";
import type { ArtifactVersion } from "./artifact-store.js";
import type { ApprovalGateId, CliInitArgs } from "./types.js";

const gateToArtifact: Record<ApprovalGateId, string> = {
  "source-map": "source-map",
  "concept-map": "concept-map",
  "curriculum-plan": "curriculum-plan",
  "learning-architecture": "learning-architecture",
  lesson: "lesson",
  "critic-report": "critic-report",
  "publish-package": "publish-package"
};

type CliOptions = Record<string, string | undefined>;
type CliCommand =
  | "init"
  | "status"
  | "run"
  | "resume"
  | "submit"
  | "approve"
  | "revise"
  | "promote"
  | "units"
  | "select-unit"
  | "spawn-units"
  | "run-units"
  | "promote-units"
  | "course";

const commandAllowedFlags: Record<CliCommand, ReadonlySet<string>> = {
  init: new Set([
    "topic",
    "pages",
    "unit-pages",
    "source-file",
    "source-folder",
    "source-url",
    "source-text",
    "source-kind",
    "source-title",
    "planning-mode",
    "strategy",
    "units",
    "chapters",
    "topics",
    "audience",
    "language",
    "adapter",
    "run"
  ]),
  status: new Set(["run"]),
  run: new Set(["run"]),
  resume: new Set(["run"]),
  submit: new Set(["run", "artifact", "file"]),
  approve: new Set(["run", "gate", "version", "notes"]),
  revise: new Set(["run", "gate", "version", "notes"]),
  promote: new Set(["run"]),
  units: new Set(["run"]),
  "select-unit": new Set(["run", "unit"]),
  "spawn-units": new Set(["run", "unit", "all"]),
  "run-units": new Set(["run", "unit", "all", "max-steps"]),
  "promote-units": new Set(["run", "unit", "all"]),
  course: new Set(["run", "unit", "all", "max-steps", "promote"])
};

async function main(): Promise<void> {
  const [rawCommand, ...rawArgs] = process.argv.slice(2);
  const command = normalizeCommand(rawCommand);

  if (command === "help") {
    printHelp();
    return;
  }

  if (!isSupportedCommand(command)) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  try {
    const options = parseOptions(rawArgs, commandAllowedFlags[command]);

    if (command === "init") {
      await initRun(options);
      return;
    }

    if (command === "status") {
      await printStatus(options);
      return;
    }

    if (command === "run" || command === "resume") {
      await runNext(options);
      return;
    }

    if (command === "submit") {
      await submitManualArtifact(options);
      return;
    }

    if (command === "approve" || command === "revise") {
      await decideApproval(command, options);
      return;
    }

    if (command === "promote") {
      await promoteLesson(options);
      return;
    }

    if (command === "units") {
      await listUnits(options);
      return;
    }

    if (command === "select-unit") {
      await selectUnit(options);
      return;
    }

    if (command === "spawn-units") {
      await spawnUnitRuns(options);
      return;
    }

    if (command === "run-units") {
      await runUnitRuns(options);
      return;
    }

    if (command === "promote-units") {
      await promoteUnitRuns(options);
      return;
    }

    if (command === "course") {
      await orchestrateCourse(options);
      return;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function normalizeCommand(command: string | undefined): string {
  if (!command || command === "--help" || command === "-h") {
    return "help";
  }
  return command;
}

function isSupportedCommand(command: string): command is CliCommand {
  return [
    "init",
    "status",
    "run",
    "resume",
    "submit",
    "approve",
    "revise",
    "promote",
    "units",
    "select-unit",
    "spawn-units",
    "run-units",
    "promote-units",
    "course"
  ].includes(command);
}

function parseOptions(args: string[], allowedFlags: ReadonlySet<string>): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (!key) {
      throw new Error("Empty option name is not allowed");
    }
    if (!allowedFlags.has(key)) {
      throw new Error(`Unknown option --${key}`);
    }
    if (Object.hasOwn(options, key)) {
      throw new Error(`Duplicate option --${key}`);
    }

    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

async function initRun(options: CliOptions): Promise<void> {
  const runStore = new RunStore();
  const config = createRunConfigFromArgs(toInitArgs(options));
  const runPath = await runStore.createRun(config);

  printJson({
    status: "initialized",
    runId: config.runId,
    topic: config.topic,
    sourceKind: config.sourceKind,
    outputLanguage: config.outputLanguage,
    pageCount: config.pageCount,
    coursePack: config.coursePack,
    runPath
  });
}

async function printStatus(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const runStore = new RunStore();
  const config = await runStore.readConfig(runId);

  printJson({
    runId: config.runId,
    topic: config.topic,
    sourceKind: config.sourceKind,
    outputLanguage: config.outputLanguage,
    pageCount: config.pageCount,
    coursePack: config.coursePack
  });
}

async function runNext(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const workflow = await createWorkflow(runId);
  const result = await workflow.runNext(runId);

  printJson(result);
}

async function submitManualArtifact(options: CliOptions): Promise<void> {
  const service = new ManualSubmissionService();
  const result = await service.submit({
    runId: requireOption(options, "run"),
    artifactId: requireOption(options, "artifact"),
    filePath: requireOption(options, "file")
  });

  printJson(result);
}

async function decideApproval(command: "approve" | "revise", options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const gate = requireGate(options);
  const version = toArtifactVersion(options.version ?? "v1");

  if (command === "revise" && !options.notes) {
    throw new Error("--notes is required for revise");
  }

  const runStore = new RunStore();
  const runPath = runStore.getRunPath(runId);
  const artifactStore = new ArtifactStore(runPath);
  const approvalService = new ApprovalService(runPath, artifactStore);
  const record = await approvalService.approve({
    gate,
    runId,
    artifactId: gateToArtifact[gate],
    version,
    decision: command === "approve" ? "approved" : "revision_requested",
    operatorNotes: options.notes ?? ""
  });

  printJson(record);
}

async function promoteLesson(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const service = new LessonPromotionService();
  const result = await service.promote(runId);

  printJson({
    status: "promoted",
    ...result
  });
}

async function listUnits(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const service = new CoursePackService();
  const units = await service.listUnits(runId);

  printJson({
    runId,
    units
  });
}

async function selectUnit(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const unitId = requireOption(options, "unit");
  const service = new CoursePackService();
  const result = await service.selectUnit(runId, unitId);

  printJson(result);
}

async function spawnUnitRuns(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const selector = options.all === "true" ? "all" : requireOption(options, "unit");
  const service = new CoursePackService();
  const result = await service.spawnUnitRuns(runId, selector);

  printJson(result);
}

async function runUnitRuns(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const selector = options.all === "true" ? "all" : requireOption(options, "unit");
  const maxSteps = Number(options["max-steps"] ?? "20");
  const service = new CoursePackService();
  const result = await service.runUnitRuns(runId, selector, maxSteps);

  printJson(result);
}

async function promoteUnitRuns(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const selector = options.all === "true" ? "all" : requireOption(options, "unit");
  const service = new CoursePackService();
  const result = await service.promoteUnitRuns(runId, selector);

  printJson(result);
}

async function orchestrateCourse(options: CliOptions): Promise<void> {
  const runId = requireOption(options, "run");
  const selector = options.all === "true" ? "all" : options.unit?.trim() || "all";
  const maxSteps = Number(options["max-steps"] ?? "20");
  const promote = options.promote === "true";
  const service = new CoursePackService();
  const result = await service.orchestrateCourse({
    runId,
    unitSelector: selector,
    maxSteps,
    promote
  });

  printJson(result);
}

async function createWorkflow(runId: string): Promise<AgentWorkflow> {
  const runStore = new RunStore();
  const runPath = runStore.getRunPath(runId);
  const artifactStore = new ArtifactStore(runPath);
  const approvalService = new ApprovalService(runPath, artifactStore);
  const config = await runStore.readConfig(runId);
  const adapter = config.runtime.adapter === "codex-manual" ? new CodexManualAdapter() : new MockRuntimeAdapter();

  return new AgentWorkflow(runStore, artifactStore, approvalService, adapter);
}

function requireOption(options: CliOptions, key: string): string {
  const value = options[key]?.trim();
  if (!value) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

function requireGate(options: CliOptions): ApprovalGateId {
  const gate = requireOption(options, "gate");
  if (!Object.hasOwn(gateToArtifact, gate)) {
    throw new Error(`--gate must be one of ${Object.keys(gateToArtifact).join(", ")}`);
  }
  return gate as ApprovalGateId;
}

function toArtifactVersion(version: string): ArtifactVersion {
  if (!/^v[1-9][0-9]*$/.test(version)) {
    throw new Error("--version must match /^v[1-9][0-9]*$/");
  }
  return version as ArtifactVersion;
}

function toInitArgs(options: CliOptions): CliInitArgs {
  return {
    topic: options.topic,
    pages: options.pages,
    unitPages: options["unit-pages"],
    sourceFile: options["source-file"],
    sourceFolder: options["source-folder"],
    sourceUrl: options["source-url"],
    sourceText: options["source-text"],
    sourceKind: options["source-kind"],
    sourceTitle: options["source-title"],
    planningMode: options["planning-mode"],
    strategy: options.strategy,
    units: options.units,
    chapters: options.chapters,
    topics: options.topics,
    audience: options.audience,
    language: options.language,
    adapter: options.adapter,
    run: options.run
  };
}

function printHelp(): void {
  console.log(`AI Interactive Learning Agent runtime ${agentRuntimeVersion}`);
  console.log("Commands:");
  console.log("  help");
  console.log(
    "  init [--topic <topic>] [--source-file <path>|--source-folder <path>|--source-url <url>|--source-text <text>] [--source-kind book|paper|patent|blog|documentation|notes|course|unknown] [--unit-pages <count>] [--strategy overview_plus_topic|chapter_guided|topic_guided|task_guided|hybrid] [--planning-mode chapter_guided|topic_guided|task_guided|hybrid] [--language zh-CN] [--adapter mock|codex|claude|openclaw|codex-manual] [--run <id>]"
  );
  console.log("  status --run <id>");
  console.log("  run --run <id>");
  console.log("  resume --run <id>");
  console.log("  submit --run <id> --artifact <artifact-id> --file <json-file>");
  console.log("  approve --run <id> --gate <gate> [--version v1] [--notes text]");
  console.log("  revise --run <id> --gate <gate> [--version v1] --notes <text>");
  console.log("  promote --run <id>");
  console.log("  units --run <id>");
  console.log("  select-unit --run <id> --unit <unit-id>");
  console.log("  spawn-units --run <id> (--unit <unit-id>|--all true)");
  console.log("  run-units --run <id> (--unit <unit-id>|--all true) [--max-steps 20]");
  console.log("  promote-units --run <id> (--unit <unit-id>|--all true)");
  console.log("  course --run <id> [--unit <unit-id>|--all true] [--max-steps 20] [--promote true]");
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

void main();
