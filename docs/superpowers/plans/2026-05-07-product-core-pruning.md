# Product Core Pruning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide non-core product, MCP, skills, UI, and documentation surfaces so the default experience is the learner golden path.

**Architecture:** Keep existing runtime services and future-mode code in place, but add explicit profiles and default presentation rules. The learner profile becomes the default MCP and documentation surface; authoring and operator capabilities remain available through explicit advanced paths.

**Tech Stack:** TypeScript, Vitest, React, Vite, Markdown docs, existing MCP JSON-RPC server.

---

## Files

- Create: `docs/product/product-core.md`
- Create: `docs/archive/development-history.md`
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/json-rpc-server.ts`
- Modify: `tools/mcp-server/index.ts`
- Modify: `tools/mcp-server/json-rpc-server.test.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`
- Modify: `scripts/learning-agent-bundle.ts`
- Modify: `scripts/learning-agent-bundle.test.ts`
- Modify: `README.md`
- Modify: `docs/runtime/mcp-skills-bundle.md`
- Modify: `docs/runtime/seed-user-beta-quickstart.md`
- Modify: `docs/runtime/codex-user-trial-script.md`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `src/product/ProductModeTabs.tsx`
- Modify: `src/product/LearningSidebar.tsx`
- Modify: `src/product/CourseWorkspace.test.tsx`
- Modify: `src/renderers/LearningProductRenderer.test.tsx`

## Task 1: MCP Tool Profiles

**Purpose:** Make the learner profile the default MCP tool surface while preserving advanced tools behind explicit profiles.

**Files:**
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/json-rpc-server.ts`
- Modify: `tools/mcp-server/index.ts`
- Modify: `tools/mcp-server/json-rpc-server.test.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`

- [ ] **Step 1: Write failing tool-profile tests**

Add these tests to `tools/mcp-server/json-rpc-server.test.ts`:

```ts
test("tools/list defaults to the learner profile", async () => {
  const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "mcp-profile-")));
  const response = await handleMcpRequest(
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    tools
  );

  expect(response).toMatchObject({ jsonrpc: "2.0", id: 1 });
  const toolNames = toolNamesFromResponse(response);
  expect(toolNames).toEqual([
    "learning_agent.prepare_learning_course",
    "learning_agent.list_learning_projects",
    "learning_agent.archive_learning_project",
    "learning_agent.publish_learning_course",
    "learning_agent.get_learning_preview",
    "learning_agent.revise_learning_course",
    "learning_agent.apply_learning_revision",
    "learning_agent.export_learning_course"
  ]);
  expect(toolNames).not.toContain("learning_agent.plan_run");
  expect(toolNames).not.toContain("learning_agent.generate_quick_preview");
});

test("tools/list can expose operator tools through an explicit profile", async () => {
  const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "mcp-profile-")));
  const response = await handleMcpRequest(
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    tools,
    "operator"
  );

  const toolNames = toolNamesFromResponse(response);
  expect(toolNames).toContain("learning_agent.prepare_learning_course");
  expect(toolNames).toContain("learning_agent.plan_run");
  expect(toolNames).toContain("learning_agent.read_artifact");
  expect(toolNames).toContain("learning_agent.promote_units");
});

function toolNamesFromResponse(response: Awaited<ReturnType<typeof handleMcpRequest>>): string[] {
  if (!response || !("result" in response)) {
    throw new Error("expected tools/list result");
  }
  const result = response.result as { tools: Array<{ name: string }> };
  return result.tools.map((tool) => tool.name);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run tools/mcp-server/json-rpc-server.test.ts --pool threads
```

Expected result:

```text
FAIL default list still includes advanced tools or handleMcpRequest does not accept a profile argument.
```

- [ ] **Step 3: Add profile definitions and filtering**

In `tools/mcp-server/tool-contracts.ts`, add:

```ts
export type LearningAgentToolProfile = "learner" | "authoring" | "operator";

const learnerToolNames = [
  "learning_agent.prepare_learning_course",
  "learning_agent.list_learning_projects",
  "learning_agent.archive_learning_project",
  "learning_agent.publish_learning_course",
  "learning_agent.get_learning_preview",
  "learning_agent.revise_learning_course",
  "learning_agent.apply_learning_revision",
  "learning_agent.export_learning_course"
] satisfies LearningAgentToolName[];

const authoringToolNames = [
  ...learnerToolNames,
  "learning_agent.create_learning_project",
  "learning_agent.get_authoring_context",
  "learning_agent.compare_authoring_quality",
  "learning_agent.create_quality_revision",
  "learning_agent.generate_grounded_course"
] satisfies LearningAgentToolName[];

export function learningAgentToolContractsForProfile(
  profile: LearningAgentToolProfile = "learner"
): LearningAgentToolContract[] {
  if (profile === "operator") {
    return learningAgentToolContracts;
  }

  const allowed = new Set(profile === "authoring" ? authoringToolNames : learnerToolNames);
  return learningAgentToolContracts.filter((tool) => allowed.has(tool.name));
}
```

- [ ] **Step 4: Use profile filtering in JSON-RPC**

Change the import in `tools/mcp-server/json-rpc-server.ts`:

```ts
import { learningAgentToolContractsForProfile, type LearningAgentToolProfile } from "./tool-contracts.js";
```

Change the function signature:

```ts
export async function handleMcpRequest(
  request: JsonRpcRequest,
  tools: LearningAgentRuntimeTools,
  profile: LearningAgentToolProfile = "learner"
): Promise<JsonRpcResponse | undefined> {
```

Change the `tools/list` branch:

```ts
case "tools/list":
  return result(id, { tools: learningAgentToolContractsForProfile(profile) });
```

Change `handleMcpLine` to accept and forward the profile:

```ts
export async function handleMcpLine(
  line: string,
  tools: LearningAgentRuntimeTools,
  profile: LearningAgentToolProfile = "learner"
): Promise<string | undefined> {
  // existing parsing logic
  const response = await handleMcpRequest(expectRecord(parsed, "JSON-RPC request") as JsonRpcRequest, tools, profile);
  return response ? JSON.stringify(response) : undefined;
}
```

- [ ] **Step 5: Add CLI/env profile selection**

In `tools/mcp-server/index.ts`, import the type:

```ts
import type { LearningAgentToolProfile } from "./tool-contracts.js";
```

Add this helper:

```ts
function selectedProfile(argv: string[], env: NodeJS.ProcessEnv): LearningAgentToolProfile {
  const flagIndex = argv.findIndex((value) => value === "--profile");
  const raw = flagIndex >= 0 ? argv[flagIndex + 1] : env.LEARNING_AGENT_MCP_PROFILE;
  if (raw === "authoring" || raw === "operator" || raw === "learner") {
    return raw;
  }
  return "learner";
}
```

Use it in `main()`:

```ts
const profile = selectedProfile(process.argv, process.env);

if (process.argv.includes("--list-tools")) {
  console.log(JSON.stringify({ tools: learningAgentToolContractsForProfile(profile) }, null, 2));
  return;
}
```

When reading stdin:

```ts
const response = await handleMcpLine(line, tools, profile);
```

- [ ] **Step 6: Add runtime-tools contract expectation**

In `tools/mcp-server/runtime-tools.test.ts`, add a test that direct calls still support an operator tool. This proves hidden-first did not delete runtime capability:

```ts
test("direct runtime tool handler still supports operator tools", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
  const tools = new LearningAgentRuntimeTools(root);

  const result = await tools.callTool("learning_agent.plan_run", {
    request: "请用 /tmp/book.pdf 生成中文学习课程，面向中文工程师，教学难度为本科核心课程，每个单元 8 页。",
    runId: "operator-plan-still-supported"
  });

  expect(result).toMatchObject({
    status: "plan_ready",
    runId: "operator-plan-still-supported"
  });
});
```

- [ ] **Step 7: Verify profile behavior**

Run:

```bash
npx vitest run tools/mcp-server/json-rpc-server.test.ts tools/mcp-server/runtime-tools.test.ts --pool threads
npm run mcp -- --list-tools
npm run mcp -- --list-tools --profile operator
```

Expected:

```text
Vitest passes.
Default list contains learner tools only.
Operator list contains plan_run, read_artifact, and promote_units.
```

- [ ] **Step 8: Commit MCP profile changes**

Run:

```bash
git add tools/mcp-server/tool-contracts.ts tools/mcp-server/json-rpc-server.ts tools/mcp-server/index.ts tools/mcp-server/json-rpc-server.test.ts tools/mcp-server/runtime-tools.test.ts
git commit -m "Add learner MCP tool profile"
```

## Task 2: Default Bundle, Skills, and Runtime Docs

**Purpose:** Make Codex and open-source users see one default learner path.

**Files:**
- Create: `docs/product/product-core.md`
- Modify: `scripts/learning-agent-bundle.ts`
- Modify: `scripts/learning-agent-bundle.test.ts`
- Modify: `README.md`
- Modify: `docs/runtime/mcp-skills-bundle.md`
- Modify: `docs/runtime/seed-user-beta-quickstart.md`
- Modify: `docs/runtime/codex-user-trial-script.md`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `skills/source-to-course/SKILL.md`

- [ ] **Step 1: Write bundle tests for default surface**

In `scripts/learning-agent-bundle.test.ts`, update the installable surface test:

```ts
expect(manifest.requiredSkills.map((skill) => skill.name)).toEqual([
  "learning-agent-operator",
  "source-to-course",
  "learner-feedback-revision"
]);

expect(manifest.learnerToolFlow).toEqual([
  "learning_agent.prepare_learning_course",
  "learning_agent.publish_learning_course",
  "learning_agent.get_learning_preview",
  "learning_agent.revise_learning_course",
  "learning_agent.apply_learning_revision",
  "learning_agent.export_learning_course"
]);
expect(manifest.learnerToolFlow).not.toContain("learning_agent.compare_authoring_quality");
```

Add checks for the new product-core doc:

```ts
expect(manifest.docs).toContain("docs/product/product-core.md");
expect(report.checked).toContain("docs/product/product-core.md");
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run scripts/learning-agent-bundle.test.ts --pool threads
```

Expected:

```text
FAIL because learning-agent-runner is still a default required skill or docs/product/product-core.md is not bundled.
```

- [ ] **Step 3: Add product core doc**

Create `docs/product/product-core.md`:

```md
# Product Core

The default product is a Chinese interactive learning loop:

1. Clarify source, audience, difficulty, structure, and pages per unit.
2. Prepare a source-backed course plan through `learning_agent.prepare_learning_course`.
3. Let Codex, Claude, or another capable agent author `coursePack` and `lessons`.
4. Publish and preview through `learning_agent.publish_learning_course` and `learning_agent.get_learning_preview`.
5. Learn one screen at a time with visuals, learner actions, checks, and feedback.
6. Revise through `learning_agent.revise_learning_course` and `learning_agent.apply_learning_revision`.
7. Export through `learning_agent.export_learning_course`.

Internal by default:

- artifact approvals
- deterministic drafts
- source-map and concept-map review gates
- benchmark comparisons
- child unit promotion
- tutor, teacher, playground, and canvas experiments
```

- [ ] **Step 4: Update bundle manifest**

In `scripts/learning-agent-bundle.ts`, remove `learning-agent-runner` from `requiredSkills` and remove `learning_agent.compare_authoring_quality` from `learnerToolFlow`:

```ts
const requiredSkills = [
  "learning-agent-operator",
  "source-to-course",
  "learner-feedback-revision"
] as const;

const learnerToolFlow = [
  "learning_agent.prepare_learning_course",
  "learning_agent.publish_learning_course",
  "learning_agent.get_learning_preview",
  "learning_agent.revise_learning_course",
  "learning_agent.apply_learning_revision",
  "learning_agent.export_learning_course"
];
```

Add `docs/product/product-core.md` to `requiredDocs`.

- [ ] **Step 5: Rewrite default docs to prepare-first**

Update `README.md`, `docs/runtime/mcp-skills-bundle.md`, `docs/runtime/seed-user-beta-quickstart.md`, and `docs/runtime/codex-user-trial-script.md` so the default flow is:

```text
prepare_learning_course -> publish_learning_course -> get_learning_preview -> revise/apply_revision -> export
```

Use these exact labels:

```text
Default learner profile
Advanced authoring profile
Operator profile
```

Move mentions of `generate_grounded_course`, `generate_quick_preview`, `plan_run`, and approval gates under explicit advanced sections.

- [ ] **Step 6: Update skills to one default path**

In `skills/learning-agent-operator/SKILL.md` and `skills/source-to-course/SKILL.md`, ensure the default workflow section contains this order only:

```json
{"method":"tools/call","params":{"name":"learning_agent.prepare_learning_course","arguments":{"request":"<Chinese learner request with source, audience, difficulty, strategy, and unitPages>"}}}
{"method":"tools/call","params":{"name":"learning_agent.publish_learning_course","arguments":{"runId":"<run-id>","coursePack":{},"lessons":[]}}}
{"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"<run-id>"}}}
```

Keep `compare_authoring_quality`, deterministic drafts, and artifact gates in sections titled `Advanced Authoring` or `Operator Mode`.

- [ ] **Step 7: Verify bundle and docs**

Run:

```bash
npx vitest run scripts/learning-agent-bundle.test.ts tools/mcp-server/skill-mcp-contract.test.ts --pool threads
npm run bundle:check
rg -n "generate_quick_preview|plan_run|approve_gate" README.md docs/runtime/seed-user-beta-quickstart.md skills/learning-agent-operator/SKILL.md skills/source-to-course/SKILL.md
```

Expected:

```text
Tests pass.
bundle:check ok=true.
Any matches for advanced tools appear only under advanced or operator sections.
```

- [ ] **Step 8: Commit docs and skills surface changes**

Run:

```bash
git add docs/product/product-core.md scripts/learning-agent-bundle.ts scripts/learning-agent-bundle.test.ts README.md docs/runtime/mcp-skills-bundle.md docs/runtime/seed-user-beta-quickstart.md docs/runtime/codex-user-trial-script.md skills/learning-agent-operator/SKILL.md skills/source-to-course/SKILL.md
git commit -m "Prune default learner documentation surface"
```

## Task 3: Default Learning UI Navigation

**Purpose:** Keep future product modes implemented, but remove them from default navigation.

**Files:**
- Modify: `src/product/ProductModeTabs.tsx`
- Modify: `src/product/LearningSidebar.tsx`
- Modify: `src/product/CourseWorkspace.test.tsx`
- Modify: `src/renderers/LearningProductRenderer.test.tsx`

- [ ] **Step 1: Write failing sidebar tests**

In `src/product/CourseWorkspace.test.tsx`, add:

```tsx
test("default sidebar shows the learner core views and hides future modes", async () => {
  render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

  expect(screen.getByRole("button", { name: "学习" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "来源依据" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "项目库" })).toBeInTheDocument();

  expect(screen.queryByRole("button", { name: "知识地图" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "教师" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "实验" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "导师" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/product/CourseWorkspace.test.tsx --pool threads
```

Expected:

```text
FAIL because knowledge map, teacher, playground, and tutor buttons are currently visible.
```

- [ ] **Step 3: Split core and experimental mode tabs**

In `src/product/ProductModeTabs.tsx`, replace `productModeTabs` with:

```ts
export const defaultProductModeTabs: ProductModeTab[] = [
  { id: "deck", label: "学习", description: "逐页互动课件", icon: Presentation }
];

export const experimentalProductModeTabs: ProductModeTab[] = [
  { id: "map", label: "知识地图", description: "概念与来源结构", icon: Map },
  { id: "assessment", label: "练习", description: "测验与反馈", icon: ClipboardCheck },
  { id: "teacher", label: "教师", description: "教学提纲与课堂问题", icon: School },
  { id: "playground", label: "实验", description: "操作模型与观察", icon: Beaker },
  { id: "tutor", label: "导师", description: "页面驱动辅导", icon: Bot }
];

export const productModeTabs: ProductModeTab[] = [
  ...defaultProductModeTabs,
  ...experimentalProductModeTabs
];
```

Keep `ProductModeTabs` rendering `productModeTabs` so existing component-level tests for experimental renderers still pass.

- [ ] **Step 4: Render only default tabs in the sidebar**

In `src/product/LearningSidebar.tsx`, change the import:

```ts
import { defaultProductModeTabs, type CourseView } from "./ProductModeTabs";
```

Change the nav loop:

```tsx
{defaultProductModeTabs.map((tab) => {
  const Icon = tab.icon;
  return (
    <button
      aria-label={tab.label}
      aria-pressed={activeView === tab.id}
      className={navButtonClass(activeView === tab.id)}
      key={tab.id}
      onClick={() => onSelectView(tab.id)}
      type="button"
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{tab.label}</span>
        <span className="block truncate text-xs font-medium text-slate-500">{tab.description}</span>
      </span>
    </button>
  );
})}
```

- [ ] **Step 5: Keep future renderers tested**

Do not delete `LearningProductRenderer` tests. Run:

```bash
npx vitest run src/renderers/LearningProductRenderer.test.tsx src/product/CourseWorkspace.test.tsx --pool threads
```

Expected:

```text
Both test files pass. Experimental modes still render when called directly, but they are not visible in the default sidebar.
```

- [ ] **Step 6: Commit UI pruning**

Run:

```bash
git add src/product/ProductModeTabs.tsx src/product/LearningSidebar.tsx src/product/CourseWorkspace.test.tsx src/renderers/LearningProductRenderer.test.tsx
git commit -m "Hide experimental modes from default learning navigation"
```

## Task 4: Archive Historical Planning Surface

**Purpose:** Make historical docs discoverable without making them part of the default product narrative.

**Files:**
- Create: `docs/archive/development-history.md`
- Modify: `README.md`

- [ ] **Step 1: Create archive index**

Create `docs/archive/development-history.md`:

```md
# Development History

This repository includes planning and design records created while the product shape was still being explored.

Current product truth lives in:

- `README.md`
- `docs/product/product-core.md`
- `docs/runtime/seed-user-beta-quickstart.md`
- `docs/runtime/codex-authoring-protocol-v2.md`
- `docs/runtime/real-source-quality-benchmark.md`

Historical planning records live under:

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`

Use historical records for context only. They are not the default user workflow, public product promise, or current implementation order.
```

- [ ] **Step 2: Update README project structure**

In `README.md`, ensure `docs/superpowers` is described as development history:

```text
docs/
  product/             Current product definition and core learner loop
  runtime/             MCP, Codex, source grounding, preview, and export guides
  archive/             How to interpret historical planning documents
  superpowers/         Historical specs and implementation plans from development
```

- [ ] **Step 3: Verify no default docs make old plans authoritative**

Run:

```bash
rg -n "docs/superpowers|plan_run|init_from_plan|source-map|concept-map|curriculum-plan" README.md docs/product docs/runtime
```

Expected:

```text
Matches either appear in archive/history context or advanced/operator context, not in the default learner path.
```

- [ ] **Step 4: Commit archive surface changes**

Run:

```bash
git add docs/archive/development-history.md README.md
git commit -m "Archive historical planning surface"
```

## Task 5: Final Verification and Codex Bundle Refresh

**Purpose:** Prove hidden-first pruning did not break the runtime, build, or Codex installation path.

**Files:**
- No new source files.

- [ ] **Step 1: Run targeted profile and UI tests**

Run:

```bash
npx vitest run tools/mcp-server/json-rpc-server.test.ts tools/mcp-server/runtime-tools.test.ts scripts/learning-agent-bundle.test.ts src/product/CourseWorkspace.test.tsx src/renderers/LearningProductRenderer.test.tsx --pool threads
```

Expected:

```text
All listed test files pass.
```

- [ ] **Step 2: Run stable project gate**

Run:

```bash
npm run test:ci
```

Expected:

```text
Typecheck, lint, stable unit tests, production build, and bundle check pass.
```

- [ ] **Step 3: Verify profile output manually**

Run:

```bash
npm run mcp -- --list-tools
npm run mcp -- --list-tools --profile authoring
npm run mcp -- --list-tools --profile operator
```

Expected:

```text
Default output does not include plan_run, read_artifact, generate_quick_preview, promote_units, or promote_lesson.
Authoring output includes get_authoring_context and compare_authoring_quality.
Operator output includes all advanced tools.
```

- [ ] **Step 4: Refresh installed Codex bundle**

Run:

```bash
npm run codex:bundle:install
npm run codex:mcp:check
```

Expected:

```text
Codex MCP config is installed and skill bundle installation completes.
Codex must be restarted or a new Codex session opened to load the new default profile.
```

- [ ] **Step 5: Check git cleanliness**

Run:

```bash
git diff --check
git status --short --branch
```

Expected:

```text
git diff --check exits 0.
Only intentional pruning changes are present before the final commit.
```

- [ ] **Step 6: Final commit**

Run:

```bash
git add tools/mcp-server scripts README.md docs skills src
git commit -m "Prune default product surface"
```

## Final Acceptance

- Default MCP tool list contains only learner-profile tools.
- Authoring and operator profiles remain explicitly available.
- Codex bundle installs only default learner skills.
- README and runtime docs present one learner golden path.
- Sidebar default navigation hides future modes.
- Future mode renderers still pass their direct tests.
- Historical planning docs are described as development history.
- `npm run test:ci` passes.

