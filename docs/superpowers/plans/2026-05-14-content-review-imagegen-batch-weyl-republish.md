# Content Review, Imagegen Batch, and Weyl Republish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-round Codex-facing content review loop, a semi-automated imagegen asset batch workflow, and then use both to republish the Weyl self-study course as an overview plus 3-5 core topic units.

**Architecture:** MCP remains the validation and file-orchestration layer; Codex remains the authoring, critique, and image generation agent. The new content review service creates round-specific critic briefs and records review state; the new imagegen batch service creates prompt manifests, records generated asset paths, validates preview assets, and can republish updated lesson JSON. Weyl republish is a seeded end-to-end acceptance run using these two services.

**Tech Stack:** TypeScript, Vitest, existing `LearningAgentRuntimeTools`, existing preview JSON layout under `runs/<runId>/preview`, existing `publish_learning_course`, Vite preview asset serving, Codex `image_gen` tool.

---

## Execution Status

- Tasks 1-6 implemented on 2026-05-14.
- Task 7 remains the Weyl v2 acceptance run after implementation verification.

---

## File Structure

- Create `tools/agent-runtime/learner/content-review-service.ts`
  - Reads preview course bundles and quality reports.
  - Creates `runs/<runId>/quality/content-review/round-00N-brief.json`.
  - Returns a Codex instruction for one strict reviewer round.
  - Stops after three rounds unless configured lower.

- Create `tools/agent-runtime/learner/content-review-service.test.ts`
  - Covers round progression, stop behavior, critic prompt shape, and target extraction.

- Create `tools/agent-runtime/learner/imagegen-asset-batch-service.ts`
  - Creates image prompt manifests from preview lesson JSON.
  - Records generated image files into preview image folders.
  - Updates lesson `visualSpec.imageUrl`, `imageAlt`, `imageProvider`, and `imagePrompt`.
  - Validates missing images, SVG references, unsafe prompts, and missing files.

- Create `tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts`
  - Covers manifest creation, asset recording, lesson JSON rewrite, and validation failures.

- Modify `tools/agent-runtime/index.ts`
  - Export both new services.

- Modify `tools/mcp-server/tool-contracts.ts`
  - Add tools:
    - `learning_agent.prepare_content_review`
    - `learning_agent.create_imagegen_manifest`
    - `learning_agent.record_imagegen_asset`
    - `learning_agent.validate_imagegen_assets`

- Modify `tools/mcp-server/runtime-tools.ts`
  - Route the four new tools to the services.

- Modify MCP tests:
  - `tools/mcp-server/runtime-tools.test.ts`
  - `tools/mcp-server/json-rpc-server.test.ts`
  - `tools/mcp-server/skill-mcp-contract.test.ts`

- Modify workflow docs/skills:
  - `skills/learning-agent-operator/SKILL.md`
  - `skills/source-to-course/SKILL.md`
  - `docs/runtime/imagegen-teaching-illustration-policy.md`
  - `docs/runtime/self-study-golden-samples.md`

- Create Weyl acceptance artifact after implementation:
  - `docs/runtime/weyl-republish-acceptance.md`

---

## Task 1: Content Review Service

**Files:**
- Create: `tools/agent-runtime/learner/content-review-service.ts`
- Create: `tools/agent-runtime/learner/content-review-service.test.ts`
- Modify: `tools/agent-runtime/index.ts`

- [ ] **Step 1: Write failing tests for round 1 brief generation**

Add this test file:

```ts
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ContentReviewService } from "./content-review-service.js";

describe("ContentReviewService", () => {
  test("creates round 1 critic brief from the published preview bundle", async () => {
    const root = await fixtureRoot("review-course");

    const result = await new ContentReviewService(root).prepareReview({ runId: "review-course" });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "review-course",
      round: 1,
      maxRounds: 3,
      reviewBriefPath: expect.stringContaining("round-001-content-review.json")
    });
    expect(result.codexInstruction).toContain("第 1 / 3 轮内容审核");
    expect(result.codexInstruction).toContain("挑刺");
    expect(result.codexInstruction).toContain("不要改 coursePack.units");

    const brief = JSON.parse(await readFile(result.reviewBriefPath, "utf8")) as Record<string, unknown>;
    expect(brief).toMatchObject({
      runId: "review-course",
      round: 1,
      maxRounds: 3,
      criticRole: "content-review-agent",
      targetQuality: {
        minScore: 90,
        learnerMode: "student_self_study_textbook"
      }
    });
  });
});

async function fixtureRoot(runId: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-review-"));
  const previewRoot = path.join(root, "runs", runId, "preview");
  await mkdir(path.join(previewRoot, "lessons"), { recursive: true });
  await mkdir(path.join(root, "runs", runId, "quality"), { recursive: true });
  await writeFile(
    path.join(previewRoot, "course-pack.json"),
    JSON.stringify(
      {
        id: runId,
        title: "测试课程",
        language: "zh-CN",
        units: [{ unitId: "unit-overview", title: "总览", kind: "overview", lessonId: "lesson-a", targetPageCount: 2 }]
      },
      null,
      2
    )
  );
  await writeFile(
    path.join(previewRoot, "lessons", "lesson-a.json"),
    JSON.stringify(
      {
        id: "lesson-a",
        title: "测试课程总览",
        displayMode: "textbook_deck",
        pages: [
          {
            id: "page-01",
            title: "第一条知识命题",
            narrative: "中文解释。",
            sourceAnchorIds: ["book:p1"],
            knowledgeBoard: {
              headline: "第一条知识命题",
              coreProposition: "这页要讲清一个具体知识关系。",
              leftColumn: [{ label: "关键关系", items: ["一个机制", "一个变化"] }],
              rightColumn: [{ label: "例子边界", items: ["例如一个场景", "边界是另一个场景"] }],
              sourceTrace: [{ anchorId: "book:p1", supports: "来源支持这个命题。" }],
              bottomLine: "记住这个知识关系。"
            }
          }
        ]
      },
      null,
      2
    )
  );
  await writeFile(
    path.join(root, "runs", runId, "quality", "course-quality-report.json"),
    JSON.stringify({ status: "warning", score: 85, topIssues: [] }, null, 2)
  );
  return root;
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/content-review-service.test.ts
```

Expected: fail with `Cannot find module './content-review-service.js'`.

- [ ] **Step 3: Implement minimal content review service**

Create `tools/agent-runtime/learner/content-review-service.ts`:

```ts
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";

export type PrepareContentReviewInput = {
  runId: string;
  maxRounds?: number;
  minScore?: number;
};

export type PrepareContentReviewResult =
  | {
      status: "revision_required";
      runId: string;
      round: number;
      maxRounds: number;
      reviewBriefPath: string;
      codexInstruction: string;
    }
  | {
      status: "review_complete";
      runId: string;
      round: number;
      maxRounds: number;
      stopReason: string;
    };

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

export class ContentReviewService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async prepareReview(input: PrepareContentReviewInput): Promise<PrepareContentReviewResult> {
    assertSafeRunId(input.runId);
    const maxRounds = normalizeMaxRounds(input.maxRounds);
    const completedRounds = await this.countReviewRounds(input.runId);
    if (completedRounds >= maxRounds) {
      return {
        status: "review_complete",
        runId: input.runId,
        round: completedRounds,
        maxRounds,
        stopReason: "max review rounds reached; use the latest revised bundle for publishing"
      };
    }

    const round = completedRounds + 1;
    const coursePack = await this.readPreviewJson(input.runId, "course-pack.json");
    const lessonPaths = await this.listLessonPaths(input.runId);
    const lessons = await Promise.all(lessonPaths.map((lessonPath) => this.readPreviewJson(input.runId, `lessons/${lessonPath}`)));
    const quality = await this.readQuality(input.runId);
    const brief = {
      runId: input.runId,
      round,
      maxRounds,
      criticRole: "content-review-agent",
      targetQuality: {
        minScore: input.minScore ?? 90,
        learnerMode: inferLearnerMode(lessons)
      },
      reviewPrinciples: [
        "挑刺优先：指出内容泛、跳步、低密度、模板化、图文不匹配的位置。",
        "学生自学优先：每页必须能让学生获得一个明确知识判断。",
        "来源优先：source-backed 页面必须讲出来源材料的具体概念或关系。",
        "第三轮产出优先：第 3 轮只保留可发布内容，不保留批注过程。"
      ],
      coursePack,
      lessons,
      quality
    };
    const reviewBriefPath = await this.writeBrief(input.runId, round, brief);
    return {
      status: "revision_required",
      runId: input.runId,
      round,
      maxRounds,
      reviewBriefPath,
      codexInstruction: buildCodexInstruction(input.runId, round, maxRounds, reviewBriefPath)
    };
  }

  private async readPreviewJson(runId: string, relativePath: string): Promise<unknown> {
    return JSON.parse(await readFile(path.join(this.previewRoot(runId), relativePath), "utf8")) as unknown;
  }

  private async readQuality(runId: string): Promise<unknown> {
    const qualityPath = path.join(this.runRoot(runId), "quality", "course-quality-report.json");
    return JSON.parse(await readFile(qualityPath, "utf8")) as unknown;
  }

  private async listLessonPaths(runId: string): Promise<string[]> {
    const lessonsDir = path.join(this.previewRoot(runId), "lessons");
    return (await readdir(lessonsDir)).filter((entry) => entry.endsWith(".json")).sort();
  }

  private async countReviewRounds(runId: string): Promise<number> {
    const dir = this.reviewDir(runId);
    const entries = await readdir(dir).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return [];
      }
      throw error;
    });
    return entries.filter((entry) => /^round-[0-9]{3}-content-review\.json$/u.test(entry)).length;
  }

  private async writeBrief(runId: string, round: number, brief: Record<string, unknown>): Promise<string> {
    const dir = this.reviewDir(runId);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `round-${String(round).padStart(3, "0")}-content-review.json`);
    await writeFile(filePath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
    return filePath;
  }

  private runRoot(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId);
  }

  private previewRoot(runId: string): string {
    return path.join(this.runRoot(runId), "preview");
  }

  private reviewDir(runId: string): string {
    return path.join(this.runRoot(runId), "quality", "content-review");
  }
}

function buildCodexInstruction(runId: string, round: number, maxRounds: number, reviewBriefPath: string): string {
  return [
    `请执行第 ${round} / ${maxRounds} 轮内容审核。`,
    `读取 review brief: ${reviewBriefPath}`,
    "你现在扮演 content-review-agent，先给 Codex 挑刺，再输出修订后的 coursePack/lessons。",
    "重点检查：知识密度、来源具体性、图文匹配、模板化标题、学生是否能自学。",
    "不要改 coursePack.units、unit page counts、sourceAnchorIds，除非当前来源锚点明显错误。",
    round === maxRounds ? "这是第 3 轮：只产出可发布版本，去掉审核批注和过程性语言。" : "修订后调用 learning_agent.publish_learning_course，再进入下一轮审核。"
  ].join("\n");
}

function inferLearnerMode(lessons: unknown[]): string {
  return lessons.some((lesson) => isRecord(lesson) && lesson.displayMode === "textbook_deck") ? "student_self_study_textbook" : "learning_deck";
}

function normalizeMaxRounds(value: number | undefined): number {
  if (value === undefined) {
    return 3;
  }
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AgentRuntimeError("maxRounds must be an integer between 1 and 5", "INVALID_RUN_CONFIG");
  }
  return value;
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
```

- [ ] **Step 4: Export the service**

Modify `tools/agent-runtime/index.ts`:

```ts
export { ContentReviewService } from "./learner/content-review-service.js";
export type { PrepareContentReviewInput, PrepareContentReviewResult } from "./learner/content-review-service.js";
```

- [ ] **Step 5: Run green tests**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/content-review-service.test.ts
```

Expected: pass.

---

## Task 2: Content Review MCP Tool

**Files:**
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Test: `tools/mcp-server/runtime-tools.test.ts`
- Test: `tools/mcp-server/json-rpc-server.test.ts`

- [ ] **Step 1: Add failing runtime-tool test**

Add to `tools/mcp-server/runtime-tools.test.ts`:

```ts
test("prepare_content_review returns a Codex reviewer instruction", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "content-review-mcp-"));
  await writePreviewFixture(root, "review-course");
  const tools = new LearningAgentRuntimeTools(root);

  const result = await tools.callTool("learning_agent.prepare_content_review", {
    runId: "review-course",
    maxRounds: 3
  });

  expect(result).toMatchObject({
    status: "revision_required",
    runId: "review-course",
    round: 1,
    maxRounds: 3,
    codexInstruction: expect.stringContaining("内容审核")
  });
});
```

Use the same fixture shape from Task 1. The first run must fail with `unsupported tool`.

- [ ] **Step 2: Add tool contract**

In `tools/mcp-server/tool-contracts.ts`, add:

```ts
{
  name: "learning_agent.prepare_content_review",
  description: "Create the next Codex-facing content review brief for a published learning course. Use before final publishing or major republish work.",
  inputSchema: {
    type: "object",
    properties: {
      runId: stringSchema,
      maxRounds: numberSchema,
      minScore: numberSchema
    },
    required: ["runId"]
  }
}
```

Also add `"learning_agent.prepare_content_review"` to the `LearningAgentToolName` union and tool name set.

- [ ] **Step 3: Route runtime tool**

In `tools/mcp-server/runtime-tools.ts`, import `ContentReviewService` and add a switch case:

```ts
case "learning_agent.prepare_content_review":
  return this.prepareContentReview(input);
```

Add method:

```ts
private async prepareContentReview(input: unknown): Promise<unknown> {
  const options = expectRecord(input);
  return new ContentReviewService(this.workspaceRoot).prepareReview({
    runId: requiredString(options, "runId"),
    maxRounds: optionalNumber(options.maxRounds),
    minScore: optionalNumber(options.minScore)
  });
}
```

- [ ] **Step 4: Run MCP tests**

Run:

```bash
npm test -- --run tools/mcp-server/runtime-tools.test.ts tools/mcp-server/json-rpc-server.test.ts tools/mcp-server/skill-mcp-contract.test.ts
```

Expected: pass.

---

## Task 3: Imagegen Prompt Manifest Service

**Files:**
- Create: `tools/agent-runtime/learner/imagegen-asset-batch-service.ts`
- Create: `tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts`
- Modify: `tools/agent-runtime/index.ts`

- [ ] **Step 1: Write failing manifest creation test**

Create test:

```ts
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ImagegenAssetBatchService } from "./imagegen-asset-batch-service.js";

describe("ImagegenAssetBatchService", () => {
  test("creates prompt manifest for every preview page", async () => {
    const root = await imageFixtureRoot("image-course");

    const result = await new ImagegenAssetBatchService(root).createManifest({ runId: "image-course" });

    expect(result).toMatchObject({
      status: "manifest_ready",
      runId: "image-course",
      requiredImageCount: 2,
      manifestPath: expect.stringContaining("imagegen-prompt-manifest.json")
    });
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as { items: Array<Record<string, unknown>> };
    expect(manifest.items).toHaveLength(2);
    expect(manifest.items[0]).toMatchObject({
      lessonId: "lesson-a",
      pageId: "page-01",
      status: "missing_asset",
      prompt: expect.stringContaining("不要包含长段落文字、表格或 UI 文本框")
    });
  });
});
```

- [ ] **Step 2: Run the failing manifest test**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts
```

Expected: fail with missing service module.

- [ ] **Step 3: Implement manifest creation**

Create `ImagegenAssetBatchService` with:

```ts
export type ImagegenManifestItem = {
  lessonId: string;
  pageId: string;
  pageTitle: string;
  prompt: string;
  imageAlt: string;
  targetAssetPath: string;
  imageUrl: string;
  status: "ready" | "missing_asset" | "invalid_prompt";
};
```

Core rules:

```ts
function defaultPrompt(pageTitle: string, imageAlt: string): string {
  return `生成一张中文 Web Deck 教学插图，只表达“${pageTitle}”这一页的核心知识关系：${imageAlt}。可以使用短标签、方向词或局部标注帮助理解；不要包含页面标题、底部总结、页面卡片原文、长段落文字、表格或 UI 文本框。`;
}
```

Manifest path:

```text
runs/<runId>/quality/imagegen/imagegen-prompt-manifest.json
```

Target preview image path:

```text
runs/<runId>/preview/images/<lessonId>/<pageId>-imagegen-v1.png
```

Preview URL:

```text
/__learning-preview/<runId>/images/<lessonId>/<pageId>-imagegen-v1.png
```

- [ ] **Step 4: Export the service**

Modify `tools/agent-runtime/index.ts`:

```ts
export { ImagegenAssetBatchService } from "./learner/imagegen-asset-batch-service.js";
```

- [ ] **Step 5: Run green manifest tests**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts
```

Expected: pass.

---

## Task 4: Imagegen Asset Recording and Validation

**Files:**
- Modify: `tools/agent-runtime/learner/imagegen-asset-batch-service.ts`
- Modify: `tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts`

- [ ] **Step 1: Write failing record/validate tests**

Add tests:

```ts
test("records a generated image and rewrites the preview lesson visualSpec", async () => {
  const root = await imageFixtureRoot("image-course");
  const generated = path.join(root, "generated.png");
  await writeFile(generated, Buffer.from([137, 80, 78, 71]));

  const service = new ImagegenAssetBatchService(root);
  await service.createManifest({ runId: "image-course" });
  const result = await service.recordAsset({
    runId: "image-course",
    lessonId: "lesson-a",
    pageId: "page-01",
    sourceImagePath: generated
  });

  expect(result).toMatchObject({
    status: "asset_recorded",
    pageId: "page-01",
    imageUrl: "/__learning-preview/image-course/images/lesson-a/page-01-imagegen-v1.png"
  });

  const lesson = JSON.parse(await readFile(path.join(root, "runs", "image-course", "preview", "lessons", "lesson-a.json"), "utf8"));
  expect(lesson.pages[0].visualSpec).toMatchObject({
    imageProvider: "imagegen",
    imageUrl: "/__learning-preview/image-course/images/lesson-a/page-01-imagegen-v1.png"
  });
});

test("validate reports missing image files and svg references", async () => {
  const root = await imageFixtureRoot("image-course");
  const result = await new ImagegenAssetBatchService(root).validateAssets({ runId: "image-course" });

  expect(result.status).toBe("failed");
  expect(result.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ issueId: "imagegen.asset.file-missing" })
    ])
  );
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts
```

Expected: fail because `recordAsset` and `validateAssets` are not implemented.

- [ ] **Step 3: Implement `recordAsset`**

Behavior:

- Validate `runId`, `lessonId`, `pageId`.
- Copy `sourceImagePath` into `runs/<runId>/preview/images/<lessonId>/<pageId>-imagegen-v1.png`.
- Read manifest item for matching `lessonId/pageId`.
- Update page `visualSpec`:

```ts
page.visualSpec = {
  ...(isRecord(page.visualSpec) ? page.visualSpec : {}),
  kind: isRecord(page.visualSpec) && typeof page.visualSpec.kind === "string" ? page.visualSpec.kind : "diagram",
  description: isRecord(page.visualSpec) && typeof page.visualSpec.description === "string" ? page.visualSpec.description : item.pageTitle,
  keyElements: isRecord(page.visualSpec) && Array.isArray(page.visualSpec.keyElements) ? page.visualSpec.keyElements : [item.pageTitle],
  imageUrl: item.imageUrl,
  imageAlt: item.imageAlt,
  imageProvider: "imagegen",
  imagePrompt: item.prompt
};
```

- [ ] **Step 4: Implement `validateAssets`**

Validation issues:

- `imagegen.asset.file-missing`: `imageUrl` maps to a preview file that does not exist.
- `imagegen.asset.svg-reference`: `imageUrl` ends with `.svg`.
- `imagegen.asset.provider-missing`: `imageProvider !== "imagegen"`.
- `imagegen.asset.prompt-unsafe`: prompt allows long prose, tables, or UI text boxes.
- `imagegen.asset.prompt-guard-missing`: prompt does not explicitly forbid long prose, tables, and UI text boxes.

- [ ] **Step 5: Run green tests**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts
```

Expected: pass.

---

## Task 5: Imagegen Batch MCP Tools

**Files:**
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Test: `tools/mcp-server/runtime-tools.test.ts`

- [ ] **Step 1: Add failing MCP tests**

Add tests for:

```ts
learning_agent.create_imagegen_manifest
learning_agent.record_imagegen_asset
learning_agent.validate_imagegen_assets
```

Expected first failure: unsupported tool.

- [ ] **Step 2: Add tool contracts**

Contract names:

```ts
"learning_agent.create_imagegen_manifest"
"learning_agent.record_imagegen_asset"
"learning_agent.validate_imagegen_assets"
```

Inputs:

```ts
create_imagegen_manifest: { runId: string }
record_imagegen_asset: { runId: string; lessonId: string; pageId: string; sourceImagePath: string }
validate_imagegen_assets: { runId: string }
```

- [ ] **Step 3: Route runtime tools**

Runtime methods:

```ts
private async createImagegenManifest(input: unknown): Promise<unknown> {
  const options = expectRecord(input);
  return new ImagegenAssetBatchService(this.workspaceRoot).createManifest({
    runId: requiredString(options, "runId")
  });
}

private async recordImagegenAsset(input: unknown): Promise<unknown> {
  const options = expectRecord(input);
  return new ImagegenAssetBatchService(this.workspaceRoot).recordAsset({
    runId: requiredString(options, "runId"),
    lessonId: requiredString(options, "lessonId"),
    pageId: requiredString(options, "pageId"),
    sourceImagePath: requiredString(options, "sourceImagePath")
  });
}

private async validateImagegenAssets(input: unknown): Promise<unknown> {
  const options = expectRecord(input);
  return new ImagegenAssetBatchService(this.workspaceRoot).validateAssets({
    runId: requiredString(options, "runId")
  });
}
```

- [ ] **Step 4: Run MCP tests**

Run:

```bash
npm test -- --run tools/mcp-server/runtime-tools.test.ts tools/mcp-server/json-rpc-server.test.ts tools/mcp-server/skill-mcp-contract.test.ts
```

Expected: pass.

---

## Task 6: Workflow Docs and Skills

**Files:**
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `docs/runtime/imagegen-teaching-illustration-policy.md`
- Create: `docs/runtime/content-review-loop.md`

- [ ] **Step 1: Document default review loop**

Add `docs/runtime/content-review-loop.md`:

```md
# Content Review Loop

Default source-backed self-study courses use three Codex content-review rounds before final preview acceptance.

1. Publish draft course with `learning_agent.publish_learning_course`.
2. Call `learning_agent.prepare_content_review` with `maxRounds=3`.
3. Codex acts as `content-review-agent`: critique first, revise second.
4. Republish the revised bundle.
5. Repeat until round 3 completes or the review service returns `review_complete`.
6. Only the round-3 revised course moves into imagegen batch validation and final preview.

The reviewer focuses on:

- knowledge density
- source-specific concepts
- page-to-page knowledge progression
- image/text match
- non-template section labels
- student-facing self-study language
```

- [ ] **Step 2: Update operator skill sequence**

In `skills/learning-agent-operator/SKILL.md`, insert after first publish:

```md
For source-backed `student_self_study_textbook`, run up to three content-review rounds:

```json
{"method":"tools/call","params":{"name":"learning_agent.prepare_content_review","arguments":{"runId":"<run-id>","maxRounds":3}}}
```

Codex should revise and republish after each round. The third-round revised bundle is the one that proceeds to imagegen batch validation.
```

- [ ] **Step 3: Update source-to-course skill**

Add the same high-level loop and note that learners should not approve review artifacts.

- [ ] **Step 4: Run bundle skill checks**

Run:

```bash
npm run bundle:check
```

Expected: pass.

---

## Task 7: Weyl Republish Run

**Files/Artifacts:**
- Use source: `/Users/dm/Documents/1.书籍资料/BOOKS/Space, Time, Matter -- Hermann Weyl, Physics.epub`
- Create run: `self-study-weyl-space-time-matter-v2`
- Create docs: `docs/runtime/weyl-republish-acceptance.md`

- [ ] **Step 1: Prepare course request**

Use MCP from Codex:

```json
{
  "method": "tools/call",
  "params": {
    "name": "learning_agent.prepare_learning_course",
    "arguments": {
      "request": "请用 /Users/dm/Documents/1.书籍资料/BOOKS/Space, Time, Matter -- Hermann Weyl, Physics.epub 生成中文学生自学 Web 教材，面向大学高年级/研究生学习者。先做 8 页总览课，再选 3-5 个核心 topic，每个 topic 8 页。要求保留章节映射，所有页面使用 imagegen 教学插图，内容密度接近研究生课程自学讲义。",
      "runId": "self-study-weyl-space-time-matter-v2",
      "sourcePath": "/Users/dm/Documents/1.书籍资料/BOOKS/Space, Time, Matter -- Hermann Weyl, Physics.epub",
      "sourceKind": "book",
      "audience": "大学高年级/研究生自学者",
      "difficultyLevel": "upper_undergraduate_or_graduate",
      "courseIntent": "student_self_study_textbook",
      "strategy": "overview_plus_topic",
      "unitPages": 8,
      "selectedTopics": ["measurement and coordinates", "tensor and invariant laws", "metric continuum and curvature", "special relativity and world-points", "gravitation as metric field"]
    }
  }
}
```

- [ ] **Step 2: Author initial bundle**

Codex reads `get_authoring_context`, writes one `coursePack` with:

- `unit-overview`
- 3-5 topic units
- every lesson `displayMode: "textbook_deck"`
- every page has `knowledgeBoard`
- every page has imagegen-ready `visualSpec`

- [ ] **Step 3: Publish draft**

Call:

```json
{"method":"tools/call","params":{"name":"learning_agent.publish_learning_course","arguments":{"runId":"self-study-weyl-space-time-matter-v2","coursePack":{},"lessons":[]}}}
```

- [ ] **Step 4: Run three content review rounds**

For each round:

```json
{"method":"tools/call","params":{"name":"learning_agent.prepare_content_review","arguments":{"runId":"self-study-weyl-space-time-matter-v2","maxRounds":3,"minScore":90}}}
```

Codex revises, then calls `publish_learning_course` again.

Acceptance after round 3:

- No template section labels.
- No teacher-facing phrasing.
- Quality score >= 90 or all blocking issues resolved with a documented reason.
- Overview plus selected topic units remain in one course pack.

- [ ] **Step 5: Create imagegen manifest**

Call:

```json
{"method":"tools/call","params":{"name":"learning_agent.create_imagegen_manifest","arguments":{"runId":"self-study-weyl-space-time-matter-v2"}}}
```

Codex loops through manifest items, calls `image_gen`, and records each result:

```json
{"method":"tools/call","params":{"name":"learning_agent.record_imagegen_asset","arguments":{"runId":"self-study-weyl-space-time-matter-v2","lessonId":"<lesson-id>","pageId":"<page-id>","sourceImagePath":"<generated-png-path>"}}}
```

- [ ] **Step 6: Validate image assets**

Call:

```json
{"method":"tools/call","params":{"name":"learning_agent.validate_imagegen_assets","arguments":{"runId":"self-study-weyl-space-time-matter-v2"}}}
```

Expected:

```json
{ "status": "passed" }
```

- [ ] **Step 7: Browser acceptance**

Open:

```text
http://127.0.0.1:5173/#/preview/self-study-weyl-space-time-matter-v2
```

Check:

- overview page 4 retains the accepted layout pattern
- at least one page from each topic unit has a meaningful image
- right text rail is content-specific, not template labels
- no page requires vertical scrolling at normal laptop viewport

- [ ] **Step 8: Write acceptance note**

Create `docs/runtime/weyl-republish-acceptance.md`:

```md
# Weyl Republish Acceptance

Run: `self-study-weyl-space-time-matter-v2`

Accepted checks:

- Overview plus topic units are published in one course pack.
- Three content-review rounds completed or stopped with documented quality criteria.
- Imagegen manifest generated and all recorded assets validate.
- Browser preview checked for overview and topic pages.
- Remaining content risks are listed with page IDs.
```

---

## Verification

Run after implementation:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run bundle:check
```

For Weyl acceptance:

```bash
npm run codex:mcp:check
```

Then browser-check the v2 preview.

---

## Acceptance Criteria

- `learning_agent.prepare_content_review` exists and produces round-specific critic briefs.
- Three review rounds can be represented without asking the learner to approve artifacts.
- `learning_agent.create_imagegen_manifest` produces page-level prompts and target paths.
- `learning_agent.record_imagegen_asset` copies generated image files and rewrites lesson JSON.
- `learning_agent.validate_imagegen_assets` blocks missing files, SVGs, missing providers, and unsafe prompts.
- Weyl v2 is published as one course pack with overview plus 3-5 topic units.
- The final preview follows the accepted image/text layout and content-specific section labels.
