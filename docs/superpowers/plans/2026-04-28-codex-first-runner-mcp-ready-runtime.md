# Codex-First Runner MCP-Ready Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Codex-usable local lesson generation runner with durable run state, artifact versioning, approvals, resume, and lesson promotion, while keeping the runtime core reusable for a future MCP server.

**Architecture:** Add a `tools/agent-runtime/` TypeScript runtime core with CLI wrappers. CLI commands call reusable services (`RunStore`, `ArtifactStore`, `ApprovalService`, `AgentWorkflow`, `LessonPromotionService`) so a future MCP server can wrap the same core. The first adapter is deterministic `mock`, with interfaces ready for later model-backed adapters.

**Tech Stack:** TypeScript, Node.js ESM, `tsx` for local CLI execution, Vitest for runtime tests, existing React/Vite Web Deck for promoted lesson preview.

---

## Scope Notes

This plan implements the first usable Codex path:

```text
Codex Skill -> npm scripts -> tools/agent-runtime core -> runs/<run-id>/ -> promoted Web Deck lesson
```

This plan does not implement a production MCP server. It keeps MCP as the target by forcing CLI code through reusable runtime services.

Current directory is not a git repository. Each task includes a version-control checkpoint command that should be run if `.git/` exists. If the repository is still not initialized, record "not a git repository" in the task notes and continue.

## File Structure

Create:

```text
tools/
  agent-runtime/
    cli.ts
    index.ts
    types.ts
    errors.ts
    run-config.ts
    run-store.ts
    artifact-store.ts
    approval-service.ts
    adapters/
      mock-adapter.ts
    workflow/
      role-sequence.ts
      agent-workflow.ts
    promotion/
      lesson-promotion-service.ts
    __tests__/
      run-config.test.ts
      stores.test.ts
      approval-service.test.ts
      agent-workflow.test.ts
      promotion.test.ts
tsconfig.agent.json
skills/
  learning-agent-runner/
    SKILL.md
```

Modify:

```text
package.json
tsconfig.json
README.md
docs/runtime/run-config.schema.md
```

Do not move existing React renderer files in this implementation phase.

---

### Task 1: Agent Runtime Tooling

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `tsconfig.agent.json`
- Create: `tools/agent-runtime/index.ts`
- Create: `tools/agent-runtime/cli.ts`

- [ ] **Step 1: Add CLI dependencies**

Run:

```bash
npm install -D tsx @types/node
```

Expected: `package.json` and `package-lock.json` include `tsx` and `@types/node`.

- [ ] **Step 2: Add runtime scripts**

Modify `package.json` scripts to include:

```json
{
  "agent": "tsx tools/agent-runtime/cli.ts",
  "agent:init": "tsx tools/agent-runtime/cli.ts init",
  "agent:status": "tsx tools/agent-runtime/cli.ts status",
  "agent:run": "tsx tools/agent-runtime/cli.ts run",
  "agent:approve": "tsx tools/agent-runtime/cli.ts approve",
  "agent:revise": "tsx tools/agent-runtime/cli.ts revise",
  "agent:resume": "tsx tools/agent-runtime/cli.ts resume",
  "agent:promote": "tsx tools/agent-runtime/cli.ts promote"
}
```

Keep all existing scripts.

- [ ] **Step 3: Add agent TypeScript config**

Create `tsconfig.agent.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"],
    "tsBuildInfoFile": "./node_modules/.cache/tsconfig.agent.tsbuildinfo"
  },
  "include": ["tools/agent-runtime/**/*.ts"]
}
```

Modify root `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.agent.json" }
  ]
}
```

- [ ] **Step 4: Create CLI stub that compiles**

Create `tools/agent-runtime/index.ts`:

```ts
export const agentRuntimeVersion = "0.1.0";
```

Create `tools/agent-runtime/cli.ts`:

```ts
import { agentRuntimeVersion } from "./index.js";

const command = process.argv[2] ?? "help";

if (command === "help" || command === "--help" || command === "-h") {
  console.log(`AI Interactive Learning Agent runtime ${agentRuntimeVersion}`);
  console.log("Commands: init, status, run, approve, revise, resume, promote");
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
process.exit(1);
```

- [ ] **Step 5: Verify tooling**

Run:

```bash
npm run typecheck
npm run agent -- --help
```

Expected:

```text
typecheck exits 0
AI Interactive Learning Agent runtime 0.1.0
Commands: init, status, run, approve, revise, resume, promote
```

- [ ] **Step 6: Version-control checkpoint**

Run:

```bash
git status --short
```

Expected if git is not initialized:

```text
fatal: not a git repository (or any of the parent directories): .git
```

If git exists, commit:

```bash
git add package.json package-lock.json tsconfig.json tsconfig.agent.json tools/agent-runtime/index.ts tools/agent-runtime/cli.ts
git commit -m "chore: add agent runtime tooling"
```

---

### Task 2: Run Config Types And Validation

**Files:**
- Create: `tools/agent-runtime/types.ts`
- Create: `tools/agent-runtime/errors.ts`
- Create: `tools/agent-runtime/run-config.ts`
- Create: `tools/agent-runtime/__tests__/run-config.test.ts`

- [ ] **Step 1: Write failing tests for defaults and validation**

Create `tools/agent-runtime/__tests__/run-config.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createRunConfigFromArgs, validateRunConfig } from "../run-config.js";

describe("run config", () => {
  test("creates a Chinese-first run config from CLI args", () => {
    const config = createRunConfigFromArgs({
      topic: "哈希表",
      pages: "8",
      language: undefined,
      adapter: undefined,
      run: undefined
    });

    expect(config.runId).toBe("hash-table-001");
    expect(config.topic).toBe("哈希表");
    expect(config.outputLanguage).toBe("zh-CN");
    expect(config.pageCount).toEqual({ target: 8, min: 6, max: 10 });
    expect(config.runtime.adapter).toBe("mock");
  });

  test("rejects invalid page count", () => {
    expect(() =>
      createRunConfigFromArgs({
        topic: "哈希表",
        pages: "0",
        language: "zh-CN",
        adapter: "mock",
        run: undefined
      })
    ).toThrow(/pages must be between 1 and 40/);
  });

  test("validates required run config fields", () => {
    expect(() =>
      validateRunConfig({
        runId: "bad",
        topic: "",
        source: { type: "topic", value: "x" },
        audience: "learners",
        outputLanguage: "zh-CN",
        targetOutput: "web_deck",
        pageCount: { target: 8, min: 6, max: 10 },
        runtime: { adapter: "mock", mode: "interactive" },
        models: { defaultModel: { provider: "mock", model: "mock", temperature: 0.2 } },
        modelFallbackPolicy: "require_approval",
        approvalGates: ["learning-architecture", "lesson", "critic-report", "publish-package"]
      })
    ).toThrow(/topic is required/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/run-config.test.ts
```

Expected: FAIL because `../run-config.js` does not exist.

- [ ] **Step 3: Define runtime types**

Create `tools/agent-runtime/types.ts`:

```ts
export type SourceConfig =
  | { type: "topic" | "text" | "file" | "url"; value: string; label?: string; notes?: string }
  | {
      type: "mixed";
      items: Array<{ type: "topic" | "text" | "file" | "url"; value: string; label?: string; notes?: string }>;
      notes?: string;
    };

export type RuntimeAdapterId = "mock" | "codex-manual" | "openai" | "anthropic" | "gemini" | "custom";

export type RunConfig = {
  runId: string;
  topic: string;
  source: SourceConfig;
  audience: string;
  outputLanguage: string;
  targetOutput: "web_deck" | "canvas_map" | "playground" | "ai_tutor" | "teacher_mode" | "assessment_mode" | "package";
  pageCount: {
    target: number;
    min: number;
    max: number;
  };
  runtime: {
    adapter: RuntimeAdapterId;
    mode: "interactive" | "supervised" | "batch";
  };
  models: {
    defaultModel: {
      provider: string;
      model: string;
      reasoningEffort?: "low" | "medium" | "high" | "xhigh";
      temperature?: number;
    };
    roleModels?: Record<string, { provider: string; model: string; reasoningEffort?: string; temperature?: number }>;
  };
  modelFallbackPolicy: "require_approval" | "use_default" | "fail";
  approvalGates: ApprovalGateId[];
};

export type ApprovalGateId = "learning-architecture" | "lesson" | "critic-report" | "publish-package";

export type CliInitArgs = {
  topic?: string;
  pages?: string;
  language?: string;
  adapter?: string;
  run?: string;
};
```

- [ ] **Step 4: Define structured error**

Create `tools/agent-runtime/errors.ts`:

```ts
export class AgentRuntimeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_RUN_CONFIG"
      | "MISSING_RUN"
      | "MISSING_ARTIFACT"
      | "APPROVAL_REQUIRED"
      | "VERSION_CONFLICT"
      | "UNSUPPORTED_ADAPTER"
      | "PROMOTION_CONFLICT"
      | "INVALID_LESSON"
  ) {
    super(message);
    this.name = "AgentRuntimeError";
  }
}
```

- [ ] **Step 5: Implement config creation and validation**

Create `tools/agent-runtime/run-config.ts`:

```ts
import { AgentRuntimeError } from "./errors.js";
import type { ApprovalGateId, CliInitArgs, RunConfig, RuntimeAdapterId } from "./types.js";

const defaultApprovalGates: ApprovalGateId[] = [
  "learning-architecture",
  "lesson",
  "critic-report",
  "publish-package"
];

const topicSlugMap: Record<string, string> = {
  哈希表: "hash-table",
  数据库索引: "database-index"
};

export function createRunConfigFromArgs(args: CliInitArgs): RunConfig {
  const topic = args.topic?.trim();
  if (!topic) {
    throw new AgentRuntimeError("topic is required", "INVALID_RUN_CONFIG");
  }

  const targetPages = Number(args.pages ?? "10");
  if (!Number.isInteger(targetPages) || targetPages < 1 || targetPages > 40) {
    throw new AgentRuntimeError("pages must be between 1 and 40", "INVALID_RUN_CONFIG");
  }

  const runId = args.run?.trim() || `${slugifyTopic(topic)}-001`;
  const adapter = normalizeAdapter(args.adapter);

  return {
    runId,
    topic,
    source: { type: "topic", value: topic },
    audience: "具备基础技术背景、希望通过中文互动课程建立心智模型的学习者。",
    outputLanguage: args.language?.trim() || "zh-CN",
    targetOutput: "web_deck",
    pageCount: {
      target: targetPages,
      min: Math.max(1, targetPages - 2),
      max: targetPages + 2
    },
    runtime: {
      adapter,
      mode: "interactive"
    },
    models: {
      defaultModel: {
        provider: adapter === "mock" ? "mock" : "configured-provider",
        model: adapter === "mock" ? "mock-learning-agent" : "configured-model",
        reasoningEffort: "medium",
        temperature: 0.3
      }
    },
    modelFallbackPolicy: "require_approval",
    approvalGates: defaultApprovalGates
  };
}

export function validateRunConfig(config: RunConfig): RunConfig {
  if (!config.runId.trim()) {
    throw new AgentRuntimeError("runId is required", "INVALID_RUN_CONFIG");
  }
  if (!config.topic.trim()) {
    throw new AgentRuntimeError("topic is required", "INVALID_RUN_CONFIG");
  }
  if (config.outputLanguage !== "zh-CN") {
    throw new AgentRuntimeError("only zh-CN outputLanguage is supported in this MVP", "INVALID_RUN_CONFIG");
  }
  if (!Number.isInteger(config.pageCount.target) || config.pageCount.target < 1 || config.pageCount.target > 40) {
    throw new AgentRuntimeError("pageCount.target must be between 1 and 40", "INVALID_RUN_CONFIG");
  }
  if (config.pageCount.min > config.pageCount.target || config.pageCount.max < config.pageCount.target) {
    throw new AgentRuntimeError("pageCount min/target/max are inconsistent", "INVALID_RUN_CONFIG");
  }
  if (config.runtime.adapter !== "mock" && config.runtime.adapter !== "codex-manual") {
    throw new AgentRuntimeError(`unsupported adapter: ${config.runtime.adapter}`, "UNSUPPORTED_ADAPTER");
  }
  return config;
}

function normalizeAdapter(adapter?: string): RuntimeAdapterId {
  const normalized = (adapter || "mock").trim();
  if (normalized === "mock" || normalized === "codex-manual") {
    return normalized;
  }
  throw new AgentRuntimeError(`unsupported adapter: ${normalized}`, "UNSUPPORTED_ADAPTER");
}

function slugifyTopic(topic: string): string {
  if (topicSlugMap[topic]) {
    return topicSlugMap[topic];
  }
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/[\u4e00-\u9fa5]/g, "lesson")
    .replace(/lesson+/g, "lesson")
    .replace(/^-+|-+$/g, "") || "learning-run";
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/run-config.test.ts
npm run typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 7: Version-control checkpoint**

Run:

```bash
git status --short
```

If git exists, commit:

```bash
git add tools/agent-runtime/types.ts tools/agent-runtime/errors.ts tools/agent-runtime/run-config.ts tools/agent-runtime/__tests__/run-config.test.ts
git commit -m "feat: add agent run config validation"
```

---

### Task 3: RunStore And ArtifactStore

**Files:**
- Create: `tools/agent-runtime/run-store.ts`
- Create: `tools/agent-runtime/artifact-store.ts`
- Create: `tools/agent-runtime/__tests__/stores.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `tools/agent-runtime/__tests__/stores.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";

import { ArtifactStore } from "../artifact-store.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";

describe("run and artifact stores", () => {
  test("creates run directory layout and writes config", async () => {
    const root = await mkdtemp(join(tmpdir(), "learning-agent-"));
    try {
      const store = new RunStore(root);
      const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8" });

      await store.createRun(config);

      await expect(readFile(join(root, "runs/hash-table-001/run.config.json"), "utf8")).resolves.toContain('"outputLanguage": "zh-CN"');
      await expect(readFile(join(root, "runs/hash-table-001/logs/orchestration.md"), "utf8")).resolves.toContain("Run created");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("writes versioned artifacts and draft alias", async () => {
    const root = await mkdtemp(join(tmpdir(), "learning-agent-"));
    try {
      const runStore = new RunStore(root);
      const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8" });
      await runStore.createRun(config);

      const artifacts = new ArtifactStore(runStore.getRunPath(config.runId));
      const first = await artifacts.writeDraft("source-ingest", { concepts: ["hash table"] });
      const second = await artifacts.writeDraft("source-ingest", { concepts: ["hash table", "collision"] });

      expect(first.version).toBe("v1");
      expect(second.version).toBe("v2");
      await expect(readFile(join(root, "runs/hash-table-001/artifacts/source-ingest.draft.json"), "utf8")).resolves.toContain("collision");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/stores.test.ts
```

Expected: FAIL because store modules do not exist.

- [ ] **Step 3: Implement RunStore**

Create `tools/agent-runtime/run-store.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { AgentRuntimeError } from "./errors.js";
import { validateRunConfig } from "./run-config.js";
import type { RunConfig } from "./types.js";

export class RunStore {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  getRunPath(runId: string): string {
    if (!runId.trim()) {
      throw new AgentRuntimeError("run id is required", "MISSING_RUN");
    }
    return join(this.workspaceRoot, "runs", runId);
  }

  async createRun(config: RunConfig): Promise<string> {
    const validConfig = validateRunConfig(config);
    const runPath = this.getRunPath(validConfig.runId);
    await mkdir(join(runPath, "artifacts"), { recursive: true });
    await mkdir(join(runPath, "approvals"), { recursive: true });
    await mkdir(join(runPath, "logs"), { recursive: true });
    await mkdir(join(runPath, "exports"), { recursive: true });
    await writeFile(join(runPath, "run.config.json"), `${JSON.stringify(validConfig, null, 2)}\n`, "utf8");
    await writeFile(join(runPath, "logs", "orchestration.md"), `# ${validConfig.runId}\n\n- Run created for topic: ${validConfig.topic}\n`, "utf8");
    await writeFile(join(runPath, "logs", "runtime-events.jsonl"), "", "utf8");
    return runPath;
  }

  async readConfig(runId: string): Promise<RunConfig> {
    const raw = await readFile(join(this.getRunPath(runId), "run.config.json"), "utf8");
    return validateRunConfig(JSON.parse(raw) as RunConfig);
  }
}
```

- [ ] **Step 4: Implement ArtifactStore**

Create `tools/agent-runtime/artifact-store.ts`:

```ts
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ArtifactWriteResult = {
  artifactId: string;
  version: `v${number}`;
  path: string;
  draftPath: string;
};

export class ArtifactStore {
  private readonly artifactsPath: string;

  constructor(private readonly runPath: string) {
    this.artifactsPath = join(runPath, "artifacts");
  }

  async writeDraft(artifactId: string, payload: unknown): Promise<ArtifactWriteResult> {
    await mkdir(this.artifactsPath, { recursive: true });
    const version = await this.nextVersion(artifactId);
    const path = join(this.artifactsPath, `${artifactId}.${version}.json`);
    const draftPath = join(this.artifactsPath, `${artifactId}.draft.json`);
    const body = `${JSON.stringify(payload, null, 2)}\n`;
    await writeFile(path, body, "utf8");
    await writeFile(draftPath, body, "utf8");
    return { artifactId, version, path, draftPath };
  }

  async readDraft<T>(artifactId: string): Promise<T> {
    const raw = await readFile(join(this.artifactsPath, `${artifactId}.draft.json`), "utf8");
    return JSON.parse(raw) as T;
  }

  async readVersion<T>(artifactId: string, version: `v${number}`): Promise<T> {
    const raw = await readFile(join(this.artifactsPath, `${artifactId}.${version}.json`), "utf8");
    return JSON.parse(raw) as T;
  }

  async copyApprovedAlias(artifactId: string, version: `v${number}`): Promise<string> {
    const source = join(this.artifactsPath, `${artifactId}.${version}.json`);
    const target = join(this.artifactsPath, `${artifactId}.approved.json`);
    await copyFile(source, target);
    return target;
  }

  private async nextVersion(artifactId: string): Promise<`v${number}`> {
    const files = await readdir(this.artifactsPath).catch(() => []);
    const versions = files
      .map((file) => file.match(new RegExp(`^${artifactId}\\.v(\\d+)\\.json$`))?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number);
    const next = versions.length === 0 ? 1 : Math.max(...versions) + 1;
    return `v${next}` as `v${number}`;
  }
}
```

- [ ] **Step 5: Run store tests**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/stores.test.ts
npm run typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 6: Version-control checkpoint**

Run:

```bash
git status --short
```

If git exists, commit:

```bash
git add tools/agent-runtime/run-store.ts tools/agent-runtime/artifact-store.ts tools/agent-runtime/__tests__/stores.test.ts
git commit -m "feat: add run and artifact stores"
```

---

### Task 4: ApprovalService

**Files:**
- Create: `tools/agent-runtime/approval-service.ts`
- Create: `tools/agent-runtime/__tests__/approval-service.test.ts`

- [ ] **Step 1: Write failing approval tests**

Create `tools/agent-runtime/__tests__/approval-service.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";

import { ApprovalService } from "../approval-service.js";
import { ArtifactStore } from "../artifact-store.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";

describe("ApprovalService", () => {
  test("approves exact artifact version and writes approved alias", async () => {
    const root = await mkdtemp(join(tmpdir(), "learning-agent-"));
    try {
      const runStore = new RunStore(root);
      const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8" });
      const runPath = await runStore.createRun(config);
      const artifacts = new ArtifactStore(runPath);
      await artifacts.writeDraft("learning-architecture", { pageSequence: [] });

      const approvals = new ApprovalService(runPath, artifacts);
      await approvals.approve({
        gate: "learning-architecture",
        runId: config.runId,
        artifactId: "learning-architecture",
        version: "v1",
        decision: "approved",
        operatorNotes: "结构可用"
      });

      await expect(readFile(join(runPath, "approvals/learning-architecture.approved.json"), "utf8")).resolves.toContain('"decision": "approved"');
      await expect(readFile(join(runPath, "artifacts/learning-architecture.approved.json"), "utf8")).resolves.toContain("pageSequence");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/approval-service.test.ts
```

Expected: FAIL because `approval-service.ts` does not exist.

- [ ] **Step 3: Implement ApprovalService**

Create `tools/agent-runtime/approval-service.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ArtifactStore } from "./artifact-store.js";
import type { ApprovalGateId } from "./types.js";

export type ApprovalDecision = "approved" | "approved_with_notes" | "revision_requested" | "rejected";

export type ApprovalRequest = {
  gate: ApprovalGateId;
  runId: string;
  artifactId: string;
  version: `v${number}`;
  decision: ApprovalDecision;
  operatorNotes?: string;
};

export class ApprovalService {
  private readonly approvalsPath: string;

  constructor(
    private readonly runPath: string,
    private readonly artifactStore: ArtifactStore
  ) {
    this.approvalsPath = join(runPath, "approvals");
  }

  async approve(request: ApprovalRequest): Promise<string> {
    await mkdir(this.approvalsPath, { recursive: true });
    const record = {
      gate: request.gate,
      runId: request.runId,
      approvedArtifact: `artifacts/${request.artifactId}.${request.version}.json`,
      decision: request.decision,
      operatorNotes: request.operatorNotes ?? "",
      decidedAt: new Date().toISOString()
    };
    const approvalPath = join(this.approvalsPath, `${request.gate}.approved.json`);
    await writeFile(approvalPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    if (request.decision === "approved" || request.decision === "approved_with_notes") {
      await this.artifactStore.copyApprovedAlias(request.artifactId, request.version);
    }
    return approvalPath;
  }
}
```

- [ ] **Step 4: Run approval tests**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/approval-service.test.ts
npm run typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 5: Version-control checkpoint**

Run:

```bash
git status --short
```

If git exists, commit:

```bash
git add tools/agent-runtime/approval-service.ts tools/agent-runtime/__tests__/approval-service.test.ts
git commit -m "feat: add artifact approval service"
```

---

### Task 5: Mock Adapter And AgentWorkflow

**Files:**
- Create: `tools/agent-runtime/workflow/role-sequence.ts`
- Create: `tools/agent-runtime/adapters/mock-adapter.ts`
- Create: `tools/agent-runtime/workflow/agent-workflow.ts`
- Create: `tools/agent-runtime/__tests__/agent-workflow.test.ts`

- [ ] **Step 1: Write failing workflow tests**

Create `tools/agent-runtime/__tests__/agent-workflow.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";

import { ArtifactStore } from "../artifact-store.js";
import { ApprovalService } from "../approval-service.js";
import { MockRuntimeAdapter } from "../adapters/mock-adapter.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";
import { AgentWorkflow } from "../workflow/agent-workflow.js";

describe("AgentWorkflow", () => {
  test("writes source ingest and then stops before gated learning architecture downstream work", async () => {
    const root = await mkdtemp(join(tmpdir(), "learning-agent-"));
    try {
      const runStore = new RunStore(root);
      const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8" });
      const runPath = await runStore.createRun(config);
      const artifactStore = new ArtifactStore(runPath);
      const approvalService = new ApprovalService(runPath, artifactStore);
      const workflow = new AgentWorkflow(runStore, artifactStore, approvalService, new MockRuntimeAdapter());

      const first = await workflow.runNext(config.runId);
      const second = await workflow.runNext(config.runId);
      const third = await workflow.runNext(config.runId);

      expect(first.status).toBe("artifact_written");
      expect(first.artifactId).toBe("source-ingest");
      expect(second.artifactId).toBe("learning-architecture");
      expect(third.status).toBe("approval_required");
      expect(third.requiredGate).toBe("learning-architecture");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/agent-workflow.test.ts
```

Expected: FAIL because workflow and adapter files do not exist.

- [ ] **Step 3: Define role sequence**

Create `tools/agent-runtime/workflow/role-sequence.ts`:

```ts
export type RoleId =
  | "source-ingest"
  | "learning-architecture"
  | "visual-pedagogy"
  | "interaction-design"
  | "assessment-design"
  | "lesson-assembly"
  | "lesson-critic"
  | "publish-package";

export const roleSequence: Array<{ roleId: RoleId; artifactId: string; requiredApprovedGateBefore?: string; createsGate?: string }> = [
  { roleId: "source-ingest", artifactId: "source-ingest" },
  { roleId: "learning-architecture", artifactId: "learning-architecture", createsGate: "learning-architecture" },
  { roleId: "visual-pedagogy", artifactId: "visual-plan", requiredApprovedGateBefore: "learning-architecture" },
  { roleId: "interaction-design", artifactId: "interaction-plan", requiredApprovedGateBefore: "learning-architecture" },
  { roleId: "assessment-design", artifactId: "assessment-plan", requiredApprovedGateBefore: "learning-architecture" },
  { roleId: "lesson-assembly", artifactId: "lesson", requiredApprovedGateBefore: "learning-architecture", createsGate: "lesson" },
  { roleId: "lesson-critic", artifactId: "critic-report", requiredApprovedGateBefore: "lesson", createsGate: "critic-report" },
  { roleId: "publish-package", artifactId: "publish-package", requiredApprovedGateBefore: "critic-report", createsGate: "publish-package" }
];
```

- [ ] **Step 4: Implement deterministic mock adapter**

Create `tools/agent-runtime/adapters/mock-adapter.ts`:

```ts
import type { RunConfig } from "../types.js";
import type { RoleId } from "../workflow/role-sequence.js";

export type RuntimeAdapterResult = {
  artifactId: string;
  payload: unknown;
};

export class MockRuntimeAdapter {
  async executeRole(config: RunConfig, roleId: RoleId, artifactId: string): Promise<RuntimeAdapterResult> {
    const pageCount = config.pageCount.target;
    const base = {
      artifactId,
      runId: config.runId,
      createdByRole: roleId,
      outputLanguage: config.outputLanguage
    };

    if (roleId === "source-ingest") {
      return {
        artifactId,
        payload: {
          ...base,
          concepts: [{ id: "core-concept", label: config.topic, description: `围绕「${config.topic}」建立核心心智模型。` }],
          dependencies: [],
          examples: [`${config.topic} 的具体问题场景`],
          misconceptions: [`关于 ${config.topic} 的常见误解`],
          candidateInteractions: ["预测结果", "调整参数", "解释反馈"]
        }
      };
    }

    if (roleId === "learning-architecture") {
      return {
        artifactId,
        payload: {
          ...base,
          audience: config.audience,
          prerequisites: ["理解基础技术术语"],
          learningObjectives: [`解释 ${config.topic} 的核心机制`, `把 ${config.topic} 迁移到新场景`],
          pageCount: { ...config.pageCount, planned: pageCount },
          pageSequence: Array.from({ length: pageCount }, (_, index) => ({
            id: `p${String(index + 1).padStart(2, "0")}`,
            title: `${config.topic} 第 ${index + 1} 页`,
            learningGoal: `建立第 ${index + 1} 个关键理解`
          }))
        }
      };
    }

    return {
      artifactId,
      payload: {
        ...base,
        summary: `${roleId} mock artifact for ${config.topic}`
      }
    };
  }
}
```

- [ ] **Step 5: Implement AgentWorkflow**

Create `tools/agent-runtime/workflow/agent-workflow.ts`:

```ts
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { ArtifactStore } from "../artifact-store.js";
import type { ApprovalService } from "../approval-service.js";
import type { MockRuntimeAdapter } from "../adapters/mock-adapter.js";
import type { RunStore } from "../run-store.js";
import { roleSequence } from "./role-sequence.js";

export type WorkflowResult =
  | { status: "artifact_written"; artifactId: string; version: string; createsGate?: string }
  | { status: "approval_required"; requiredGate: string }
  | { status: "complete" };

export class AgentWorkflow {
  constructor(
    private readonly runStore: RunStore,
    private readonly artifactStore: ArtifactStore,
    private readonly approvalService: ApprovalService,
    private readonly adapter: MockRuntimeAdapter
  ) {
    void this.approvalService;
  }

  async runNext(runId: string): Promise<WorkflowResult> {
    const config = await this.runStore.readConfig(runId);
    const runPath = this.runStore.getRunPath(runId);
    for (const role of roleSequence) {
      if (role.requiredApprovedGateBefore && !(await fileExists(join(runPath, "approvals", `${role.requiredApprovedGateBefore}.approved.json`)))) {
        return { status: "approval_required", requiredGate: role.requiredApprovedGateBefore };
      }
      if (!(await hasArtifact(runPath, role.artifactId))) {
        const result = await this.adapter.executeRole(config, role.roleId, role.artifactId);
        const write = await this.artifactStore.writeDraft(result.artifactId, result.payload);
        return { status: "artifact_written", artifactId: result.artifactId, version: write.version, createsGate: role.createsGate };
      }
      if (role.createsGate && !(await fileExists(join(runPath, "approvals", `${role.createsGate}.approved.json`)))) {
        return { status: "approval_required", requiredGate: role.createsGate };
      }
    }
    return { status: "complete" };
  }
}

async function hasArtifact(runPath: string, artifactId: string): Promise<boolean> {
  const files = await readdir(join(runPath, "artifacts")).catch(() => []);
  return files.some((file) => file.startsWith(`${artifactId}.v`) && file.endsWith(".json"));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Run workflow tests**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/agent-workflow.test.ts
npm run typecheck
npm run lint
```

Expected: tests pass, typecheck exits 0, lint exits 0.

- [ ] **Step 7: Version-control checkpoint**

Run:

```bash
git status --short
```

If git exists, commit:

```bash
git add tools/agent-runtime/workflow tools/agent-runtime/adapters tools/agent-runtime/__tests__/agent-workflow.test.ts
git commit -m "feat: add mock agent workflow"
```

---

### Task 6: CLI Commands For Init, Status, Run, Approval, Resume

**Files:**
- Modify: `tools/agent-runtime/cli.ts`
- Modify: `tools/agent-runtime/index.ts`

- [ ] **Step 1: Export runtime services**

Modify `tools/agent-runtime/index.ts`:

```ts
export const agentRuntimeVersion = "0.1.0";

export { ArtifactStore } from "./artifact-store.js";
export { ApprovalService } from "./approval-service.js";
export { MockRuntimeAdapter } from "./adapters/mock-adapter.js";
export { createRunConfigFromArgs, validateRunConfig } from "./run-config.js";
export { RunStore } from "./run-store.js";
export { AgentWorkflow } from "./workflow/agent-workflow.js";
```

- [ ] **Step 2: Replace CLI stub with command dispatcher**

Modify `tools/agent-runtime/cli.ts`:

```ts
import {
  agentRuntimeVersion,
  AgentWorkflow,
  ApprovalService,
  ArtifactStore,
  createRunConfigFromArgs,
  MockRuntimeAdapter,
  RunStore
} from "./index.js";

type Args = Record<string, string | undefined>;

const [command = "help", ...rawArgs] = process.argv.slice(2);
const args = parseArgs(rawArgs);
const runStore = new RunStore(process.cwd());

try {
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command === "init") {
    const config = createRunConfigFromArgs({
      topic: args.topic,
      pages: args.pages,
      language: args.language,
      adapter: args.adapter,
      run: args.run
    });
    await runStore.createRun(config);
    console.log(`Created run ${config.runId}`);
    console.log(`Next: npm run agent:run -- --run ${config.runId}`);
    process.exit(0);
  }

  const runId = requireRunId(args);
  const runPath = runStore.getRunPath(runId);
  const artifactStore = new ArtifactStore(runPath);
  const approvalService = new ApprovalService(runPath, artifactStore);
  const workflow = new AgentWorkflow(runStore, artifactStore, approvalService, new MockRuntimeAdapter());

  if (command === "status") {
    const config = await runStore.readConfig(runId);
    console.log(JSON.stringify({ runId: config.runId, topic: config.topic, outputLanguage: config.outputLanguage, pageCount: config.pageCount }, null, 2));
    process.exit(0);
  }

  if (command === "run" || command === "resume") {
    const result = await workflow.runNext(runId);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (command === "approve") {
    const gate = requireArg(args, "gate");
    const artifact = gateToArtifact(gate);
    const version = (args.version ?? "v1") as `v${number}`;
    await approvalService.approve({
      gate: gate as never,
      runId,
      artifactId: artifact,
      version,
      decision: "approved",
      operatorNotes: args.notes ?? ""
    });
    console.log(`Approved ${artifact}.${version} for gate ${gate}`);
    process.exit(0);
  }

  if (command === "revise") {
    const gate = requireArg(args, "gate");
    const artifact = gateToArtifact(gate);
    const version = (args.version ?? "v1") as `v${number}`;
    await approvalService.approve({
      gate: gate as never,
      runId,
      artifactId: artifact,
      version,
      decision: "revision_requested",
      operatorNotes: args.notes ?? "revision requested"
    });
    console.log(`Revision requested for ${artifact}.${version}`);
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseArgs(values: string[]): Args {
  const result: Args = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.startsWith("--")) {
      result[value.slice(2)] = values[index + 1];
      index += 1;
    }
  }
  return result;
}

function requireRunId(args: Args): string {
  return requireArg(args, "run");
}

function requireArg(args: Args, key: string): string {
  const value = args[key]?.trim();
  if (!value) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

function gateToArtifact(gate: string): string {
  if (gate === "learning-architecture") return "learning-architecture";
  if (gate === "lesson") return "lesson";
  if (gate === "critic-report") return "critic-report";
  if (gate === "publish-package") return "publish-package";
  throw new Error(`unsupported gate: ${gate}`);
}

function printHelp() {
  console.log(`AI Interactive Learning Agent runtime ${agentRuntimeVersion}`);
  console.log("Commands:");
  console.log("  init --topic <topic> --pages <count> [--language zh-CN] [--run <id>]");
  console.log("  status --run <id>");
  console.log("  run --run <id>");
  console.log("  approve --run <id> --gate <gate> [--version v1] [--notes text]");
  console.log("  revise --run <id> --gate <gate> [--version v1] --notes <text>");
  console.log("  resume --run <id>");
  console.log("  promote --run <id>");
}
```

- [ ] **Step 3: Run CLI smoke test**

Run:

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --run hash-table-cli-test
npm run agent:status -- --run hash-table-cli-test
npm run agent:run -- --run hash-table-cli-test
npm run agent:run -- --run hash-table-cli-test
npm run agent:run -- --run hash-table-cli-test
```

Expected:

```text
Created run hash-table-cli-test
status prints JSON with outputLanguage zh-CN
first run writes source-ingest
second run writes learning-architecture
third run returns approval_required for learning-architecture
```

- [ ] **Step 4: Approve and resume**

Run:

```bash
npm run agent:approve -- --run hash-table-cli-test --gate learning-architecture --version v1 --notes "结构通过"
npm run agent:resume -- --run hash-table-cli-test
```

Expected:

```text
Approved learning-architecture.v1 for gate learning-architecture
resume writes visual-plan or another downstream artifact
```

- [ ] **Step 5: Run verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test
```

Expected: all pass.

- [ ] **Step 6: Version-control checkpoint**

Run:

```bash
git status --short
```

If git exists, commit:

```bash
git add tools/agent-runtime/cli.ts tools/agent-runtime/index.ts
git commit -m "feat: add agent runtime cli commands"
```

---

### Task 7: Lesson Promotion Service

**Files:**
- Create: `tools/agent-runtime/promotion/lesson-promotion-service.ts`
- Create: `tools/agent-runtime/__tests__/promotion.test.ts`
- Modify: `tools/agent-runtime/cli.ts`
- Modify: `tools/agent-runtime/index.ts`

- [ ] **Step 1: Write failing promotion test**

Create `tools/agent-runtime/__tests__/promotion.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";

import { ArtifactStore } from "../artifact-store.js";
import { ApprovalService } from "../approval-service.js";
import { LessonPromotionService } from "../promotion/lesson-promotion-service.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";

describe("LessonPromotionService", () => {
  test("promotes approved lesson without assuming ten pages", async () => {
    const root = await mkdtemp(join(tmpdir(), "learning-agent-"));
    try {
      const runStore = new RunStore(root);
      const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-001" });
      const runPath = await runStore.createRun(config);
      const artifacts = new ArtifactStore(runPath);
      await artifacts.writeDraft("lesson", {
        id: "hash-table",
        title: "哈希表为什么快",
        audience: "中文学习者",
        config: { targetPageCount: 8 },
        prerequisites: [],
        learningObjectives: ["解释哈希表的访问路径"],
        pages: Array.from({ length: 8 }, (_, index) => ({
          id: `p${index + 1}`,
          type: index === 7 ? "summary_card" : "problem_scene",
          title: `第 ${index + 1} 页`,
          learningGoal: "建立理解",
          narrative: "中文内容"
        })),
        misconceptions: [],
        transferTasks: [],
        summary: ["哈希表用 key 定位 bucket。"]
      });
      const approvals = new ApprovalService(runPath, artifacts);
      await approvals.approve({ gate: "lesson", runId: config.runId, artifactId: "lesson", version: "v1", decision: "approved" });

      const service = new LessonPromotionService(root);
      const result = await service.promote(config.runId);

      expect(result.lessonPath).toContain("src/lessons/hash-table/lesson.ts");
      await expect(readFile(result.lessonPath, "utf8")).resolves.toContain("targetPageCount: 8");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/promotion.test.ts
```

Expected: FAIL because promotion service does not exist.

- [ ] **Step 3: Implement promotion service**

Create `tools/agent-runtime/promotion/lesson-promotion-service.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { AgentRuntimeError } from "../errors.js";

type LessonLike = {
  id: string;
  title: string;
  audience: string;
  config: { targetPageCount: number; minPageCount?: number; maxPageCount?: number };
  prerequisites: string[];
  learningObjectives: string[];
  pages: Array<{ id: string; type: string; title: string; learningGoal: string; narrative: string }>;
  misconceptions: unknown[];
  transferTasks: unknown[];
  summary: string[];
};

export type PromotionResult = {
  lessonPath: string;
};

export class LessonPromotionService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async promote(runId: string): Promise<PromotionResult> {
    const runPath = join(this.workspaceRoot, "runs", runId);
    const raw = await readFile(join(runPath, "artifacts", "lesson.approved.json"), "utf8");
    const lesson = JSON.parse(raw) as LessonLike;
    validateLesson(lesson);

    const targetDir = join(this.workspaceRoot, "src", "lessons", lesson.id);
    await mkdir(targetDir, { recursive: true });
    const lessonPath = join(targetDir, "lesson.ts");
    const source = [
      'import type { Lesson } from "../../schemas/lesson.schema";',
      "",
      "export const generatedLesson = ",
      `${JSON.stringify(lesson, null, 2)} satisfies Lesson;`,
      ""
    ].join("\n");
    await writeFile(lessonPath, source, "utf8");
    return { lessonPath };
  }
}

function validateLesson(lesson: LessonLike) {
  if (!lesson.id || !lesson.title || !lesson.audience) {
    throw new AgentRuntimeError("approved lesson is missing id, title, or audience", "INVALID_LESSON");
  }
  if (!Number.isInteger(lesson.config?.targetPageCount) || lesson.config.targetPageCount < 1) {
    throw new AgentRuntimeError("approved lesson has invalid targetPageCount", "INVALID_LESSON");
  }
  if (!Array.isArray(lesson.pages) || lesson.pages.length !== lesson.config.targetPageCount) {
    throw new AgentRuntimeError("approved lesson pages length must match targetPageCount", "INVALID_LESSON");
  }
}
```

- [ ] **Step 4: Export and wire promote command**

Modify `tools/agent-runtime/index.ts`:

```ts
export { LessonPromotionService } from "./promotion/lesson-promotion-service.js";
```

Modify `tools/agent-runtime/cli.ts` imports:

```ts
import {
  agentRuntimeVersion,
  AgentWorkflow,
  ApprovalService,
  ArtifactStore,
  createRunConfigFromArgs,
  LessonPromotionService,
  MockRuntimeAdapter,
  RunStore
} from "./index.js";
```

Add before unknown command handling:

```ts
if (command === "promote") {
  const service = new LessonPromotionService(process.cwd());
  const result = await service.promote(runId);
  console.log(`Promoted lesson to ${result.lessonPath}`);
  process.exit(0);
}
```

- [ ] **Step 5: Run promotion tests**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/promotion.test.ts
npm run typecheck
npm run lint
```

Expected: tests pass, typecheck exits 0, lint exits 0.

- [ ] **Step 6: Version-control checkpoint**

Run:

```bash
git status --short
```

If git exists, commit:

```bash
git add tools/agent-runtime/promotion tools/agent-runtime/__tests__/promotion.test.ts tools/agent-runtime/index.ts tools/agent-runtime/cli.ts
git commit -m "feat: add approved lesson promotion"
```

---

### Task 8: Codex Skill And Documentation

**Files:**
- Create: `skills/learning-agent-runner/SKILL.md`
- Modify: `README.md`
- Modify: `docs/runtime/run-config.schema.md`

- [ ] **Step 1: Create Codex skill**

Create `skills/learning-agent-runner/SKILL.md`:

````md
---
name: learning-agent-runner
description: Use when generating, resuming, approving, revising, or promoting an interactive Chinese learning lesson through the local agent runner.
---

# Learning Agent Runner

Use this skill when the user asks Codex to generate a learning lesson, run the multi-agent learning workflow, approve artifacts, resume a run, or promote a generated lesson.

## Defaults

- Output language: `zh-CN`
- Target output: `web_deck`
- Runtime adapter: `mock` unless the user explicitly asks for another configured adapter
- Preserve the user's requested page count

## Workflow

1. Create a run:

```bash
npm run agent:init -- --topic "<topic>" --pages <count> --language zh-CN
```

2. Run the next step:

```bash
npm run agent:run -- --run <run-id>
```

3. If the result says `approval_required`, inspect the matching artifact under:

```text
runs/<run-id>/artifacts/
```

4. Ask the user whether to approve or request revision.

5. Approve:

```bash
npm run agent:approve -- --run <run-id> --gate <gate-id> --version v1 --notes "<notes>"
```

6. Resume:

```bash
npm run agent:resume -- --run <run-id>
```

7. Promote after lesson approval:

```bash
npm run agent:promote -- --run <run-id>
```

8. Verify:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Quality Rules

- Do not generate English-first lessons unless the user explicitly requests it.
- Do not hard-code a 10-page lesson; use the requested page count.
- Do not skip approval gates.
- Do not rely on chat history as durable state; use `runs/<run-id>/`.
- Do not promote draft lessons; promote approved lesson artifacts only.
````

- [ ] **Step 2: Update README**

Add a section to `README.md`:

````md
## Codex Agent Runner

The project includes a Codex-first local runner for generating lesson artifacts.

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN
npm run agent:run -- --run hash-table-001
npm run agent:approve -- --run hash-table-001 --gate learning-architecture --version v1
npm run agent:resume -- --run hash-table-001
npm run agent:promote -- --run hash-table-001
```

The runner stores durable state under `runs/<run-id>/` and is designed so a future MCP server can reuse the same runtime core.
````

- [ ] **Step 3: Update runtime docs**

Append to `docs/runtime/run-config.schema.md` under the runtime section:

```md
### Current Implementation Note

The first implemented interface is a Codex-first local runner. It uses the same run config contract and stores state under `runs/<run-id>/`. The MCP server remains the target system interface and should wrap the same runtime core rather than duplicating orchestration logic.
```

- [ ] **Step 4: Verify docs and skill exist**

Run:

```bash
test -f skills/learning-agent-runner/SKILL.md
rg "Codex Agent Runner|MCP server" README.md docs/runtime/run-config.schema.md
npm run typecheck
npm run lint
```

Expected: files exist, search returns matching lines, typecheck and lint pass.

- [ ] **Step 5: Version-control checkpoint**

Run:

```bash
git status --short
```

If git exists, commit:

```bash
git add skills/learning-agent-runner/SKILL.md README.md docs/runtime/run-config.schema.md
git commit -m "docs: add codex agent runner usage"
```

---

### Task 9: End-To-End Verification

**Files:**
- No new files required.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run a complete mock generation path**

Run:

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN --run hash-table-e2e
npm run agent:run -- --run hash-table-e2e
npm run agent:run -- --run hash-table-e2e
npm run agent:approve -- --run hash-table-e2e --gate learning-architecture --version v1 --notes "学习路径通过"
npm run agent:resume -- --run hash-table-e2e
```

Expected:

```text
runs/hash-table-e2e/run.config.json exists
runs/hash-table-e2e/artifacts/source-ingest.v1.json exists
runs/hash-table-e2e/artifacts/learning-architecture.v1.json exists
runs/hash-table-e2e/approvals/learning-architecture.approved.json exists
resume writes a downstream artifact
```

- [ ] **Step 3: Inspect generated config for Chinese-first defaults**

Run:

```bash
node -e "const c=require('./runs/hash-table-e2e/run.config.json'); console.log(c.outputLanguage, c.pageCount.target)"
```

Expected:

```text
zh-CN 8
```

- [ ] **Step 4: Document remaining constraints in final notes**

Record these constraints in the implementation final answer:

```text
- First adapter is deterministic mock.
- Real model/provider execution is not enabled yet.
- MCP server is not implemented yet; runtime core is structured for it.
- Promotion requires an approved lesson artifact.
```

- [ ] **Step 5: Version-control checkpoint**

Run:

```bash
git status --short
```

If git exists, commit any remaining intended changes:

```bash
git add .
git commit -m "test: verify codex-first runner workflow"
```

---

## Self-Review

Spec coverage:

- Codex-usable runner: Tasks 1, 6, 8, 9.
- Runtime core separation: Tasks 2 through 7.
- Durable run state: Task 3.
- Artifact versioning: Task 3.
- Approval gates: Task 4 and Task 6.
- Resume: Task 5 and Task 6.
- Promotion: Task 7.
- Chinese-first defaults and user page count: Task 2 and Task 9.
- Future MCP readiness: architecture and docs in Tasks 1, 6, 8.

Red-flag scan:

- The plan contains no unresolved marker text.
- Every implementation task includes explicit files, commands, expected results, and code snippets.
- Type names are consistent across tasks: `RunConfig`, `RunStore`, `ArtifactStore`, `ApprovalService`, `AgentWorkflow`, `MockRuntimeAdapter`, `LessonPromotionService`.

Known implementation caution:

- The first workflow uses deterministic mock artifacts. Real model adapters should be added only after this file-backed workflow is stable.
