# Seed-Ready Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the current alpha into a seed-ready learning product where a user can create a source-backed Chinese course from Codex, open it in a learner-first UI, revise targeted content, and export a runnable bundle.

**Architecture:** Keep the existing local-first runtime, MCP tool surface, structured course objects, and Vite/React frontend. Add missing product layers in vertical slices: stabilize baseline, project registry, multi-unit generation, source-semantic planning, targeted revision, stable routes, knowledge map, export bundle, and semantic regression.

**Tech Stack:** TypeScript, Node.js ESM, React, Vite, Vitest, MCP stdio JSON-RPC, file-backed runtime under `tools/agent-runtime`, generated course packs under `src/course-packs`, generated lessons under `src/lessons`, and local run state under `runs/<run-id>/`.

---

## Scope

This plan implements the Seed-Ready Product milestone from `docs/superpowers/specs/2026-05-02-complete-learning-product-development-spec.md`.

Seed-ready means:

- Current learner-first UI is cleanly committed.
- A user can create a source-backed project from Codex without approving internal artifacts.
- Long sources can generate one overview unit plus at least two focused units.
- The frontend defaults to learner mode.
- User feedback can revise a unit or page.
- Book, paper, patent, and blog regression checks pass.

Out of scope for this plan:

- Cloud hosting.
- Accounts or multi-user permissions.
- Payment.
- Full OCR for scanned PDFs.
- Full tutor/teacher/assessment product maturity.
- Direct paid model-provider API routing.

## Current Baseline To Preserve

Do not remove these existing capabilities:

- `learning_agent.create_learning_project`
- `learning_agent.generate_grounded_course`
- `learning_agent.get_learning_preview`
- `learning_agent.revise_learning_course`
- `learning_agent.publish_learning_course`
- Advanced/operator tools such as `beta_status`, `read_artifact`, and `approve_gate`
- `npm run codex:mcp:check`
- `npm run source:regression`
- `npm run seed:check`
- Web Deck lesson rendering
- Course-pack registry auto-discovery
- Chinese-first, source-grounding, and lesson-quality validators

## File Responsibility Map

Runtime project layer:

- `tools/agent-runtime/learner/learner-project-service.ts` creates learner projects from MCP input.
- `tools/agent-runtime/learner/project-registry.ts` will list, read, update, archive, and delete local learning projects.
- `tools/agent-runtime/learner/project-registry.test.ts` will cover registry behavior.
- `tools/mcp-server/runtime-tools.ts` exposes learner project tools to MCP.
- `tools/mcp-server/tool-contracts.ts` documents tool input and output shapes.

Course generation layer:

- `tools/agent-runtime/learner/grounded-course-service.ts` currently builds overview plus one focused unit; it will delegate planning and lesson writing.
- `tools/agent-runtime/learner/course-unit-planner.ts` will create overview/topic/chapter/task/hybrid unit plans from normalized sources.
- `tools/agent-runtime/learner/course-unit-planner.test.ts` will cover unit planning.
- `tools/agent-runtime/learner/source-semantic-extractor.ts` will extract teachable facts from normalized anchors.
- `tools/agent-runtime/learner/source-semantic-extractor.test.ts` will cover book, paper, patent, and blog semantics.
- `tools/agent-runtime/learner/grounded-lesson-writer.ts` will build source-specific lessons from unit plans.
- `tools/agent-runtime/learner/grounded-lesson-writer.test.ts` will cover page mix, source anchors, and source-specific differences.

Revision layer:

- `tools/agent-runtime/learner/learning-revision-service.ts` currently writes revision briefs.
- `tools/agent-runtime/learner/revision-targeting.ts` will parse feedback into course/unit/page/interaction/assessment/source targets.
- `tools/agent-runtime/learner/revision-targeting.test.ts` will cover Chinese feedback targeting.
- `tools/agent-runtime/learner/targeted-revision-service.ts` will apply deterministic local revisions for generated lesson files and course packs.
- `tools/agent-runtime/learner/targeted-revision-service.test.ts` will verify scoped edits and revalidation.

Frontend product layer:

- `src/product/CourseWorkspace.tsx` is the learner-first app surface.
- `src/product/ProjectLibrary.tsx` will render local/generated project entries compiled into frontend manifests.
- `src/product/ProjectLibrary.test.tsx` will cover project selection and statuses.
- `src/product/FeedbackPanel.tsx` will provide a learner-facing revision entry surface.
- `src/product/FeedbackPanel.test.tsx` will cover feedback scope UI.
- `src/renderers/CanvasMapRenderer.tsx` will be upgraded from basic map to seed-ready map.
- `src/renderers/CanvasMapRenderer.test.tsx` will cover unit and source map behavior.
- `src/app/App.tsx` remains the app entry and should default to `CourseWorkspace`.

Routing and publishing layer:

- `src/product/product-route.ts` will parse and create course/unit/page hash routes.
- `src/product/product-route.test.ts` will cover stable route parsing.
- `tools/agent-runtime/learner/learning-course-publisher.ts` writes lesson/course source files and preview manifest.
- `tools/agent-runtime/learner/export-bundle-service.ts` will write static export metadata and copy course artifacts.
- `tools/agent-runtime/learner/export-bundle-service.test.ts` will cover export manifest contents.

Regression and docs:

- `tools/agent-runtime/learner/real-source-regression.ts` will assert semantic expectations, not only anchors.
- `tools/agent-runtime/learner/real-source-regression.test.ts` will cover semantic regression shape.
- `docs/runtime/seed-user-quickstart.md` will describe the seed-ready flow.
- `docs/runtime/source-type-acceptance.md` will be updated with semantic checks.
- `README.md` will document the learner-first path and export path.

---

## Task 1: Stabilize Current Learner-First Baseline

**Files:**

- Modify: `src/app/App.tsx`
- Modify: `src/product/CourseWorkspace.tsx`
- Modify: `src/product/CourseWorkspace.test.tsx`
- Modify: `src/components/deck/DeckShell.tsx`
- Create or keep: `src/app/App.test.tsx`
- Keep as public seed demo: `src/course-packs/demo-agentic-design-grounded/coursePack.ts`
- Keep as public seed demo: `src/lessons/demo-agentic-design-grounded-overview/lesson.ts`
- Keep as public seed demo: `src/lessons/demo-agentic-design-grounded-topic-01/lesson.ts`
- Modify: `docs/roadmap.md`
- Create: `docs/superpowers/specs/2026-05-02-complete-learning-product-development-spec.md`

- [ ] **Step 1: Inspect dirty state**

Run:

```bash
git status --short
```

Expected: only learner-first UI, grounded demo lesson/course files, roadmap, and product spec are modified or untracked.

- [ ] **Step 2: Verify App defaults to learner workspace**

Check that `src/app/App.tsx` renders `CourseWorkspace` with `lessonRegistry` and `coursePackRegistry`.

Expected shape:

```tsx
import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { CourseWorkspace } from "../product/CourseWorkspace";

export function App() {
  return <CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />;
}
```

- [ ] **Step 3: Verify learner-first tests**

Run:

```bash
npm run test -- src/app/App.test.tsx src/product/CourseWorkspace.test.tsx src/components/deck/DeckShell.test.tsx
```

Expected: all listed test files pass.

- [ ] **Step 4: Run frontend checks**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit stabilized baseline**

Run:

```bash
git add src/app/App.tsx src/app/App.test.tsx src/product/CourseWorkspace.tsx src/product/CourseWorkspace.test.tsx src/components/deck/DeckShell.tsx src/course-packs/demo-agentic-design-grounded src/lessons/demo-agentic-design-grounded-overview src/lessons/demo-agentic-design-grounded-topic-01 docs/roadmap.md docs/superpowers/specs/2026-05-02-complete-learning-product-development-spec.md
git commit -m "chore: stabilize learner-first baseline"
```

Expected: one commit containing the current learner-first baseline and product spec.

## Task 2: Add Local Learning Project Registry

**Files:**

- Create: `tools/agent-runtime/learner/project-registry.ts`
- Create: `tools/agent-runtime/learner/project-registry.test.ts`
- Modify: `tools/agent-runtime/learner/learner-project-service.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`

- [ ] **Step 1: Write registry tests**

Create `tools/agent-runtime/learner/project-registry.test.ts`:

```ts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ProjectRegistry } from "./project-registry.js";

describe("ProjectRegistry", () => {
  it("lists learner projects with status and preview metadata", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "learning-projects-"));
    const runDir = path.join(root, "runs", "agentic-book");
    await new ProjectRegistry(root).upsertProject({
      projectId: "agentic-book",
      title: "Agentic Design Patterns",
      sourceKind: "book",
      sourceRefs: ["/tmp/book.pdf"],
      audience: "有编程基础的中文学习者",
      language: "zh-CN",
      strategy: "overview_plus_topic",
      unitPageCount: 8,
      status: "draft"
    });
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify({ status: "preview_ready", courseTitle: "Agentic Design Patterns：课程包", lessonCount: 3 }, null, 2),
      "utf8"
    );

    const projects = await new ProjectRegistry(root).listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      projectId: "agentic-book",
      title: "Agentic Design Patterns",
      sourceKind: "book",
      status: "preview-ready",
      preview: {
        courseTitle: "Agentic Design Patterns：课程包",
        lessonCount: 3
      }
    });
  });

  it("archives a project without deleting run artifacts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "learning-projects-"));
    const registry = new ProjectRegistry(root);
    await registry.upsertProject({
      projectId: "paper-course",
      title: "论文课程",
      sourceKind: "paper",
      sourceRefs: ["/tmp/paper.pdf"],
      audience: "研究学习者",
      language: "zh-CN",
      strategy: "overview_plus_topic",
      unitPageCount: 8,
      status: "draft"
    });

    await registry.archiveProject("paper-course");
    const manifest = JSON.parse(await readFile(path.join(root, "runs", "paper-course", "learner-project.json"), "utf8")) as {
      project: { status: string };
    };

    expect(manifest.project.status).toBe("archived");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run test -- tools/agent-runtime/learner/project-registry.test.ts
```

Expected: fail because `project-registry.ts` does not exist.

- [ ] **Step 3: Implement registry**

Create `tools/agent-runtime/learner/project-registry.ts`:

```ts
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type LearningProjectStatus = "draft" | "generating" | "preview-ready" | "failed" | "revised" | "published" | "exported" | "archived";

export type LearningProjectRecord = {
  projectId: string;
  title: string;
  sourceKind: string;
  sourceRefs: string[];
  audience?: string;
  language: "zh-CN";
  strategy: string;
  unitPageCount: number;
  selectedChapters?: string[];
  selectedTopics?: string[];
  status: LearningProjectStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type LearningProjectListItem = LearningProjectRecord & {
  preview?: {
    courseTitle?: string;
    lessonCount?: number;
  };
};

export class ProjectRegistry {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async upsertProject(project: LearningProjectRecord): Promise<LearningProjectRecord> {
    const now = new Date().toISOString();
    const existing = await this.readProject(project.projectId).catch(() => undefined);
    const normalized: LearningProjectRecord = {
      ...project,
      createdAt: existing?.createdAt ?? project.createdAt ?? now,
      updatedAt: now
    };
    const runDir = this.runDir(project.projectId);
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, "learner-project.json"), `${JSON.stringify({ runId: project.projectId, project: normalized }, null, 2)}\n`, "utf8");
    return normalized;
  }

  async readProject(projectId: string): Promise<LearningProjectRecord> {
    const parsed = JSON.parse(await readFile(path.join(this.runDir(projectId), "learner-project.json"), "utf8")) as {
      project?: LearningProjectRecord;
      brief?: {
        topic?: string;
        sourcePath?: string;
        sourceKind?: string;
        audience?: string;
        unitPages?: number;
        strategy?: string;
        selectedChapters?: string[];
        selectedTopics?: string[];
        language?: string;
      };
    };
    if (parsed.project) {
      return parsed.project;
    }
    const brief = parsed.brief ?? {};
    return {
      projectId,
      title: brief.topic ?? projectId,
      sourceKind: brief.sourceKind ?? "topic",
      sourceRefs: brief.sourcePath ? [brief.sourcePath] : [],
      audience: brief.audience,
      language: "zh-CN",
      strategy: brief.strategy ?? "overview_plus_topic",
      unitPageCount: brief.unitPages ?? 8,
      selectedChapters: brief.selectedChapters,
      selectedTopics: brief.selectedTopics,
      status: "draft"
    };
  }

  async listProjects(): Promise<LearningProjectListItem[]> {
    const runsDir = path.join(this.workspaceRoot, "runs");
    const entries = await readdir(runsDir).catch(() => []);
    const projects = await Promise.all(
      entries.map(async (projectId) => {
        const project = await this.readProject(projectId).catch(() => undefined);
        if (!project) {
          return undefined;
        }
        const preview = await this.readPreview(projectId);
        return {
          ...project,
          status: preview ? "preview-ready" : project.status,
          ...(preview ? { preview } : {})
        } satisfies LearningProjectListItem;
      })
    );
    return projects
      .filter((project): project is LearningProjectListItem => Boolean(project))
      .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
  }

  async archiveProject(projectId: string): Promise<LearningProjectRecord> {
    const project = await this.readProject(projectId);
    return this.upsertProject({ ...project, status: "archived" });
  }

  private async readPreview(projectId: string): Promise<LearningProjectListItem["preview"] | undefined> {
    const parsed = JSON.parse(await readFile(path.join(this.runDir(projectId), "learning-preview.json"), "utf8").catch(() => "null")) as {
      courseTitle?: string;
      lessonCount?: number;
    } | null;
    if (!parsed) {
      return undefined;
    }
    return {
      courseTitle: parsed.courseTitle,
      lessonCount: parsed.lessonCount
    };
  }

  private runDir(projectId: string): string {
    return path.join(this.workspaceRoot, "runs", projectId);
  }
}
```

- [ ] **Step 4: Update LearnerProjectService to write project records**

Modify `tools/agent-runtime/learner/learner-project-service.ts` so `writeBrief` uses `ProjectRegistry.upsertProject` and still preserves existing `request` and `brief` fields for compatibility.

Required behavior:

```ts
await new ProjectRegistry(this.workspaceRoot).upsertProject({
  projectId: runId,
  title: brief.topic ?? runId,
  sourceKind: brief.sourceKind,
  sourceRefs: brief.sourcePath ? [brief.sourcePath] : [],
  audience: brief.audience,
  language: "zh-CN",
  strategy: brief.strategy,
  unitPageCount: brief.unitPages,
  selectedChapters: brief.selectedChapters,
  selectedTopics: brief.selectedTopics,
  status: "draft"
});
```

Then read the generated file, merge `{ request, brief }`, and write it back so older services still work:

```ts
const projectPath = path.join(runPath, "learner-project.json");
const current = JSON.parse(await readFile(projectPath, "utf8")) as Record<string, unknown>;
await writeFile(projectPath, JSON.stringify({ ...current, runId, request, brief }, null, 2), "utf8");
```

- [ ] **Step 5: Add MCP list/archive tools**

Modify `tools/mcp-server/tool-contracts.ts` and `tools/mcp-server/runtime-tools.ts` to expose:

```text
learning_agent.list_learning_projects
learning_agent.archive_learning_project
```

`list_learning_projects` input is `{}` and output contains `{ status: "projects_ready", projects }`.

`archive_learning_project` input is `{ runId: string }` and output contains `{ status: "project_archived", runId, project }`.

- [ ] **Step 6: Run registry and MCP tests**

Run:

```bash
npm run test -- tools/agent-runtime/learner/project-registry.test.ts tools/agent-runtime/learner/learner-project-service.test.ts tools/mcp-server/runtime-tools.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add tools/agent-runtime/learner/project-registry.ts tools/agent-runtime/learner/project-registry.test.ts tools/agent-runtime/learner/learner-project-service.ts tools/mcp-server/runtime-tools.ts tools/mcp-server/tool-contracts.ts tools/mcp-server/runtime-tools.test.ts
git commit -m "feat: add learner project registry"
```

## Task 3: Generate Multi-Unit Grounded Courses

**Files:**

- Create: `tools/agent-runtime/learner/course-unit-planner.ts`
- Create: `tools/agent-runtime/learner/course-unit-planner.test.ts`
- Modify: `tools/agent-runtime/learner/grounded-course-service.ts`
- Modify: `tools/agent-runtime/learner/grounded-course-service.test.ts`
- Modify: `src/schemas/course-pack.schema.ts`

- [ ] **Step 1: Write unit planner tests**

Create `tools/agent-runtime/learner/course-unit-planner.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { planCourseUnits } from "./course-unit-planner.js";

describe("planCourseUnits", () => {
  it("creates overview plus at least two topic units for a long book", () => {
    const plan = planCourseUnits({
      runId: "agentic-book",
      topic: "Agentic Design Patterns",
      sourceKind: "book",
      strategy: "overview_plus_topic",
      unitPageCount: 8,
      selectedTopics: [],
      selectedChapters: [],
      concepts: ["全局地图", "规划模式", "工具使用", "反思机制"],
      sourceAnchorIds: Array.from({ length: 12 }, (_, index) => `source-001:p${index + 1}`),
      sourceNodeIds: ["source-001:root"]
    });

    expect(plan.units.map((unit) => unit.unitId)).toEqual(["unit-overview", "unit-topic-01", "unit-topic-02", "unit-topic-03"]);
    expect(plan.units[0]).toMatchObject({ kind: "overview", lessonId: "agentic-book-overview" });
    expect(plan.units.filter((unit) => unit.kind === "topic")).toHaveLength(3);
  });

  it("uses selected topics before inferred concepts", () => {
    const plan = planCourseUnits({
      runId: "paper-course",
      topic: "论文课程",
      sourceKind: "paper",
      strategy: "overview_plus_topic",
      unitPageCount: 10,
      selectedTopics: ["研究问题", "实验设计"],
      selectedChapters: [],
      concepts: ["方法结构", "证据边界"],
      sourceAnchorIds: ["paper:p1", "paper:p2", "paper:p3"],
      sourceNodeIds: ["paper:root"]
    });

    expect(plan.units.map((unit) => unit.title)).toContain("论文课程：研究问题");
    expect(plan.units.map((unit) => unit.title)).toContain("论文课程：实验设计");
  });
});
```

- [ ] **Step 2: Run failing planner test**

Run:

```bash
npm run test -- tools/agent-runtime/learner/course-unit-planner.test.ts
```

Expected: fail because `course-unit-planner.ts` does not exist.

- [ ] **Step 3: Implement CourseUnitPlan**

Create `tools/agent-runtime/learner/course-unit-planner.ts`:

```ts
export type PlannedCourseUnit = {
  unitId: string;
  title: string;
  kind: "overview" | "chapter" | "topic" | "task" | "practice" | "assessment" | "teacher" | "hybrid";
  lessonId: string;
  targetPageCount: number;
  sourceAnchorIds: string[];
  sourceNodeIds: string[];
  chapterRefs?: string[];
  conceptIds: string[];
  focusConcepts: string[];
};

export type CourseUnitPlanInput = {
  runId: string;
  topic: string;
  sourceKind: string;
  strategy: string;
  unitPageCount: number;
  selectedTopics: string[];
  selectedChapters: string[];
  concepts: string[];
  sourceAnchorIds: string[];
  sourceNodeIds: string[];
};

export type CourseUnitPlan = {
  overviewUnitId: "unit-overview";
  units: PlannedCourseUnit[];
};

export function planCourseUnits(input: CourseUnitPlanInput): CourseUnitPlan {
  const focusConcepts = uniqueStrings([...input.selectedTopics, ...input.concepts.filter((concept) => concept !== "全局地图")]).slice(0, 4);
  const minimumFocusConcepts = focusConcepts.length >= 2 ? focusConcepts : uniqueStrings([...focusConcepts, "核心机制", "迁移应用"]);
  const focused = minimumFocusConcepts.slice(0, Math.max(2, Math.min(4, minimumFocusConcepts.length)));
  const units: PlannedCourseUnit[] = [
    {
      unitId: "unit-overview",
      title: `${input.topic}：总览课`,
      kind: "overview",
      lessonId: `${input.runId}-overview`,
      targetPageCount: input.unitPageCount,
      sourceAnchorIds: input.sourceAnchorIds,
      sourceNodeIds: input.sourceNodeIds,
      chapterRefs: input.selectedChapters,
      conceptIds: input.concepts.map((_, index) => conceptId(index)),
      focusConcepts: input.concepts
    },
    ...focused.map((concept, index) => {
      const unitIndex = index + 1;
      const kind = unitKind(input.strategy);
      return {
        unitId: `unit-${kind}-${String(unitIndex).padStart(2, "0")}`,
        title: `${input.topic}：${concept}`,
        kind,
        lessonId: `${input.runId}-${kind}-${String(unitIndex).padStart(2, "0")}`,
        targetPageCount: input.unitPageCount,
        sourceAnchorIds: anchorSlice(input.sourceAnchorIds, unitIndex, focused.length + 1),
        sourceNodeIds: input.sourceNodeIds,
        chapterRefs: input.selectedChapters,
        conceptIds: [conceptId(unitIndex)],
        focusConcepts: [concept]
      } satisfies PlannedCourseUnit;
    })
  ];
  return { overviewUnitId: "unit-overview", units };
}

function unitKind(strategy: string): PlannedCourseUnit["kind"] {
  if (strategy === "chapter_guided") return "chapter";
  if (strategy === "task_guided") return "task";
  if (strategy === "hybrid") return "hybrid";
  return "topic";
}

function conceptId(index: number): string {
  return `concept-${String(index + 1).padStart(2, "0")}`;
}

function anchorSlice(anchorIds: string[], index: number, total: number): string[] {
  if (anchorIds.length <= 2) return anchorIds;
  const chunkSize = Math.max(1, Math.ceil(anchorIds.length / total));
  const start = Math.min(index * chunkSize, Math.max(0, anchorIds.length - 1));
  const chunk = anchorIds.slice(start, start + chunkSize);
  return chunk.length > 0 ? chunk : anchorIds.slice(0, 1);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
```

- [ ] **Step 4: Refactor GroundedCourseService to use unit plans**

Modify `buildGroundedBundle` in `tools/agent-runtime/learner/grounded-course-service.ts` so it calls `planCourseUnits` and maps each `PlannedCourseUnit` into one lesson.

Required behavior:

```ts
const unitPlan = planCourseUnits({
  runId: config.runId,
  topic: config.topic,
  sourceKind: config.sourceKind ?? "unknown",
  strategy: config.coursePack?.strategy ?? "overview_plus_topic",
  unitPageCount: targetPageCount,
  selectedTopics: config.coursePack?.selectedTopics ?? [],
  selectedChapters: config.coursePack?.selectedChapters ?? [],
  concepts,
  sourceAnchorIds,
  sourceNodeIds: config.sources.map((source) => `${source.id}:root`)
});

const lessons = unitPlan.units.map((unit) =>
  buildLesson({
    id: unit.lessonId,
    title: unit.title,
    unitTitle: unit.title,
    config,
    sourceAnchorIds: unit.sourceAnchorIds,
    concepts: unit.focusConcepts,
    targetPageCount,
    revision
  })
);
```

Course pack units must include all planned/generated units:

```ts
units: unitPlan.units.map(({ focusConcepts, ...unit }) => unit)
```

- [ ] **Step 5: Extend grounded course tests**

Modify `tools/agent-runtime/learner/grounded-course-service.test.ts` to assert:

```ts
expect(result.status).toBe("preview_ready");
expect(result.preview.instructions.join("\n")).toContain("npm run dev");
expect(result.lessonPaths.length).toBeGreaterThanOrEqual(3);
```

Also read the generated course pack and assert:

```ts
expect(coursePack.units.map((unit) => unit.unitId)).toContain("unit-overview");
expect(coursePack.units.filter((unit) => unit.lessonId).length).toBeGreaterThanOrEqual(3);
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- tools/agent-runtime/learner/course-unit-planner.test.ts tools/agent-runtime/learner/grounded-course-service.test.ts
```

Expected: pass and generate at least three lessons for a source-backed course.

- [ ] **Step 7: Commit**

Run:

```bash
git add tools/agent-runtime/learner/course-unit-planner.ts tools/agent-runtime/learner/course-unit-planner.test.ts tools/agent-runtime/learner/grounded-course-service.ts tools/agent-runtime/learner/grounded-course-service.test.ts src/schemas/course-pack.schema.ts
git commit -m "feat: generate multi-unit grounded courses"
```

## Task 4: Add Source-Semantic Extraction

**Files:**

- Create: `tools/agent-runtime/learner/source-semantic-extractor.ts`
- Create: `tools/agent-runtime/learner/source-semantic-extractor.test.ts`
- Modify: `tools/agent-runtime/learner/grounded-course-service.ts`
- Modify: `tools/agent-runtime/learner/real-source-regression.ts`
- Modify: `docs/runtime/source-type-acceptance.md`

- [ ] **Step 1: Write semantic extractor tests**

Create `tools/agent-runtime/learner/source-semantic-extractor.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { extractSourceSemantics } from "./source-semantic-extractor.js";

const anchors = [
  {
    anchorId: "a1",
    sourceId: "source-001",
    label: "page 1",
    locator: { kind: "page", page: 1 },
    quote: "Abstract: We propose an agentic workflow with planning, tool use, reflection, and evaluation."
  },
  {
    anchorId: "a2",
    sourceId: "source-001",
    label: "page 2",
    locator: { kind: "page", page: 2 },
    quote: "Experiments show limitations when tool feedback is missing."
  }
];

describe("extractSourceSemantics", () => {
  it("extracts paper-specific teaching concepts", () => {
    const semantics = extractSourceSemantics({ sourceKind: "paper", anchors });

    expect(semantics.concepts.map((concept) => concept.label)).toContain("研究问题");
    expect(semantics.concepts.map((concept) => concept.label)).toContain("方法结构");
    expect(semantics.misconceptions[0].statement).toContain("贡献");
  });

  it("extracts patent-specific teaching concepts", () => {
    const semantics = extractSourceSemantics({
      sourceKind: "patent",
      anchors: [
        {
          anchorId: "c1",
          sourceId: "patent",
          label: "claim 1",
          locator: { kind: "claim", claimNumber: "1" },
          quote: "Claim 1 describes a technical solution and embodiment."
        }
      ]
    });

    expect(semantics.concepts.map((concept) => concept.label)).toContain("权利要求边界");
    expect(semantics.examples[0].title).toContain("claim");
  });
});
```

- [ ] **Step 2: Run failing semantic test**

Run:

```bash
npm run test -- tools/agent-runtime/learner/source-semantic-extractor.test.ts
```

Expected: fail because the extractor does not exist.

- [ ] **Step 3: Implement semantic extractor**

Create `tools/agent-runtime/learner/source-semantic-extractor.ts`:

```ts
import type { SourceAnchor } from "../corpus-types.js";

export type SourceSemanticConcept = {
  id: string;
  label: string;
  sourceAnchorIds: string[];
};

export type SourceSemantics = {
  concepts: SourceSemanticConcept[];
  examples: Array<{ id: string; title: string; sourceAnchorIds: string[] }>;
  misconceptions: Array<{ id: string; statement: string; correction: string; sourceAnchorIds: string[] }>;
  teachingAngles: string[];
};

export function extractSourceSemantics(input: { sourceKind: string; anchors: SourceAnchor[] }): SourceSemantics {
  const sourceAnchorIds = input.anchors.map((anchor) => anchor.anchorId);
  const labels = labelsForKind(input.sourceKind);
  return {
    concepts: labels.map((label, index) => ({
      id: `concept-${String(index + 1).padStart(2, "0")}`,
      label,
      sourceAnchorIds: anchorSlice(sourceAnchorIds, index, labels.length)
    })),
    examples: labels.map((label, index) => ({
      id: `example-${String(index + 1).padStart(2, "0")}`,
      title: `${label} 的 ${input.sourceKind === "patent" ? "claim / embodiment" : "source"} 例子`,
      sourceAnchorIds: anchorSlice(sourceAnchorIds, index, labels.length)
    })),
    misconceptions: misconceptionsForKind(input.sourceKind, sourceAnchorIds),
    teachingAngles: teachingAnglesForKind(input.sourceKind)
  };
}

function labelsForKind(sourceKind: string): string[] {
  if (sourceKind === "paper") return ["研究问题", "方法结构", "证据边界", "局限条件", "迁移应用"];
  if (sourceKind === "patent") return ["权利要求边界", "技术方案", "实施例", "术语定义", "风险边界"];
  if (sourceKind === "blog") return ["实践问题", "操作流程", "工具选择", "评估方式", "迁移应用"];
  if (sourceKind === "documentation") return ["使用场景", "关键配置", "操作流程", "错误恢复", "迁移应用"];
  return ["全局地图", "核心机制", "关键例子", "常见误区", "迁移应用"];
}

function misconceptionsForKind(sourceKind: string, sourceAnchorIds: string[]): SourceSemantics["misconceptions"] {
  if (sourceKind === "paper") {
    return [{ id: "paper-contribution", statement: "论文贡献等于方法一定可靠。", correction: "贡献需要和假设、证据、局限一起理解。", sourceAnchorIds: sourceAnchorIds.slice(0, 2) }];
  }
  if (sourceKind === "patent") {
    return [{ id: "patent-claim", statement: "专利说明书里的例子都等于权利要求保护范围。", correction: "保护边界主要由权利要求决定，实施例用于解释技术方案。", sourceAnchorIds: sourceAnchorIds.slice(0, 2) }];
  }
  if (sourceKind === "blog") {
    return [{ id: "blog-steps", statement: "照着博客步骤做完就等于理解。", correction: "还需要理解每一步解决的问题、失败条件和迁移方式。", sourceAnchorIds: sourceAnchorIds.slice(0, 2) }];
  }
  return [{ id: "summary-understanding", statement: "摘要越完整就越懂。", correction: "理解需要机制、行动、反馈和迁移。", sourceAnchorIds: sourceAnchorIds.slice(0, 2) }];
}

function teachingAnglesForKind(sourceKind: string): string[] {
  if (sourceKind === "paper") return ["先分清问题、方法、证据和局限", "用迁移任务检查方法边界"];
  if (sourceKind === "patent") return ["先看权利要求边界，再看实施例", "区分技术方案和解释性类比"];
  if (sourceKind === "blog") return ["先还原实践问题，再把步骤变成决策点", "用失败场景检查是否真正会用"];
  return ["先建立全局地图，再进入核心机制", "用行动和反馈确认是否理解"];
}

function anchorSlice(anchorIds: string[], index: number, total: number): string[] {
  if (anchorIds.length <= 1) return anchorIds;
  const chunkSize = Math.max(1, Math.ceil(anchorIds.length / total));
  const chunk = anchorIds.slice(index * chunkSize, index * chunkSize + chunkSize);
  return chunk.length > 0 ? chunk : anchorIds.slice(0, 1);
}
```

- [ ] **Step 4: Use semantics in source-ingest**

Modify `buildSourceIngestArtifact` in `tools/agent-runtime/learner/grounded-course-service.ts` to call `extractSourceSemantics({ sourceKind: config.sourceKind ?? "unknown", anchors })`.

Required behavior:

```ts
const semantics = extractSourceSemantics({ sourceKind: config.sourceKind ?? "unknown", anchors });
const concepts = semantics.concepts;
```

Use `semantics.examples` and `semantics.misconceptions` instead of generic examples/misconceptions.

- [ ] **Step 5: Add semantic regression expectations**

Modify `tools/agent-runtime/learner/real-source-regression.ts` so each source-kind result includes:

```ts
semanticExpectations: {
  expectedConceptLabels: string[];
  matchedConceptLabels: string[];
  missingConceptLabels: string[];
}
```

Use expected labels:

```ts
const expectedByKind = {
  book: ["全局地图", "核心机制"],
  paper: ["研究问题", "方法结构", "证据边界"],
  patent: ["权利要求边界", "技术方案", "实施例"],
  blog: ["实践问题", "操作流程"]
};
```

- [ ] **Step 6: Run tests and source regression**

Run:

```bash
npm run test -- tools/agent-runtime/learner/source-semantic-extractor.test.ts tools/agent-runtime/learner/grounded-course-service.test.ts tools/agent-runtime/learner/real-source-regression.test.ts
npm run source:regression
```

Expected: tests pass and regression reports semantic expectations for book, paper, patent, and blog.

- [ ] **Step 7: Commit**

Run:

```bash
git add tools/agent-runtime/learner/source-semantic-extractor.ts tools/agent-runtime/learner/source-semantic-extractor.test.ts tools/agent-runtime/learner/grounded-course-service.ts tools/agent-runtime/learner/real-source-regression.ts tools/agent-runtime/learner/real-source-regression.test.ts docs/runtime/source-type-acceptance.md
git commit -m "feat: extract source-semantic course concepts"
```

## Task 5: Add Targeted Revision

**Files:**

- Create: `tools/agent-runtime/learner/revision-targeting.ts`
- Create: `tools/agent-runtime/learner/revision-targeting.test.ts`
- Create: `tools/agent-runtime/learner/targeted-revision-service.ts`
- Create: `tools/agent-runtime/learner/targeted-revision-service.test.ts`
- Modify: `tools/agent-runtime/learner/learning-revision-service.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`

- [ ] **Step 1: Write revision targeting tests**

Create `tools/agent-runtime/learner/revision-targeting.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseRevisionTarget } from "./revision-targeting.js";

describe("parseRevisionTarget", () => {
  it("targets a page from Chinese feedback", () => {
    expect(parseRevisionTarget("第 3 页太抽象，换成工程例子")).toEqual({
      scope: "page",
      pageIndex: 2,
      requestedChange: "第 3 页太抽象，换成工程例子"
    });
  });

  it("targets course structure", () => {
    expect(parseRevisionTarget("课程结构要按章节组织，不要只按 topic")).toMatchObject({
      scope: "course"
    });
  });
});
```

- [ ] **Step 2: Implement revision targeting**

Create `tools/agent-runtime/learner/revision-targeting.ts`:

```ts
export type RevisionTarget =
  | { scope: "course"; requestedChange: string }
  | { scope: "unit"; unitId?: string; requestedChange: string }
  | { scope: "page"; pageIndex: number; requestedChange: string }
  | { scope: "interaction"; pageIndex?: number; requestedChange: string }
  | { scope: "assessment"; pageIndex?: number; requestedChange: string }
  | { scope: "source"; requestedChange: string };

export function parseRevisionTarget(feedback: string, focus?: string): RevisionTarget {
  const requestedChange = feedback.trim();
  const page = /第\s*(?<page>[0-9一二三四五六七八九十]+)\s*页/u.exec(`${focus ?? ""} ${feedback}`)?.groups?.page;
  if (page) {
    return { scope: "page", pageIndex: chineseNumberToIndex(page), requestedChange };
  }
  if (/互动|操作|选择|拖拽|实验/u.test(feedback)) {
    return { scope: "interaction", requestedChange };
  }
  if (/测验|题|quiz|评估|assessment/iu.test(feedback)) {
    return { scope: "assessment", requestedChange };
  }
  if (/来源|引用|锚点|source|anchor/iu.test(feedback)) {
    return { scope: "source", requestedChange };
  }
  if (/结构|章节|topic|单元|路径/iu.test(feedback)) {
    return { scope: "course", requestedChange };
  }
  return { scope: "unit", requestedChange };
}

function chineseNumberToIndex(value: string): number {
  const direct = Number(value);
  if (Number.isInteger(direct) && direct > 0) return direct - 1;
  const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return Math.max(0, (map[value] ?? 1) - 1);
}
```

- [ ] **Step 3: Extend revision brief schema**

Modify `LearningRevisionService.requestRevision` to include:

```ts
const target = parseRevisionTarget(feedback, input.focus);
```

Add `target` into the revision brief JSON and result:

```ts
target,
```

- [ ] **Step 4: Implement deterministic targeted revision service**

Create `tools/agent-runtime/learner/targeted-revision-service.ts` with a service that:

1. Reads latest `runs/<runId>/learning-revisions/revision-*.json`.
2. Reads `runs/<runId>/learning-preview.json`.
3. For page-scope feedback, edits only the selected page narrative and adds a revision note to that page.
4. Calls `LearningCoursePublisher.publish` with revised lessons and existing course pack.

The page edit behavior must be deterministic:

```ts
page.narrative = `${page.narrative}\n\n修订说明：${target.requestedChange}`;
```

- [ ] **Step 5: Expose apply revision through MCP**

Add MCP tool:

```text
learning_agent.apply_learning_revision
```

Input:

```ts
{ runId: string }
```

Output:

```ts
{ status: "revision_applied", runId: string, revisionId: string, changedLessonIds: string[], preview }
```

- [ ] **Step 6: Run revision tests**

Run:

```bash
npm run test -- tools/agent-runtime/learner/revision-targeting.test.ts tools/agent-runtime/learner/targeted-revision-service.test.ts tools/agent-runtime/learner/learning-revision-service.test.ts tools/mcp-server/runtime-tools.test.ts
```

Expected: feedback on `第 3 页` changes only page index `2`, then publish validation passes.

- [ ] **Step 7: Commit**

Run:

```bash
git add tools/agent-runtime/learner/revision-targeting.ts tools/agent-runtime/learner/revision-targeting.test.ts tools/agent-runtime/learner/targeted-revision-service.ts tools/agent-runtime/learner/targeted-revision-service.test.ts tools/agent-runtime/learner/learning-revision-service.ts tools/mcp-server/runtime-tools.ts tools/mcp-server/runtime-tools.test.ts
git commit -m "feat: apply targeted learner revisions"
```

## Task 6: Add Stable Course, Unit, And Page Routes

**Files:**

- Create: `src/product/product-route.ts`
- Create: `src/product/product-route.test.ts`
- Modify: `src/product/CourseWorkspace.tsx`
- Modify: `src/product/CourseWorkspace.test.tsx`
- Modify: `src/renderers/WebDeckRenderer.tsx`
- Modify: `src/renderers/WebDeckRenderer.test.tsx`

- [ ] **Step 1: Write route tests**

Create `src/product/product-route.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildProductRoute, parseProductRoute } from "./product-route";

describe("product-route", () => {
  it("parses course, unit, and page hash routes", () => {
    expect(parseProductRoute("#/course/agentic/unit/unit-topic-01/page/3")).toEqual({
      courseId: "agentic",
      unitId: "unit-topic-01",
      pageIndex: 2
    });
  });

  it("builds stable hash routes", () => {
    expect(buildProductRoute({ courseId: "agentic", unitId: "unit-overview", pageIndex: 0 })).toBe("#/course/agentic/unit/unit-overview/page/1");
  });
});
```

- [ ] **Step 2: Implement route helpers**

Create `src/product/product-route.ts`:

```ts
export type ProductRoute = {
  courseId?: string;
  unitId?: string;
  pageIndex?: number;
};

export function parseProductRoute(hash: string): ProductRoute {
  const match = /^#\/course\/(?<courseId>[a-z0-9-]+)(?:\/unit\/(?<unitId>[a-z0-9-]+))?(?:\/page\/(?<page>[0-9]+))?$/u.exec(hash);
  if (!match?.groups) return {};
  return {
    courseId: match.groups.courseId,
    unitId: match.groups.unitId,
    pageIndex: match.groups.page ? Math.max(0, Number(match.groups.page) - 1) : undefined
  };
}

export function buildProductRoute(route: ProductRoute): string {
  const course = route.courseId ? `#/course/${route.courseId}` : "#/";
  const unit = route.unitId ? `/unit/${route.unitId}` : "";
  const page = route.pageIndex !== undefined ? `/page/${route.pageIndex + 1}` : "";
  return `${course}${unit}${page}`;
}
```

- [ ] **Step 3: Wire route into CourseWorkspace**

Modify `CourseWorkspace` to:

- Read initial course/unit/page from `window.location.hash` through `parseProductRoute`.
- Update `window.location.hash` when course, unit, or page changes.
- Pass `initialPageIndex` and `onPageChange` to `WebDeckRenderer`.

Required props for `WebDeckRenderer`:

```ts
type WebDeckRendererProps = {
  lesson: Lesson;
  initialPageIndex?: number;
  onPageChange?: (pageIndex: number) => void;
};
```

- [ ] **Step 4: Run route and renderer tests**

Run:

```bash
npm run test -- src/product/product-route.test.ts src/product/CourseWorkspace.test.tsx src/renderers/WebDeckRenderer.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/product/product-route.ts src/product/product-route.test.ts src/product/CourseWorkspace.tsx src/product/CourseWorkspace.test.tsx src/renderers/WebDeckRenderer.tsx src/renderers/WebDeckRenderer.test.tsx
git commit -m "feat: add stable course routes"
```

## Task 7: Add Learner Project Library UI

**Files:**

- Create: `src/product/ProjectLibrary.tsx`
- Create: `src/product/ProjectLibrary.test.tsx`
- Modify: `src/product/CourseWorkspace.tsx`
- Modify: `src/product/CourseWorkspace.test.tsx`
- Modify: `src/schemas/course-pack.schema.ts`
- Modify: `src/course-packs/registry.ts`

- [ ] **Step 1: Add frontend project list model**

Extend `CoursePackRegistryEntry` in `src/course-packs/registry.ts` with:

```ts
projectStatus: "preview-ready" | "generated" | "sample";
sourceKind?: string;
strategy?: string;
unitCount: number;
```

Derive values from the course pack:

```ts
projectStatus: module.generatedCoursePack.parentRunId?.startsWith("demo") ? "sample" : "preview-ready",
sourceKind: module.generatedCoursePack.sourceKind,
strategy: module.generatedCoursePack.strategy,
unitCount: module.generatedCoursePack.units.length
```

- [ ] **Step 2: Write ProjectLibrary test**

Create `src/product/ProjectLibrary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CoursePackRegistryEntry } from "../course-packs/registry";
import { ProjectLibrary } from "./ProjectLibrary";

const course = {
  id: "agentic",
  label: "Agentic 课程",
  modulePath: "./agentic/coursePack.ts",
  projectStatus: "preview-ready",
  sourceKind: "book",
  strategy: "overview_plus_topic",
  unitCount: 3,
  coursePack: {
    id: "agentic",
    title: "Agentic 课程",
    parentRunId: "agentic",
    sourceKind: "book",
    strategy: "overview_plus_topic",
    units: []
  }
} satisfies CoursePackRegistryEntry;

describe("ProjectLibrary", () => {
  it("renders projects and selects a course", async () => {
    const onSelect = vi.fn();
    render(<ProjectLibrary coursePacks={[course]} onSelectCourse={onSelect} selectedCoursePackId="" />);

    await userEvent.click(screen.getByRole("button", { name: /打开 Agentic 课程/u }));

    expect(screen.getByText("book · overview_plus_topic · 3 个单元")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith("agentic");
  });
});
```

- [ ] **Step 3: Implement ProjectLibrary**

Create `src/product/ProjectLibrary.tsx`:

```tsx
import type { CoursePackRegistryEntry } from "../course-packs/registry";

type ProjectLibraryProps = {
  coursePacks: CoursePackRegistryEntry[];
  selectedCoursePackId: string;
  onSelectCourse: (coursePackId: string) => void;
};

export function ProjectLibrary({ coursePacks, selectedCoursePackId, onSelectCourse }: ProjectLibraryProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-5 sm:px-8 lg:px-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">学习项目</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">选择要继续学习的课程</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {coursePacks.map((entry) => (
          <article
            className={[
              "rounded-lg border bg-white p-4 shadow-sm",
              selectedCoursePackId === entry.id ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"
            ].join(" ")}
            key={entry.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950">{entry.label}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {entry.sourceKind ?? "unknown"} · {entry.strategy ?? "course"} · {entry.unitCount} 个单元
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{entry.projectStatus}</span>
            </div>
            <button
              className="mt-4 rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
              onClick={() => onSelectCourse(entry.id)}
              type="button"
            >
              打开 {entry.label}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add library toggle to CourseWorkspace**

Modify `CourseWorkspace` header to include a `学习项目` button and render `ProjectLibrary` above the deck when selected.

Expected learner behavior:

- App still opens directly into current learning view.
- User can open library when needed.
- Selecting a project switches course and first available unit.

- [ ] **Step 5: Run frontend tests**

Run:

```bash
npm run test -- src/product/ProjectLibrary.test.tsx src/product/CourseWorkspace.test.tsx src/course-packs/registry.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/product/ProjectLibrary.tsx src/product/ProjectLibrary.test.tsx src/product/CourseWorkspace.tsx src/product/CourseWorkspace.test.tsx src/course-packs/registry.ts src/course-packs/registry.test.ts src/schemas/course-pack.schema.ts
git commit -m "feat: add learner project library"
```

## Task 8: Upgrade Knowledge Map v1

**Files:**

- Modify: `src/renderers/CanvasMapRenderer.tsx`
- Modify: `src/renderers/CanvasMapRenderer.test.tsx`
- Modify: `src/components/canvas/ConceptNode.tsx`
- Modify: `src/components/canvas/ConceptEdge.tsx`
- Modify: `src/components/canvas/MapViewport.tsx`

- [ ] **Step 1: Extend CanvasMapRenderer tests**

Modify `src/renderers/CanvasMapRenderer.test.tsx` to assert:

```tsx
expect(screen.getByText("学习单元")).toBeInTheDocument();
expect(screen.getByText("核心概念")).toBeInTheDocument();
expect(screen.getByText("来源锚点")).toBeInTheDocument();
expect(screen.getByRole("button", { name: /打开对应课程/u })).toBeInTheDocument();
```

Add a planned unit without `lessonId` and assert:

```tsx
expect(screen.getByText("待生成")).toBeInTheDocument();
```

- [ ] **Step 2: Add map summary band**

Modify `CanvasMapRenderer` to compute:

```ts
const generatedUnitCount = coursePack.units.filter((unit) => unit.lessonId).length;
const plannedUnitCount = coursePack.units.length - generatedUnitCount;
const conceptCount = conceptIds.length;
const sourceAnchorCount = sourceAnchorIds.length;
```

Render four summary counters:

```text
已生成单元
待生成单元
核心概念
来源锚点
```

- [ ] **Step 3: Improve pending and source states**

Ensure planned units without `lessonId` show:

```text
待生成
```

Ensure source anchors are visually grouped and scrollable when count is large:

```tsx
<div className="max-h-[32rem] overflow-auto">
```

- [ ] **Step 4: Run map tests**

Run:

```bash
npm run test -- src/renderers/CanvasMapRenderer.test.tsx
```

Expected: map test passes with generated and planned units.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/renderers/CanvasMapRenderer.tsx src/renderers/CanvasMapRenderer.test.tsx src/components/canvas/ConceptNode.tsx src/components/canvas/ConceptEdge.tsx src/components/canvas/MapViewport.tsx
git commit -m "feat: harden course knowledge map"
```

## Task 9: Add Export Bundle Service

**Files:**

- Create: `tools/agent-runtime/learner/export-bundle-service.ts`
- Create: `tools/agent-runtime/learner/export-bundle-service.test.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write export tests**

Create `tools/agent-runtime/learner/export-bundle-service.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ExportBundleService } from "./export-bundle-service.js";

describe("ExportBundleService", () => {
  it("writes export manifest for a preview-ready course", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "learning-export-"));
    const runDir = path.join(root, "runs", "agentic");
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify({
        status: "preview_ready",
        runId: "agentic",
        coursePackId: "agentic",
        courseTitle: "Agentic 课程",
        lessonCount: 3,
        coursePackPath: path.join(root, "src/course-packs/agentic/coursePack.ts"),
        lessonPaths: [path.join(root, "src/lessons/agentic-overview/lesson.ts")],
        publishNotes: "Generated."
      }),
      "utf8"
    );

    const result = await new ExportBundleService(root).exportRun({ runId: "agentic" });

    expect(result.status).toBe("export_ready");
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as { courseTitle: string; artifactVersions: string[] };
    expect(manifest.courseTitle).toBe("Agentic 课程");
    expect(manifest.artifactVersions).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement export service**

Create `tools/agent-runtime/learner/export-bundle-service.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";

export type ExportBundleInput = {
  runId: string;
};

export type ExportBundleResult = {
  status: "export_ready";
  runId: string;
  exportDir: string;
  manifestPath: string;
};

export class ExportBundleService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async exportRun(input: ExportBundleInput): Promise<ExportBundleResult> {
    const previewPath = path.join(this.workspaceRoot, "runs", input.runId, "learning-preview.json");
    const preview = JSON.parse(await readFile(previewPath, "utf8").catch(() => {
      throw new AgentRuntimeError("Cannot export before a learning preview is ready", "MISSING_ARTIFACT");
    })) as {
      coursePackId: string;
      courseTitle: string;
      lessonCount: number;
      coursePackPath?: string;
      lessonPaths?: string[];
      publishNotes?: string;
    };
    const exportDir = path.join(this.workspaceRoot, "runs", input.runId, "exports", "static-course");
    await mkdir(exportDir, { recursive: true });
    const manifest = {
      schemaVersion: 1,
      runId: input.runId,
      coursePackId: preview.coursePackId,
      courseTitle: preview.courseTitle,
      lessonCount: preview.lessonCount,
      coursePackPath: preview.coursePackPath,
      lessonPaths: preview.lessonPaths ?? [],
      publishNotes: preview.publishNotes,
      artifactVersions: [],
      exportedAt: new Date().toISOString(),
      instructions: ["在项目根目录运行 npm run build。", "用 npm run preview 或静态服务器打开 dist。"]
    };
    const manifestPath = path.join(exportDir, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return { status: "export_ready", runId: input.runId, exportDir, manifestPath };
  }
}
```

- [ ] **Step 3: Expose export MCP tool**

Add MCP tool:

```text
learning_agent.export_learning_course
```

Input:

```ts
{ runId: string }
```

Output: `ExportBundleResult`.

- [ ] **Step 4: Run export tests**

Run:

```bash
npm run test -- tools/agent-runtime/learner/export-bundle-service.test.ts tools/mcp-server/runtime-tools.test.ts
```

Expected: export service writes `runs/<runId>/exports/static-course/manifest.json`.

- [ ] **Step 5: Commit**

Run:

```bash
git add tools/agent-runtime/learner/export-bundle-service.ts tools/agent-runtime/learner/export-bundle-service.test.ts tools/mcp-server/runtime-tools.ts tools/mcp-server/tool-contracts.ts tools/mcp-server/runtime-tools.test.ts README.md
git commit -m "feat: export learning course bundles"
```

## Task 10: Expand Semantic Source Regression And Seed Check

**Files:**

- Modify: `tools/agent-runtime/learner/real-source-regression.ts`
- Modify: `tools/agent-runtime/learner/real-source-regression.test.ts`
- Modify: `scripts/beta-seed-check.ts`
- Modify: `docs/runtime/seed-user-quickstart.md`
- Modify: `docs/runtime/source-type-acceptance.md`

- [ ] **Step 1: Add semantic pass/fail checks**

Modify `real-source-regression.ts` so each source result has:

```ts
semanticStatus: "passed" | "warning" | "failed";
missingConceptLabels: string[];
generatedUnitCount: number;
```

Rules:

- `failed` if `generatedUnitCount < 3`.
- `failed` if `missingConceptLabels.length > 0` for book, paper, or patent.
- `warning` for blog when URL extraction falls back but at least one unit is generated.
- `passed` otherwise.

- [ ] **Step 2: Update regression tests**

Modify `real-source-regression.test.ts` to assert:

```ts
expect(result.generatedUnitCount).toBeGreaterThanOrEqual(3);
expect(result.semanticStatus).not.toBe("failed");
```

- [ ] **Step 3: Add source regression to seed check report**

Modify `scripts/beta-seed-check.ts` so the final JSON includes:

```ts
sourceRegression: {
  total: number;
  passed: number;
  warnings: number;
  failed: number;
}
```

And fails seed check when any source regression item has `semanticStatus === "failed"`.

- [ ] **Step 4: Update seed docs**

Update `docs/runtime/seed-user-quickstart.md` so expected learner flow is:

```text
create_learning_project
generate_grounded_course
get_learning_preview
revise_learning_course
apply_learning_revision
export_learning_course
```

Update `docs/runtime/source-type-acceptance.md` so each source type includes semantic expectations and generated unit count.

- [ ] **Step 5: Run regression and seed check**

Run:

```bash
npm run test -- tools/agent-runtime/learner/real-source-regression.test.ts
npm run source:regression
npm run seed:check
```

Expected: source regression and seed check pass with semantic status included.

- [ ] **Step 6: Commit**

Run:

```bash
git add tools/agent-runtime/learner/real-source-regression.ts tools/agent-runtime/learner/real-source-regression.test.ts scripts/beta-seed-check.ts docs/runtime/seed-user-quickstart.md docs/runtime/source-type-acceptance.md
git commit -m "test: add semantic seed readiness checks"
```

## Task 11: End-To-End Seed-Ready Verification

**Files:**

- Modify: `README.md`
- Modify: `docs/runtime/seed-user-quickstart.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run codex:mcp:check
npm run source:regression
npm run seed:check
```

Expected: every command passes.

- [ ] **Step 2: Run manual MCP smoke**

Run:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"seed-ready-smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"learning_agent.create_learning_project","arguments":{"request":"请把这份资料生成中文学习网页，先给总览课，再按核心 topic 拆课，每个单元 8 页，面向有编程基础的中文学习者。","runId":"seed-ready-smoke","sourcePath":"/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf","sourceKind":"book","audience":"有编程基础但缺少系统心智模型的中文学习者","unitPages":8,"strategy":"overview_plus_topic"}}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"learning_agent.generate_grounded_course","arguments":{"runId":"seed-ready-smoke"}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"seed-ready-smoke"}}}' \
  | npm run mcp
```

Expected:

- `create_learning_project` returns `project_ready`.
- `generate_grounded_course` returns `preview_ready`.
- Course has at least 3 lessons.
- Preview URL is `http://127.0.0.1:5173/`.

- [ ] **Step 3: Verify browser**

Run:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/#/course/seed-ready-smoke
```

Expected:

- App opens learner-first course surface.
- Course has overview and focused units.
- Web Deck navigation works.
- Knowledge map opens.
- Source anchors are visible in course/map panels.

- [ ] **Step 4: Verify revision and export**

Run MCP smoke for revision:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"seed-ready-revision","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"learning_agent.revise_learning_course","arguments":{"runId":"seed-ready-smoke","feedback":"第 3 页太抽象，换成更贴近工程实践的例子。"}}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"learning_agent.apply_learning_revision","arguments":{"runId":"seed-ready-smoke"}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"learning_agent.export_learning_course","arguments":{"runId":"seed-ready-smoke"}}}' \
  | npm run mcp
```

Expected:

- Revision result is `revision_applied`.
- Export result is `export_ready`.
- `runs/seed-ready-smoke/exports/static-course/manifest.json` exists.

- [ ] **Step 5: Update docs**

Update `README.md`, `docs/runtime/seed-user-quickstart.md`, and `docs/roadmap.md` to state:

- Seed-ready path uses `create_learning_project -> generate_grounded_course -> get_learning_preview`.
- Feedback path uses `revise_learning_course -> apply_learning_revision`.
- Export path uses `export_learning_course`.
- Long sources produce overview plus multiple focused units.

- [ ] **Step 6: Commit verification docs**

Run:

```bash
git add README.md docs/runtime/seed-user-quickstart.md docs/roadmap.md
git commit -m "docs: document seed-ready learning flow"
```

## Release Gate

Before marking Seed-Ready Product complete, run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run codex:mcp:check
npm run source:regression
npm run seed:check
```

All commands must pass.

Manual browser verification must confirm:

- Course library is visible.
- Course overview or current course is learner-first.
- Overview unit opens.
- At least two focused units open.
- Web Deck page navigation works.
- Knowledge map renders generated and pending units.
- Feedback can create and apply a targeted revision.
- Export manifest is written.

## Self-Review Notes

Spec coverage:

- Stabilize current alpha: Task 1.
- Project library: Tasks 2 and 7.
- Multi-unit generation: Task 3.
- Source-semantic extraction: Task 4.
- Targeted revision: Task 5.
- Stable routes: Task 6.
- Knowledge Map v1: Task 8.
- Export bundle: Task 9.
- Semantic regression and seed acceptance: Tasks 10 and 11.

Known intentional deferrals:

- Full tutor, teacher, and assessment modes remain outside Seed-Ready scope.
- Direct model-provider routing remains outside Seed-Ready scope.
- Cloud deployment remains outside Seed-Ready scope.
