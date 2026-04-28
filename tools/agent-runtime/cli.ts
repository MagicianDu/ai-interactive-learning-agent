import {
  agentRuntimeVersion,
  AgentWorkflow,
  ApprovalService,
  ArtifactStore,
  CodexManualAdapter,
  createRunConfigFromArgs,
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
type CliCommand = "init" | "status" | "run" | "resume" | "submit" | "approve" | "revise" | "promote";

const commandAllowedFlags: Record<CliCommand, ReadonlySet<string>> = {
  init: new Set(["topic", "pages", "language", "adapter", "run"]),
  status: new Set(["run"]),
  run: new Set(["run"]),
  resume: new Set(["run"]),
  submit: new Set(["run", "artifact", "file"]),
  approve: new Set(["run", "gate", "version", "notes"]),
  revise: new Set(["run", "gate", "version", "notes"]),
  promote: new Set(["run"])
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
  return ["init", "status", "run", "resume", "submit", "approve", "revise", "promote"].includes(command);
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
  if (!options.topic) {
    throw new Error("--topic is required");
  }
  if (!options.pages) {
    throw new Error("--pages is required");
  }

  const runStore = new RunStore();
  const config = createRunConfigFromArgs(options as CliInitArgs);
  const runPath = await runStore.createRun(config);

  printJson({
    status: "initialized",
    runId: config.runId,
    topic: config.topic,
    outputLanguage: config.outputLanguage,
    pageCount: config.pageCount,
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
    outputLanguage: config.outputLanguage,
    pageCount: config.pageCount
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

function printHelp(): void {
  console.log(`AI Interactive Learning Agent runtime ${agentRuntimeVersion}`);
  console.log("Commands:");
  console.log("  help");
  console.log(
    "  init --topic <topic> --pages <count> [--language zh-CN] [--adapter mock|codex|claude|openclaw|codex-manual] [--run <id>]"
  );
  console.log("  status --run <id>");
  console.log("  run --run <id>");
  console.log("  resume --run <id>");
  console.log("  submit --run <id> --artifact <artifact-id> --file <json-file>");
  console.log("  approve --run <id> --gate <gate> [--version v1] [--notes text]");
  console.log("  revise --run <id> --gate <gate> [--version v1] --notes <text>");
  console.log("  promote --run <id>");
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

void main();
