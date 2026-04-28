# Corpus-to-Curriculum Runtime Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the current Codex-first runner from single-topic lesson generation toward a source-grounded corpus-to-curriculum workflow by adding corpus/profile/mode config, source-map/concept-map/curriculum-plan artifacts, approval gates, mock outputs, and codex-manual prompts.

**Architecture:** Keep the current file-backed runtime core. Add typed corpus artifacts and prepend three corpus-level roles before existing unit-level lesson roles: `corpus-ingest`, `concept-mapper`, and `curriculum-planner`. Preserve topic-only runs by mapping `topic` into a one-item `sources` array, and keep existing lesson generation working after the new `curriculum-plan` gate is approved.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, existing `tools/agent-runtime`, existing CLI scripts, JSON artifacts under `runs/<run-id>/`.

---

## Scope Notes

This plan implements the next architecture slice from:

```text
docs/superpowers/specs/2026-04-28-corpus-to-curriculum-learning-agent-design.md
```

It does not implement PDF OCR, direct model APIs, browser UI for corpus planning, or MCP server tools.

The expected working path after this plan:

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN --run corpus-slice-smoke
npm run agent:run -- --run corpus-slice-smoke
npm run agent:run -- --run corpus-slice-smoke
npm run agent:approve -- --run corpus-slice-smoke --gate source-map --version v1 --notes "source map ok"
npm run agent:resume -- --run corpus-slice-smoke
npm run agent:approve -- --run corpus-slice-smoke --gate concept-map --version v1 --notes "concept map ok"
npm run agent:resume -- --run corpus-slice-smoke
npm run agent:approve -- --run corpus-slice-smoke --gate curriculum-plan --version v1 --notes "curriculum plan ok"
npm run agent:resume -- --run corpus-slice-smoke
```

After `curriculum-plan` is approved, existing unit-level roles continue as they do today.

## File Structure

Create:

```text
tools/agent-runtime/corpus-types.ts
tools/agent-runtime/__tests__/corpus-run-config.test.ts
tools/agent-runtime/__tests__/corpus-workflow.test.ts
tools/agent-runtime/__tests__/codex-manual-corpus.test.ts
```

Modify:

```text
tools/agent-runtime/types.ts
tools/agent-runtime/run-config.ts
tools/agent-runtime/workflow/role-sequence.ts
tools/agent-runtime/workflow/downstream-invalidation.ts
tools/agent-runtime/adapters/mock-adapter.ts
tools/agent-runtime/adapters/codex-manual-adapter.ts
tools/agent-runtime/__tests__/run-config.test.ts
tools/agent-runtime/__tests__/agent-workflow.test.ts
tools/agent-runtime/__tests__/codex-manual.test.ts
docs/runtime/run-config.schema.md
docs/runtime/agent-role-contracts.md
docs/runtime/artifact-contracts.md
README.md
skills/learning-agent-runner/SKILL.md
```

No React UI changes are required in this slice.

---

### Task 1: Corpus Types And Run Config Defaults

**Files:**
- Create: `tools/agent-runtime/corpus-types.ts`
- Modify: `tools/agent-runtime/types.ts`
- Modify: `tools/agent-runtime/run-config.ts`
- Create: `tools/agent-runtime/__tests__/corpus-run-config.test.ts`

- [ ] **Step 1: Write failing tests for corpus config defaults**

Create `tools/agent-runtime/__tests__/corpus-run-config.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createRunConfigFromArgs, validateRunConfig } from "../run-config.js";
import type { RunConfig } from "../types.js";

function baseConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-corpus" });
  return { ...config, ...overrides };
}

describe("corpus run config", () => {
  test("maps topic shorthand into a one-item sources array", () => {
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-corpus" });

    expect(config.topic).toBe("哈希表");
    expect(config.sources).toEqual([
      {
        id: "source-001",
        type: "topic",
        title: "哈希表",
        value: "哈希表",
        language: "zh-CN"
      }
    ]);
    expect(config.userLearningProfile).toMatchObject({
      level: "basic",
      readingHabit: "visual_first",
      goal: "understand",
      preferredPageCountPerUnit: 8
    });
    expect(config.curriculumPlanningMode).toBe("hybrid");
    expect(config.coveragePolicy).toEqual({
      requiredCoverage: "core_concepts",
      allowOmission: true,
      omissionRules: ["topic-only runs may omit source coverage beyond generated concept anchors"]
    });
  });

  test("validates supported curriculum planning modes", () => {
    expect(() =>
      validateRunConfig(baseConfig({ curriculumPlanningMode: "random_walk" } as unknown as Partial<RunConfig>))
    ).toThrow(/curriculumPlanningMode/);
  });

  test("validates user learning profile fields", () => {
    expect(() =>
      validateRunConfig(
        baseConfig({
          userLearningProfile: {
            level: "novice",
            readingHabit: "visual_first",
            goal: "understand",
            preferredPageCountPerUnit: 8
          }
        } as unknown as Partial<RunConfig>)
      )
    ).toThrow(/userLearningProfile.level/);
  });

  test("validates non-empty sources", () => {
    expect(() => validateRunConfig(baseConfig({ sources: [] }))).toThrow(/sources/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/corpus-run-config.test.ts
```

Expected: fail because `sources`, `userLearningProfile`, `curriculumPlanningMode`, and `coveragePolicy` do not exist on `RunConfig`.

- [ ] **Step 3: Add corpus type definitions**

Create `tools/agent-runtime/corpus-types.ts`:

```ts
export type SourceRecord = {
  id: string;
  type: "topic" | "text" | "file" | "folder" | "url";
  title: string;
  value?: string;
  uri?: string;
  contentType?: string;
  language?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type UserLearningProfile = {
  level: "beginner" | "basic" | "intermediate" | "advanced" | "expert";
  readingHabit: "follow_original" | "visual_first" | "case_first" | "practice_first" | "quick_overview" | "deep_dive";
  goal: "understand" | "teach" | "implement" | "replicate_research" | "prepare_exam" | "evaluate_patent" | "custom";
  timeBudgetMinutes?: number;
  preferredUnitCount?: number;
  preferredPageCountPerUnit?: number;
  notes?: string;
};

export type CurriculumPlanningMode = "chapter_guided" | "concept_guided" | "task_guided" | "hybrid";

export type CoveragePolicy = {
  requiredCoverage: "all_source" | "selected_sections" | "core_concepts" | "goal_relevant";
  allowOmission: boolean;
  omissionRules: string[];
};
```

- [ ] **Step 4: Extend RunConfig**

Modify `tools/agent-runtime/types.ts`:

```ts
import type { CoveragePolicy, CurriculumPlanningMode, SourceRecord, UserLearningProfile } from "./corpus-types.js";

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
  sources: SourceRecord[];
  audience: string;
  outputLanguage: string;
  targetOutput: "web_deck" | "canvas_map" | "playground" | "ai_tutor" | "teacher_mode" | "assessment_mode" | "package";
  pageCount: {
    target: number;
    min: number;
    max: number;
  };
  userLearningProfile: UserLearningProfile;
  curriculumPlanningMode: CurriculumPlanningMode;
  coveragePolicy: CoveragePolicy;
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

export type ApprovalGateId =
  | "source-map"
  | "concept-map"
  | "curriculum-plan"
  | "learning-architecture"
  | "lesson"
  | "critic-report"
  | "publish-package";

export type CliInitArgs = {
  topic?: string;
  pages?: string;
  language?: string;
  adapter?: string;
  run?: string;
};
```

- [ ] **Step 5: Add defaults and validation**

Modify `tools/agent-runtime/run-config.ts`:

1. Add imports and allowed sets near existing constants:

```ts
import type { CoveragePolicy, CurriculumPlanningMode, SourceRecord, UserLearningProfile } from "./corpus-types.js";

const allowedCurriculumPlanningModes = new Set<CurriculumPlanningMode>([
  "chapter_guided",
  "concept_guided",
  "task_guided",
  "hybrid"
]);
const allowedLearningLevels = new Set<UserLearningProfile["level"]>(["beginner", "basic", "intermediate", "advanced", "expert"]);
const allowedReadingHabits = new Set<UserLearningProfile["readingHabit"]>([
  "follow_original",
  "visual_first",
  "case_first",
  "practice_first",
  "quick_overview",
  "deep_dive"
]);
const allowedLearningGoals = new Set<UserLearningProfile["goal"]>([
  "understand",
  "teach",
  "implement",
  "replicate_research",
  "prepare_exam",
  "evaluate_patent",
  "custom"
]);
const allowedRequiredCoverage = new Set<CoveragePolicy["requiredCoverage"]>([
  "all_source",
  "selected_sections",
  "core_concepts",
  "goal_relevant"
]);
```

2. Extend `defaultApprovalGates`:

```ts
const defaultApprovalGates: ApprovalGateId[] = [
  "source-map",
  "concept-map",
  "curriculum-plan",
  "learning-architecture",
  "lesson",
  "critic-report",
  "publish-package"
];
```

3. Add fields in `createRunConfigFromArgs()` before `runtime`:

```ts
    sources: [
      {
        id: "source-001",
        type: "topic",
        title: topic,
        value: topic,
        language: args.language?.trim() || "zh-CN"
      }
    ],
    userLearningProfile: {
      level: "basic",
      readingHabit: "visual_first",
      goal: "understand",
      preferredPageCountPerUnit: targetPages
    },
    curriculumPlanningMode: "hybrid",
    coveragePolicy: {
      requiredCoverage: "core_concepts",
      allowOmission: true,
      omissionRules: ["topic-only runs may omit source coverage beyond generated concept anchors"]
    },
```

4. Add validators:

```ts
function validateSources(sources: SourceRecord[]): void {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new AgentRuntimeError("sources must contain at least one source record", "INVALID_RUN_CONFIG");
  }
  sources.forEach((source, index) => {
    const path = `sources[${index}]`;
    if (!isRecord(source) || Array.isArray(source)) {
      throw new AgentRuntimeError(`${path} must be an object`, "INVALID_RUN_CONFIG");
    }
    if (!isNonEmptyString(source.id)) {
      throw new AgentRuntimeError(`${path}.id is required`, "INVALID_RUN_CONFIG");
    }
    if (!allowedSourceTypes.has(String(source.type)) && source.type !== "folder") {
      throw new AgentRuntimeError(`${path}.type must be topic, text, file, folder, or url`, "INVALID_RUN_CONFIG");
    }
    if (!isNonEmptyString(source.title)) {
      throw new AgentRuntimeError(`${path}.title is required`, "INVALID_RUN_CONFIG");
    }
  });
}

function validateUserLearningProfile(profile: UserLearningProfile): void {
  if (!isRecord(profile) || Array.isArray(profile)) {
    throw new AgentRuntimeError("userLearningProfile must be an object", "INVALID_RUN_CONFIG");
  }
  if (!allowedLearningLevels.has(profile.level)) {
    throw new AgentRuntimeError("userLearningProfile.level is invalid", "INVALID_RUN_CONFIG");
  }
  if (!allowedReadingHabits.has(profile.readingHabit)) {
    throw new AgentRuntimeError("userLearningProfile.readingHabit is invalid", "INVALID_RUN_CONFIG");
  }
  if (!allowedLearningGoals.has(profile.goal)) {
    throw new AgentRuntimeError("userLearningProfile.goal is invalid", "INVALID_RUN_CONFIG");
  }
  if (profile.preferredPageCountPerUnit !== undefined && (!Number.isInteger(profile.preferredPageCountPerUnit) || profile.preferredPageCountPerUnit < 1 || profile.preferredPageCountPerUnit > 40)) {
    throw new AgentRuntimeError("userLearningProfile.preferredPageCountPerUnit must be an integer between 1 and 40", "INVALID_RUN_CONFIG");
  }
}

function validateCoveragePolicy(policy: CoveragePolicy): void {
  if (!isRecord(policy) || Array.isArray(policy)) {
    throw new AgentRuntimeError("coveragePolicy must be an object", "INVALID_RUN_CONFIG");
  }
  if (!allowedRequiredCoverage.has(policy.requiredCoverage)) {
    throw new AgentRuntimeError("coveragePolicy.requiredCoverage is invalid", "INVALID_RUN_CONFIG");
  }
  if (typeof policy.allowOmission !== "boolean") {
    throw new AgentRuntimeError("coveragePolicy.allowOmission must be boolean", "INVALID_RUN_CONFIG");
  }
  if (!Array.isArray(policy.omissionRules) || !policy.omissionRules.every((rule) => typeof rule === "string")) {
    throw new AgentRuntimeError("coveragePolicy.omissionRules must be strings", "INVALID_RUN_CONFIG");
  }
}
```

5. Call validators in `validateRunConfig()` after `validateSource(config.source)`:

```ts
  validateSources(config.sources);
  validateUserLearningProfile(config.userLearningProfile);
  if (!allowedCurriculumPlanningModes.has(config.curriculumPlanningMode)) {
    throw new AgentRuntimeError("curriculumPlanningMode must be chapter_guided, concept_guided, task_guided, or hybrid", "INVALID_RUN_CONFIG");
  }
  validateCoveragePolicy(config.coveragePolicy);
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/corpus-run-config.test.ts tools/agent-runtime/__tests__/run-config.test.ts
npm run typecheck
npm run lint
```

Expected: tests, typecheck, and lint pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add tools/agent-runtime/corpus-types.ts tools/agent-runtime/types.ts tools/agent-runtime/run-config.ts tools/agent-runtime/__tests__/corpus-run-config.test.ts tools/agent-runtime/__tests__/run-config.test.ts
git commit -m "feat: add corpus run config fields"
```

---

### Task 2: Corpus-Level Role Sequence And Approval Gates

**Files:**
- Modify: `tools/agent-runtime/workflow/role-sequence.ts`
- Modify: `tools/agent-runtime/workflow/downstream-invalidation.ts`
- Modify: `tools/agent-runtime/approval-service.ts`
- Create: `tools/agent-runtime/__tests__/corpus-workflow.test.ts`

- [ ] **Step 1: Write failing workflow tests**

Create `tools/agent-runtime/__tests__/corpus-workflow.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { MockRuntimeAdapter } from "../adapters/mock-adapter.js";
import { ApprovalService } from "../approval-service.js";
import { ArtifactStore } from "../artifact-store.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";
import { AgentWorkflow } from "../workflow/agent-workflow.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("corpus workflow gates", () => {
  test("runs source-map, then pauses for source-map approval", async () => {
    const { artifactStore, workflow } = await createHarness();

    await expect(workflow.runNext("hash-table-corpus")).resolves.toEqual({
      status: "artifact_written",
      artifactId: "source-map",
      version: "v1",
      createsGate: "source-map"
    });
    await expect(artifactStore.readDraft("source-map")).resolves.toMatchObject({
      corpusId: "hash-table-corpus",
      sources: [{ title: "哈希表" }]
    });
    await expect(workflow.runNext("hash-table-corpus")).resolves.toEqual({
      status: "approval_required",
      requiredGate: "source-map"
    });
  });

  test("runs concept-map only after source-map approval", async () => {
    const { approvalService, workflow } = await createHarness();

    await workflow.runNext("hash-table-corpus");
    await approvalService.approve({
      gate: "source-map",
      runId: "hash-table-corpus",
      artifactId: "source-map",
      version: "v1",
      decision: "approved"
    });

    await expect(workflow.runNext("hash-table-corpus")).resolves.toEqual({
      status: "artifact_written",
      artifactId: "concept-map",
      version: "v1",
      createsGate: "concept-map"
    });
  });

  test("runs curriculum-plan only after concept-map approval, then lesson roles wait for curriculum approval", async () => {
    const { approvalService, workflow } = await createHarness();

    await workflow.runNext("hash-table-corpus");
    await approve(approvalService, "source-map");
    await workflow.runNext("hash-table-corpus");
    await approve(approvalService, "concept-map");

    await expect(workflow.runNext("hash-table-corpus")).resolves.toEqual({
      status: "artifact_written",
      artifactId: "curriculum-plan",
      version: "v1",
      createsGate: "curriculum-plan"
    });
    await expect(workflow.runNext("hash-table-corpus")).resolves.toEqual({
      status: "approval_required",
      requiredGate: "curriculum-plan"
    });
  });
});

async function createHarness() {
  const root = await mkdtemp(path.join(tmpdir(), "agent-runtime-corpus-workflow-"));
  tempRoots.push(root);
  const runStore = new RunStore(root);
  const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-corpus" });
  const runPath = await runStore.createRun(config);
  const artifactStore = new ArtifactStore(runPath);
  const approvalService = new ApprovalService(runPath, artifactStore);
  const workflow = new AgentWorkflow(runStore, artifactStore, approvalService, new MockRuntimeAdapter());
  return { approvalService, artifactStore, workflow };
}

async function approve(approvalService: ApprovalService, gate: "source-map" | "concept-map" | "curriculum-plan") {
  await approvalService.approve({
    gate,
    runId: "hash-table-corpus",
    artifactId: gate,
    version: "v1",
    decision: "approved"
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/corpus-workflow.test.ts
```

Expected: fail because the role sequence and approval service do not know `source-map`, `concept-map`, or `curriculum-plan`.

- [ ] **Step 3: Extend role sequence types**

Modify `tools/agent-runtime/workflow/role-sequence.ts`:

```ts
import type { ApprovalGateId } from "../types.js";

export type RoleId =
  | "corpus-ingest"
  | "concept-mapper"
  | "curriculum-planner"
  | "source-ingest"
  | "learning-architecture"
  | "visual-pedagogy"
  | "interaction-design"
  | "assessment-design"
  | "lesson-assembly"
  | "lesson-critic"
  | "publish-package";

export type WorkflowArtifactId =
  | "source-map"
  | "concept-map"
  | "curriculum-plan"
  | "source-ingest"
  | "learning-architecture"
  | "visual-plan"
  | "interaction-plan"
  | "assessment-plan"
  | "lesson"
  | "critic-report"
  | "publish-package";

export type RoleStep = {
  roleId: RoleId;
  artifactId: WorkflowArtifactId;
  requiredApprovedGateBefore?: ApprovalGateId;
  createsGate?: ApprovalGateId;
};

export const roleSequence: readonly RoleStep[] = [
  { roleId: "corpus-ingest", artifactId: "source-map", createsGate: "source-map" },
  {
    roleId: "concept-mapper",
    artifactId: "concept-map",
    requiredApprovedGateBefore: "source-map",
    createsGate: "concept-map"
  },
  {
    roleId: "curriculum-planner",
    artifactId: "curriculum-plan",
    requiredApprovedGateBefore: "concept-map",
    createsGate: "curriculum-plan"
  },
  {
    roleId: "source-ingest",
    artifactId: "source-ingest",
    requiredApprovedGateBefore: "curriculum-plan"
  },
  {
    roleId: "learning-architecture",
    artifactId: "learning-architecture",
    requiredApprovedGateBefore: "curriculum-plan",
    createsGate: "learning-architecture"
  },
  {
    roleId: "visual-pedagogy",
    artifactId: "visual-plan",
    requiredApprovedGateBefore: "learning-architecture"
  },
  {
    roleId: "interaction-design",
    artifactId: "interaction-plan",
    requiredApprovedGateBefore: "learning-architecture"
  },
  {
    roleId: "assessment-design",
    artifactId: "assessment-plan",
    requiredApprovedGateBefore: "learning-architecture"
  },
  {
    roleId: "lesson-assembly",
    artifactId: "lesson",
    requiredApprovedGateBefore: "learning-architecture",
    createsGate: "lesson"
  },
  {
    roleId: "lesson-critic",
    artifactId: "critic-report",
    requiredApprovedGateBefore: "lesson",
    createsGate: "critic-report"
  },
  {
    roleId: "publish-package",
    artifactId: "publish-package",
    requiredApprovedGateBefore: "critic-report",
    createsGate: "publish-package"
  }
];
```

- [ ] **Step 4: Extend approval gate mapping**

Modify `tools/agent-runtime/approval-service.ts`.

Find the gate-to-artifact map and make it:

```ts
const gateToArtifact: Record<ApprovalGateId, string> = {
  "source-map": "source-map",
  "concept-map": "concept-map",
  "curriculum-plan": "curriculum-plan",
  "learning-architecture": "learning-architecture",
  lesson: "lesson",
  "critic-report": "critic-report",
  "publish-package": "publish-package"
};
```

If the file uses an array or switch instead, add the three new gates wherever gate validation and artifact mapping happen.

- [ ] **Step 5: Check downstream invalidation**

Open `tools/agent-runtime/workflow/downstream-invalidation.ts`.

No code change should be needed if it derives downstream artifacts from `roleSequence`. Verify it removes downstream artifacts when `source-map`, `concept-map`, or `curriculum-plan` is resubmitted or regenerated.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/corpus-workflow.test.ts tools/agent-runtime/__tests__/agent-workflow.test.ts tools/agent-runtime/__tests__/approval-service.test.ts
npm run typecheck
npm run lint
```

Expected: tests, typecheck, and lint pass. If old `agent-workflow.test.ts` assumed `source-ingest` is first, update it to approve the three corpus gates before checking unit-level roles.

- [ ] **Step 7: Commit**

Run:

```bash
git add tools/agent-runtime/workflow/role-sequence.ts tools/agent-runtime/workflow/downstream-invalidation.ts tools/agent-runtime/approval-service.ts tools/agent-runtime/__tests__/corpus-workflow.test.ts tools/agent-runtime/__tests__/agent-workflow.test.ts tools/agent-runtime/__tests__/approval-service.test.ts
git commit -m "feat: add corpus workflow gates"
```

---

### Task 3: Mock Corpus Artifacts

**Files:**
- Modify: `tools/agent-runtime/adapters/mock-adapter.ts`
- Modify: `tools/agent-runtime/__tests__/corpus-workflow.test.ts`

- [ ] **Step 1: Write failing tests for mock source-map, concept-map, and curriculum-plan payloads**

Append to `tools/agent-runtime/__tests__/corpus-workflow.test.ts`:

```ts
test("mock corpus artifacts carry source anchors and selected curriculum mode", async () => {
  const { approvalService, artifactStore, workflow } = await createHarness();

  await workflow.runNext("hash-table-corpus");
  await approve(approvalService, "source-map");
  await workflow.runNext("hash-table-corpus");
  await approve(approvalService, "concept-map");
  await workflow.runNext("hash-table-corpus");

  await expect(artifactStore.readDraft("source-map")).resolves.toMatchObject({
    corpusId: "hash-table-corpus",
    anchors: [{ anchorId: "source-001:topic", label: "哈希表" }]
  });
  await expect(artifactStore.readDraft("concept-map")).resolves.toMatchObject({
    concepts: expect.arrayContaining([
      expect.objectContaining({ id: "hash-function", sourceAnchorIds: ["source-001:topic"] })
    ])
  });
  await expect(artifactStore.readDraft("curriculum-plan")).resolves.toMatchObject({
    mode: "hybrid",
    units: [
      expect.objectContaining({
        id: "unit-001",
        targetPageCount: 8,
        outputProducts: expect.arrayContaining(["web_lesson"])
      })
    ]
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/corpus-workflow.test.ts
```

Expected: fail until `MockRuntimeAdapter` returns structured corpus artifacts.

- [ ] **Step 3: Implement source-map payload**

Modify `tools/agent-runtime/adapters/mock-adapter.ts` inside `executeRole()` before existing `source-ingest` handling:

```ts
    if (roleId === "corpus-ingest" && artifactId === "source-map") {
      return artifactResult({
        artifactId,
        roleId,
        corpusId: config.runId,
        language: config.outputLanguage,
        sources: config.sources,
        structure: config.sources.map((source) => ({
          id: `${source.id}:root`,
          sourceId: source.id,
          type: "document",
          title: source.title,
          anchorIds: [`${source.id}:topic`],
          children: []
        })),
        anchors: config.sources.map((source) => ({
          sourceId: source.id,
          anchorId: `${source.id}:topic`,
          label: source.title,
          locator: { kind: "heading", headingPath: [source.title] },
          quote: source.value ?? source.title,
          notes: "Topic shorthand source generated by the local runner."
        })),
        extractionNotes: ["Topic-only source map generated without external parsing."]
      });
    }
```

- [ ] **Step 4: Implement concept-map payload**

Add after source-map handling:

```ts
    if (roleId === "concept-mapper" && artifactId === "concept-map") {
      const sourceAnchorIds = config.sources.map((source) => `${source.id}:topic`);
      return artifactResult({
        artifactId,
        roleId,
        language: config.outputLanguage,
        concepts: [
          {
            id: "hash-function",
            label: "哈希函数",
            description: "把 key 映射到桶下标的规则。",
            difficulty: "core",
            sourceAnchorIds
          },
          {
            id: "collision",
            label: "哈希冲突",
            description: "不同 key 进入同一桶时需要额外处理。",
            difficulty: "core",
            sourceAnchorIds
          },
          {
            id: "load-factor",
            label: "负载因子",
            description: "元素数量与桶数量的比例，会影响冲突概率。",
            difficulty: "core",
            sourceAnchorIds
          }
        ],
        dependencies: [
          { from: "hash-function", to: "collision", relation: "enables", sourceAnchorIds },
          { from: "collision", to: "load-factor", relation: "applies_to", sourceAnchorIds }
        ],
        misconceptions: [
          {
            id: "always-o1",
            statement: "哈希表查找永远是 O(1)",
            correction: "平均接近 O(1)，但冲突严重时会变慢。",
            conceptIds: ["collision", "load-factor"],
            sourceAnchorIds,
            inferred: true
          }
        ],
        examples: [
          {
            id: "cache-key",
            title: "缓存 key 设计",
            description: "用 key 的区分度减少热点冲突。",
            conceptIds: ["hash-function", "collision"],
            sourceAnchorIds,
            kind: "transfer_example"
          }
        ]
      });
    }
```

- [ ] **Step 5: Implement curriculum-plan payload**

Add after concept-map handling:

```ts
    if (roleId === "curriculum-planner" && artifactId === "curriculum-plan") {
      const sourceAnchorIds = config.sources.map((source) => `${source.id}:topic`);
      return artifactResult({
        artifactId,
        roleId,
        id: `${config.runId}-curriculum-plan`,
        corpusId: config.runId,
        mode: config.curriculumPlanningMode,
        userProfile: config.userLearningProfile,
        coveragePolicy: config.coveragePolicy,
        units: [
          {
            id: "unit-001",
            title: `${config.topic}：建立可迁移心智模型`,
            purpose: "用一个交互式 web lesson 建立核心概念、误区和迁移能力。",
            targetPageCount: config.userLearningProfile.preferredPageCountPerUnit ?? config.pageCount.target,
            sourceAnchorIds,
            conceptIds: ["hash-function", "collision", "load-factor"],
            outputProducts: ["web_lesson", "assessment"]
          }
        ],
        sourceCoverage: config.sources.map((source) => ({
          sourceNodeId: `${source.id}:root`,
          status: "covered",
          unitIds: ["unit-001"]
        })),
        conceptCoverage: [
          { conceptId: "hash-function", status: "covered", unitIds: ["unit-001"] },
          { conceptId: "collision", status: "covered", unitIds: ["unit-001"] },
          { conceptId: "load-factor", status: "covered", unitIds: ["unit-001"] }
        ],
        rationale: [
          "Topic-only source uses hybrid mode with a source map and pedagogical concept map.",
          "One 8-page web lesson is enough for the current user-requested scope."
        ]
      });
    }
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/corpus-workflow.test.ts
npm run typecheck
npm run lint
```

Expected: tests, typecheck, and lint pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add tools/agent-runtime/adapters/mock-adapter.ts tools/agent-runtime/__tests__/corpus-workflow.test.ts
git commit -m "feat: add mock corpus artifacts"
```

---

### Task 4: Codex Manual Corpus Prompts

**Files:**
- Modify: `tools/agent-runtime/adapters/codex-manual-adapter.ts`
- Create: `tools/agent-runtime/__tests__/codex-manual-corpus.test.ts`

- [ ] **Step 1: Write failing tests for role-specific corpus prompts**

Create `tools/agent-runtime/__tests__/codex-manual-corpus.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { CodexManualAdapter } from "../adapters/codex-manual-adapter.js";
import { ApprovalService } from "../approval-service.js";
import { ArtifactStore } from "../artifact-store.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";
import { AgentWorkflow } from "../workflow/agent-workflow.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("codex-manual corpus prompts", () => {
  test("source-map prompt names grounding requirements and submit command", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agent-runtime-manual-corpus-"));
    tempRoots.push(root);
    const runStore = new RunStore(root);
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-manual-corpus", adapter: "codex-manual" });
    const runPath = await runStore.createRun(config);
    const artifactStore = new ArtifactStore(runPath);
    const approvalService = new ApprovalService(runPath, artifactStore);
    const workflow = new AgentWorkflow(runStore, artifactStore, approvalService, new CodexManualAdapter());

    const result = await workflow.runNext(config.runId);
    expect(result).toMatchObject({
      status: "manual_action_required",
      roleId: "corpus-ingest",
      artifactId: "source-map"
    });
    if (result.status !== "manual_action_required") {
      throw new Error("expected manual action");
    }
    const prompt = await readFile(result.promptPath, "utf8");
    expect(prompt).toContain("SourceMap");
    expect(prompt).toContain("SourceAnchor");
    expect(prompt).toContain("runs/hash-table-manual-corpus/artifacts/");
    expect(prompt).toContain("npm run agent:submit -- --run hash-table-manual-corpus --artifact source-map");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/codex-manual-corpus.test.ts
```

Expected: fail because the prompt is generic and does not mention `SourceMap` or `SourceAnchor`.

- [ ] **Step 3: Add role-specific prompt sections**

Modify `tools/agent-runtime/adapters/codex-manual-adapter.ts`.

Add this helper below `renderPrompt()`:

```ts
function roleSpecificInstructions(roleId: string, artifactId: string): string {
  if (artifactId === "source-map") {
    return `## Output Contract

Return a SourceMap JSON object with:

- corpusId
- sources
- structure
- anchors
- extractionNotes

Every source-derived item must have a SourceAnchor. For topic-only sources, create a heading anchor such as source-001:topic.
`;
  }
  if (artifactId === "concept-map") {
    return `## Output Contract

Return a ConceptMap JSON object with:

- concepts
- dependencies
- misconceptions
- examples

Every concept, edge, misconception, and source example must include sourceAnchorIds. Mark inferred teaching concepts with inferred: true.
`;
  }
  if (artifactId === "curriculum-plan") {
    return `## Output Contract

Return a CurriculumPlan JSON object with:

- mode
- userProfile
- coveragePolicy
- units
- sourceCoverage
- conceptCoverage
- rationale

Use the selected curriculumPlanningMode from the run config. Preserve preferredPageCountPerUnit when defining unit targetPageCount.
`;
  }
  return `## Output Contract

Return one valid JSON object for artifact ${artifactId}. Keep output Chinese-first and preserve the requested page count when planning or assembling lesson pages.
`;
}
```

Then insert this into `renderPrompt()` after the `## Role` block:

```ts
${roleSpecificInstructions(roleId, artifactId)}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/codex-manual-corpus.test.ts tools/agent-runtime/__tests__/codex-manual.test.ts
npm run typecheck
npm run lint
```

Expected: tests, typecheck, and lint pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add tools/agent-runtime/adapters/codex-manual-adapter.ts tools/agent-runtime/__tests__/codex-manual-corpus.test.ts
git commit -m "feat: add corpus prompts for codex manual"
```

---

### Task 5: Documentation And Runner Skill Updates

**Files:**
- Modify: `docs/runtime/run-config.schema.md`
- Modify: `docs/runtime/agent-role-contracts.md`
- Modify: `docs/runtime/artifact-contracts.md`
- Modify: `README.md`
- Modify: `skills/learning-agent-runner/SKILL.md`

- [ ] **Step 1: Update run config docs**

Modify `docs/runtime/run-config.schema.md`.

Add a section after the existing run config example:

```md
## Corpus-To-Curriculum Fields

The runner now treats `topic` as shorthand for a one-item source corpus.

Current defaults:

- `sources`: one topic source with id `source-001`
- `userLearningProfile.level`: `basic`
- `userLearningProfile.readingHabit`: `visual_first`
- `userLearningProfile.goal`: `understand`
- `curriculumPlanningMode`: `hybrid`
- `coveragePolicy.requiredCoverage`: `core_concepts`

The first corpus slice is still local-runner only. It does not parse PDF files, run OCR, or call provider APIs.
```

- [ ] **Step 2: Update role docs**

Modify `docs/runtime/agent-role-contracts.md`.

Add roles before the existing lesson roles:

```md
### `corpus-ingest`

Produces `source-map`. It normalizes configured sources, preserves source structure, and creates source anchors.

### `concept-mapper`

Produces `concept-map`. It extracts teaching-relevant concepts, prerequisites, examples, misconceptions, and dependency edges with source anchors.

### `curriculum-planner`

Produces `curriculum-plan`. It applies the selected curriculum planning mode, user learning profile, and coverage policy to produce learning unit plans.
```

- [ ] **Step 3: Update artifact docs**

Modify `docs/runtime/artifact-contracts.md`.

Add artifact entries:

```md
### `source-map`

Versioned artifact: `artifacts/source-map.vN.json`

Approved alias: `artifacts/source-map.approved.json`

Purpose: preserve corpus structure and source anchors.

### `concept-map`

Versioned artifact: `artifacts/concept-map.vN.json`

Approved alias: `artifacts/concept-map.approved.json`

Purpose: capture source-grounded teaching concepts and dependencies.

### `curriculum-plan`

Versioned artifact: `artifacts/curriculum-plan.vN.json`

Approved alias: `artifacts/curriculum-plan.approved.json`

Purpose: define learning units using the selected planning mode and user profile.
```

- [ ] **Step 4: Update README runner flow**

Modify `README.md` in the Codex Agent Runner section.

Add:

```md
The runner now begins with corpus-level gates:

1. `source-map`
2. `concept-map`
3. `curriculum-plan`

After those are approved, the existing lesson-level generation roles run for the selected learning unit.
```

- [ ] **Step 5: Update runner skill**

Modify `skills/learning-agent-runner/SKILL.md`.

Add to Workflow after the first `agent:run` command:

```md
The first gates are corpus-level:

- `source-map`
- `concept-map`
- `curriculum-plan`

Inspect and approve each of these before expecting lesson-level artifacts such as `learning-architecture` or `lesson`.
```

- [ ] **Step 6: Verify documentation**

Run:

```bash
rg "source-map|concept-map|curriculum-plan|curriculumPlanningMode|userLearningProfile" README.md docs/runtime skills/learning-agent-runner/SKILL.md
npm run typecheck
npm run lint
```

Expected: search returns matches and typecheck/lint pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add README.md docs/runtime/run-config.schema.md docs/runtime/agent-role-contracts.md docs/runtime/artifact-contracts.md skills/learning-agent-runner/SKILL.md
git commit -m "docs: document corpus workflow gates"
```

---

### Task 6: End-To-End Verification

**Files:**
- No new source files required.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected:

```text
typecheck exits 0
lint exits 0
all tests pass
build exits 0
```

- [ ] **Step 2: Run a complete mock corpus-gate smoke path**

Run:

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN --run corpus-slice-smoke
npm run agent:run -- --run corpus-slice-smoke
npm run agent:run -- --run corpus-slice-smoke
npm run agent:approve -- --run corpus-slice-smoke --gate source-map --version v1 --notes "source map ok"
npm run agent:resume -- --run corpus-slice-smoke
npm run agent:approve -- --run corpus-slice-smoke --gate concept-map --version v1 --notes "concept map ok"
npm run agent:resume -- --run corpus-slice-smoke
npm run agent:approve -- --run corpus-slice-smoke --gate curriculum-plan --version v1 --notes "curriculum plan ok"
npm run agent:resume -- --run corpus-slice-smoke
```

Expected:

```text
runs/corpus-slice-smoke/artifacts/source-map.v1.json exists
runs/corpus-slice-smoke/artifacts/concept-map.v1.json exists
runs/corpus-slice-smoke/artifacts/curriculum-plan.v1.json exists
after curriculum approval, resume writes source-ingest or reaches the next unit-level role
```

- [ ] **Step 3: Inspect config and artifacts**

Run:

```bash
node -e "const c=require('./runs/corpus-slice-smoke/run.config.json'); console.log(c.curriculumPlanningMode, c.userLearningProfile.level, c.sources.length)"
node -e "const p=require('./runs/corpus-slice-smoke/artifacts/curriculum-plan.v1.json'); console.log(p.mode, p.units.length, p.units[0].targetPageCount)"
```

Expected:

```text
hybrid basic 1
hybrid 1 8
```

- [ ] **Step 4: Run a codex-manual prompt smoke path**

Run:

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN --adapter codex-manual --run corpus-manual-smoke
npm run agent:run -- --run corpus-manual-smoke
test -f runs/corpus-manual-smoke/manual-requests/source-map.md
rg "SourceMap|SourceAnchor|agent:submit" runs/corpus-manual-smoke/manual-requests/source-map.md
```

Expected:

```text
agent:run returns manual_action_required for source-map
source-map.md exists
rg finds SourceMap, SourceAnchor, and agent:submit
```

- [ ] **Step 5: Commit verification notes if any tracked docs changed**

Run:

```bash
git status --short
```

Expected: no tracked source changes. `runs/` should remain ignored.

If documentation was adjusted during verification, commit it:

```bash
git add README.md docs/runtime skills/learning-agent-runner/SKILL.md
git commit -m "docs: clarify corpus workflow verification"
```

---

## Self-Review

Spec coverage:

- Source corpus input: Task 1 adds `sources` and preserves topic shorthand.
- User learning profile: Task 1 adds `userLearningProfile` defaults and validation.
- Planning modes: Task 1 adds `curriculumPlanningMode`, default `hybrid`, and validation.
- Source grounding: Task 3 adds mock `source-map` anchors and source-grounded `concept-map`.
- Corpus artifacts: Tasks 2 and 3 add `source-map`, `concept-map`, and `curriculum-plan` roles and artifacts.
- Approval gates: Task 2 adds corpus-level gates before unit generation.
- Codex manual: Task 4 adds role-specific corpus prompts.
- Docs: Task 5 updates runner, role, artifact, and config docs.
- E2E verification: Task 6 covers full automated checks plus mock and manual smoke paths.

Known constraints:

- This plan does not parse real PDFs or folders.
- This plan does not add CLI flags for level, reading habit, goal, or planning mode. Those fields are added with defaults first; user-facing flags should be a later slice.
- This plan does not generate multiple learning units yet. It creates a single unit in the curriculum plan to validate the new architecture without disrupting existing lesson generation.
