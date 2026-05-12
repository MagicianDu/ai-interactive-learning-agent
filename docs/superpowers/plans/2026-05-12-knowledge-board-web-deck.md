# Knowledge Board Web Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade professor-style Web Decks from role-template pages to source-grounded knowledge board pages.

**Architecture:** Add `knowledgeBoard` as an optional structured page object, render it only in `textbook_deck` mode, and keep old `title + narrative + visualSpec` pages as fallback. Authoring guidance will ask Codex to write source proposition driven board pages, while quality checks will block professor-mode pages that lack board density or source trace.

**Tech Stack:** React, TypeScript, Vite, Vitest, Playwright, existing learner runtime, existing MCP publishing pipeline, Markdown docs.

---

## Scope Check

This plan implements one subsystem: the professor-style Web Deck content model and rendering path. It does not change MCP transport, runtime adapters, Codex installation, mental-model lessons, source ingestion formats, or the public product sidebar.

## File Structure

- Create: `src/components/deck/KnowledgeBoard.tsx`
  - Responsibility: render a board page from `LessonPage.knowledgeBoard`.
- Create: `src/components/deck/KnowledgeBoard.test.tsx`
  - Responsibility: verify two-column board rendering, hidden source trace, and compact bottom line.
- Modify: `src/schemas/lesson.schema.ts`
  - Responsibility: expose `KnowledgeBoard` types and optional `LessonPage.knowledgeBoard`.
- Modify: `src/renderers/WebDeckRenderer.tsx`
  - Responsibility: prefer `KnowledgeBoard` for `textbook_deck` pages.
- Modify: `src/renderers/WebDeckRenderer.test.tsx`
  - Responsibility: verify board rendering and fallback behavior.
- Modify: `tools/agent-runtime/quality/test-fixtures.ts`
  - Responsibility: provide board-rich professor fixtures for runtime tests.
- Create: `tools/agent-runtime/quality/knowledge-board-rubric.ts`
  - Responsibility: evaluate board completeness, source trace, and density.
- Create: `tools/agent-runtime/quality/knowledge-board-rubric.test.ts`
  - Responsibility: prove board-rich lessons pass and shallow pages warn or fail.
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
  - Responsibility: include board checks in professor-mode reports.
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`
  - Responsibility: verify professor-mode report blocks missing boards.
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.ts`
  - Responsibility: request knowledge board fields in professor page blueprints.
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.test.ts`
  - Responsibility: verify professor blueprints require board fields.
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
  - Responsibility: tell Codex to write board pages.
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`
  - Responsibility: verify authoring contract exposes the board requirement.
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.ts`
  - Responsibility: update skill/MCP authoring instructions for board pages.
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.test.ts`
  - Responsibility: verify guidance names the board structure.
- Modify: `tools/agent-runtime/learner/learning-course-publisher.test.ts`
  - Responsibility: verify preview JSON preserves board metadata and professor missing-board output returns `revision_required`.
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/lessons/*.json`
  - Responsibility: refresh the seed preview with real board pages after the runtime path supports them.

## Task 1: Schema And Test Fixtures

**Files:**
- Modify: `src/schemas/lesson.schema.ts`
- Modify: `tools/agent-runtime/quality/test-fixtures.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Add the failing type expectation**

Add this block to the bottom of `src/schemas/lesson.schema.ts` temporarily while implementing Task 1, then remove it before committing:

```ts
const knowledgeBoardTypeCheck: LessonPage = {
  id: "board-type-check",
  type: "structure_diagram",
  title: "类型检查页",
  learningGoal: "验证知识板书结构",
  narrative: "类型检查用中文正文。",
  knowledgeBoard: {
    boardKind: "mechanism_board",
    headline: "从原文命题到机制链",
    coreProposition: "可靠的 agent workflow 需要显式状态和失败恢复。",
    leftColumn: [
      {
        label: "机制链",
        emphasis: "mechanism",
        items: ["任务压力进入 workflow", "中间状态被记录", "失败信号触发恢复"]
      }
    ],
    rightColumn: [
      {
        label: "例子",
        emphasis: "example",
        items: ["资料采样 -> 章节映射 -> 单元生成 -> 质量审查"]
      }
    ],
    sourceTrace: [
      {
        anchorId: "source-001:chapter-1-prompt-chaining",
        supports: "该章节支持 workflow 被拆成多个可检查步骤。"
      }
    ],
    bottomLine: "知识板书页必须让学生看到命题、机制、证据和结论。"
  }
};

void knowledgeBoardTypeCheck;
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run:

```bash
npm run typecheck
```

Expected:

```text
Property 'knowledgeBoard' does not exist on type 'LessonPage'.
```

- [ ] **Step 3: Add schema types**

In `src/schemas/lesson.schema.ts`, add this type block after `FeedbackSpec`:

```ts
export type KnowledgeBoardKind =
  | "definition_board"
  | "mechanism_board"
  | "evidence_board"
  | "example_board"
  | "comparison_board"
  | "boundary_board"
  | "synthesis_board";

export type BoardSectionEmphasis = "definition" | "mechanism" | "example" | "boundary" | "note";

export type BoardSection = {
  label: string;
  items: string[];
  emphasis?: BoardSectionEmphasis;
};

export type SourceTraceItem = {
  anchorId: string;
  supports: string;
};

export type KnowledgeBoard = {
  boardKind: KnowledgeBoardKind;
  headline: string;
  coreProposition: string;
  leftColumn: BoardSection[];
  rightColumn: BoardSection[];
  sourceTrace: SourceTraceItem[];
  bottomLine: string;
};
```

Then add this property to `LessonPage`:

```ts
  knowledgeBoard?: KnowledgeBoard;
```

- [ ] **Step 4: Run typecheck to verify the schema compiles**

Run:

```bash
npm run typecheck
```

Expected:

```text
tsc exits 0.
```

- [ ] **Step 5: Add board fixture helpers**

In `tools/agent-runtime/quality/test-fixtures.ts`, extend `TestPage` with:

```ts
  knowledgeBoard?: {
    boardKind: string;
    headline: string;
    coreProposition: string;
    leftColumn: Array<{ label: string; items: string[]; emphasis?: string }>;
    rightColumn: Array<{ label: string; items: string[]; emphasis?: string }>;
    sourceTrace: Array<{ anchorId: string; supports: string }>;
    bottomLine: string;
  };
```

Add this exported helper after `publishableLessonFixture`:

```ts
export function professorBoardLessonFixture({
  id = "professor-board",
  targetPageCount = 8,
  title = "Agentic Workflow 教授板书"
}: {
  id?: string;
  title?: string;
  targetPageCount?: number;
} = {}): TestLesson {
  const base = publishableLessonFixture({ id, title, targetPageCount });
  return {
    ...base,
    displayMode: "textbook_deck",
    audience: "大学/研究生课程式中文学习者",
    prerequisites: ["理解 LLM 输出不确定性", "理解 workflow 可以拆成状态和动作"],
    learningObjectives: ["解释知识节点", "沿关键链路复述机制", "识别边界条件"],
    pages: base.pages.map((pageItem, index) => ({
      ...pageItem,
      title: `${pageItem.title} · 知识板书`,
      narrative: "本页以知识板书方式呈现命题、机制、证据和结论。",
      sourceAnchorIds: [`source-001:page-${index + 1}`],
      grounding: { kind: "source", note: "测试来源锚点" },
      knowledgeBoard: {
        boardKind: index === base.pages.length - 1 ? "synthesis_board" : "mechanism_board",
        headline: "从来源命题重构知识链路",
        coreProposition: "Agentic workflow 的质量来自显式状态、证据检查和失败恢复。",
        leftColumn: [
          {
            label: "概念链",
            emphasis: "mechanism",
            items: ["任务压力", "控制结构", "中间状态", "失败恢复"]
          },
          {
            label: "拆解",
            emphasis: "definition",
            items: ["把单次回答拆成可检查步骤", "把隐含推理变成显式记录"]
          }
        ],
        rightColumn: [
          {
            label: "例子",
            emphasis: "example",
            items: ["资料采样", "章节映射", "单元生成", "质量审查"]
          },
          {
            label: "边界",
            emphasis: "boundary",
            items: ["短任务不一定需要 workflow", "无状态记录的多 agent 只是 prompt 堆叠"]
          }
        ],
        sourceTrace: [
          {
            anchorId: `source-001:page-${index + 1}`,
            supports: "来源支持本页关于 workflow 拆解和显式状态的讲解。"
          }
        ],
        bottomLine: "板书页要同时给出命题、机制、例子和边界。"
      }
    }))
  } as TestLesson;
}
```

- [ ] **Step 6: Remove the temporary type-check constant**

Delete `knowledgeBoardTypeCheck` from `src/schemas/lesson.schema.ts`.

- [ ] **Step 7: Run targeted verification**

Run:

```bash
npm run typecheck
npm run test:unit -- tools/agent-runtime/quality/course-quality-report.test.ts
```

Expected:

```text
typecheck exits 0.
course-quality-report tests pass with existing behavior unchanged.
```

- [ ] **Step 8: Commit Task 1**

```bash
git add src/schemas/lesson.schema.ts tools/agent-runtime/quality/test-fixtures.ts
git commit -m "feat: add knowledge board lesson schema"
```

## Task 2: Knowledge Board Renderer

**Files:**
- Create: `src/components/deck/KnowledgeBoard.tsx`
- Create: `src/components/deck/KnowledgeBoard.test.tsx`
- Modify: `src/renderers/WebDeckRenderer.tsx`
- Modify: `src/renderers/WebDeckRenderer.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `src/components/deck/KnowledgeBoard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { KnowledgeBoard as KnowledgeBoardData } from "../../schemas/lesson.schema";
import { KnowledgeBoard } from "./KnowledgeBoard";

const board: KnowledgeBoardData = {
  boardKind: "mechanism_board",
  headline: "从来源命题到机制链",
  coreProposition: "可靠的 agent workflow 需要显式状态和失败恢复。",
  leftColumn: [
    {
      label: "机制链",
      emphasis: "mechanism",
      items: ["任务压力进入 workflow", "中间状态被记录", "失败信号触发恢复"]
    }
  ],
  rightColumn: [
    {
      label: "例子与边界",
      emphasis: "example",
      items: ["资料采样 -> 章节映射 -> 单元生成", "短任务可能不需要复杂 workflow"]
    }
  ],
  sourceTrace: [
    {
      anchorId: "source-001:page-12",
      supports: "支持 workflow 需要显式步骤。"
    }
  ],
  bottomLine: "本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。"
};

describe("KnowledgeBoard", () => {
  test("renders board columns and hides source trace by default", () => {
    render(<KnowledgeBoard board={board} />);

    expect(screen.getByText("从来源命题到机制链")).toBeInTheDocument();
    expect(screen.getByText("可靠的 agent workflow 需要显式状态和失败恢复。")).toBeInTheDocument();
    expect(screen.getByText("机制链")).toBeInTheDocument();
    expect(screen.getByText("任务压力进入 workflow")).toBeInTheDocument();
    expect(screen.getByText("例子与边界")).toBeInTheDocument();
    expect(screen.getByText("短任务可能不需要复杂 workflow")).toBeInTheDocument();
    expect(screen.getByText("本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。")).toBeInTheDocument();
    expect(screen.queryByText("source-001:page-12")).not.toBeInTheDocument();
  });

  test("marks the left and right columns as separate board regions", () => {
    render(<KnowledgeBoard board={board} />);

    const left = screen.getByLabelText("知识板书左栏");
    const right = screen.getByLabelText("知识板书右栏");

    expect(within(left).getByText("机制链")).toBeInTheDocument();
    expect(within(right).getByText("例子与边界")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run:

```bash
npm run test:unit -- src/components/deck/KnowledgeBoard.test.tsx
```

Expected:

```text
FAIL because ./KnowledgeBoard does not exist.
```

- [ ] **Step 3: Implement `KnowledgeBoard`**

Create `src/components/deck/KnowledgeBoard.tsx`:

```tsx
import type { KnowledgeBoard as KnowledgeBoardData, BoardSection } from "../../schemas/lesson.schema";

type KnowledgeBoardProps = {
  board: KnowledgeBoardData;
};

export function KnowledgeBoard({ board }: KnowledgeBoardProps) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3" data-testid="knowledge-board">
      <header className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{boardKindLabel(board.boardKind)}</p>
        <h3 className="mt-1 text-lg font-extrabold leading-tight text-slate-950 lg:text-xl">{board.headline}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 lg:text-base">{board.coreProposition}</p>
      </header>

      <div className="grid min-h-0 gap-3 lg:grid-cols-2">
        <BoardColumn ariaLabel="知识板书左栏" sections={board.leftColumn} />
        <BoardColumn ariaLabel="知识板书右栏" sections={board.rightColumn} />
      </div>

      <footer className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-extrabold leading-6 text-emerald-950">{board.bottomLine}</p>
      </footer>
    </section>
  );
}

function BoardColumn({ ariaLabel, sections }: { ariaLabel: string; sections: BoardSection[] }) {
  return (
    <div aria-label={ariaLabel} className="grid min-h-0 content-start gap-3">
      {sections.map((section) => (
        <article className="rounded-md border border-slate-200 bg-white px-4 py-3" key={`${section.label}:${section.items.join("|")}`}>
          <h4 className="text-sm font-extrabold text-slate-950">{section.label}</h4>
          <ul className="mt-2 grid gap-1.5">
            {section.items.map((item) => (
              <li className="text-sm font-semibold leading-6 text-slate-700" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function boardKindLabel(kind: KnowledgeBoardData["boardKind"]): string {
  const labels: Record<KnowledgeBoardData["boardKind"], string> = {
    boundary_board: "边界板书",
    comparison_board: "比较板书",
    definition_board: "定义板书",
    evidence_board: "证据板书",
    example_board: "例题板书",
    mechanism_board: "机制板书",
    synthesis_board: "综合板书"
  };
  return labels[kind];
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run:

```bash
npm run test:unit -- src/components/deck/KnowledgeBoard.test.tsx
```

Expected:

```text
2 tests pass.
```

- [ ] **Step 5: Add failing renderer tests**

Add this test to `src/renderers/WebDeckRenderer.test.tsx`:

```tsx
test("renders knowledgeBoard instead of generic visual chrome in textbook mode", () => {
  render(
    <WebDeckRenderer
      lesson={{
        ...baseLesson,
        displayMode: "textbook_deck",
        pages: [
          {
            ...baseLesson.pages[0]!,
            title: "知识板书页",
            narrative: "旧叙事仍保留为兼容字段。",
            knowledgeBoard: {
              boardKind: "mechanism_board",
              headline: "从命题到机制",
              coreProposition: "知识板书以命题、机制、证据和结论组织内容。",
              leftColumn: [{ label: "机制", items: ["拆解原文命题", "标出关键链路"], emphasis: "mechanism" }],
              rightColumn: [{ label: "例子", items: ["Agentic workflow 的状态记录"], emphasis: "example" }],
              sourceTrace: [{ anchorId: "source-001:page-1", supports: "支持本页命题。" }],
              bottomLine: "板书优先于普通图示渲染。"
            }
          }
        ]
      }}
    />
  );

  expect(screen.getByTestId("knowledge-board")).toBeInTheDocument();
  expect(screen.getByText("从命题到机制")).toBeInTheDocument();
  expect(screen.getByText("板书优先于普通图示渲染。")).toBeInTheDocument();
  expect(screen.queryByText("source-001:page-1")).not.toBeInTheDocument();
});
```

- [ ] **Step 6: Run renderer tests to verify the new test fails**

Run:

```bash
npm run test:unit -- src/renderers/WebDeckRenderer.test.tsx
```

Expected:

```text
FAIL because knowledge-board is not rendered.
```

- [ ] **Step 7: Wire `KnowledgeBoard` into `WebDeckRenderer`**

In `src/renderers/WebDeckRenderer.tsx`, add:

```ts
import { KnowledgeBoard } from "../components/deck/KnowledgeBoard";
```

Inside the render callback, after `const hasAssessmentContent`, add:

```ts
const hasKnowledgeBoard = isTextbookDeck && Boolean(page?.knowledgeBoard);
```

Before the existing visual grid return, add this branch inside `DeckPage` children:

```tsx
{hasKnowledgeBoard && page.knowledgeBoard ? (
  <KnowledgeBoard board={page.knowledgeBoard} />
) : (
  <div
    className={
      page.visualSpec && hasSideContent
        ? "grid min-h-0 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"
        : "grid min-h-0 gap-3 lg:gap-4"
    }
  >
    {page.visualSpec || !hasSideContent ? <VisualRenderer title={page.title} visualSpec={page.visualSpec} /> : null}

    {hasSideContent ? (
      <div className="grid min-h-0 content-start gap-3">
        {hasInteractionContent ? <InteractionRenderer interactionSpec={page.interactionSpec} /> : null}

        {hasAssessmentContent && page.assessmentSpec ? (
          <AssessmentRenderer assessmentSpec={page.assessmentSpec} feedbackSpec={page.feedbackSpec} />
        ) : null}

        {page.code ? <CodeBlock language={page.code.language} value={page.code.value} /> : null}

        {page.type === "summary_card" ? (
          <ConceptCard title={isTextbookDeck ? "总结" : "记住这张心智模型卡"} items={lesson.summary} />
        ) : null}
      </div>
    ) : null}
  </div>
)}
```

- [ ] **Step 8: Run renderer tests**

Run:

```bash
npm run test:unit -- src/components/deck/KnowledgeBoard.test.tsx src/renderers/WebDeckRenderer.test.tsx
```

Expected:

```text
Both test files pass.
```

- [ ] **Step 9: Commit Task 2**

```bash
git add src/components/deck/KnowledgeBoard.tsx src/components/deck/KnowledgeBoard.test.tsx src/renderers/WebDeckRenderer.tsx src/renderers/WebDeckRenderer.test.tsx
git commit -m "feat: render textbook knowledge boards"
```

## Task 3: Authoring Guidance And Blueprint

**Files:**
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.ts`
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.test.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.ts`
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.test.ts`

- [ ] **Step 1: Add failing blueprint expectations**

In `tools/agent-runtime/learner/content-quality-blueprint.test.ts`, add expectations to the professor-mode test:

```ts
expect(blueprint.globalRules.join("\n")).toContain("knowledgeBoard");
expect(blueprint.globalRules.join("\n")).toContain("原文命题");
expect(blueprint.units[0]?.pageBlueprints[0]?.mustInclude).toEqual(
  expect.arrayContaining(["knowledgeBoard", "coreProposition", "leftColumn", "rightColumn", "sourceTrace", "bottomLine"])
);
```

- [ ] **Step 2: Run blueprint test to verify it fails**

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/content-quality-blueprint.test.ts
```

Expected:

```text
FAIL because professor-mode rules do not require knowledgeBoard.
```

- [ ] **Step 3: Update blueprint professor rules**

In `tools/agent-runtime/learner/content-quality-blueprint.ts`, add these professor-mode global rules:

```ts
"教授式 Web Deck 每页必须优先写成 knowledgeBoard：headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine。",
"内容逻辑必须从原文命题进入：source proposition -> decomposition -> evidence -> reconstruction，不能只套页面角色模板。",
"每个 knowledgeBoard 至少包含两个结构化 section、一个例子/机制/比较/边界，以及一个可追溯 sourceTrace。"
```

In `buildUnitBlueprint`, when `courseIntent === "professor_lecture_deck"`, append these `mustInclude` values to every page blueprint:

```ts
"knowledgeBoard",
"coreProposition",
"leftColumn",
"rightColumn",
"sourceTrace",
"bottomLine"
```

- [ ] **Step 4: Run blueprint tests**

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/content-quality-blueprint.test.ts
```

Expected:

```text
All content-quality-blueprint tests pass.
```

- [ ] **Step 5: Add failing authoring guidance expectations**

In `tools/agent-runtime/learner/authoring-context-service.test.ts`, extend the professor-mode test with:

```ts
expect(context.authoringContract.requirements.join("\n")).toContain("knowledgeBoard");
expect(context.authoringContract.requirements.join("\n")).toContain("原文命题");
expect(context.codexInstruction).toContain("knowledgeBoard");
expect(context.codexInstruction).toContain("左栏");
expect(context.codexInstruction).toContain("右栏");
```

In `tools/agent-runtime/learner/bundle-authoring-guidance.test.ts`, extend the professor guidance test with:

```ts
expect(guidance).toContain("knowledgeBoard");
expect(guidance).toContain("source proposition");
expect(guidance).toContain("leftColumn");
expect(guidance).toContain("rightColumn");
```

- [ ] **Step 6: Run authoring guidance tests to verify they fail**

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/bundle-authoring-guidance.test.ts
```

Expected:

```text
FAIL because guidance still describes board ideas only as prose.
```

- [ ] **Step 7: Update authoring instructions**

In `tools/agent-runtime/learner/authoring-context-service.ts`, update professor-mode requirement strings to include:

```text
每个 professor_lecture_deck 页面必须优先填写 page.knowledgeBoard。knowledgeBoard 使用 headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine。内容逻辑是原文命题 -> 拆解 -> 证据 -> 重构。
```

In `buildCodexInstruction`, add:

```text
写作格式：每页保留 title 和 narrative 兼容字段，但正式内容放入 knowledgeBoard。leftColumn 放概念链、机制链、定义或推导；rightColumn 放例子、反例、来源证据或边界。sourceTrace 记录 anchorId 和 supports，但学生侧默认不直接显示。
```

In `tools/agent-runtime/learner/bundle-authoring-guidance.ts`, update professor-mode items 3-5 to:

```text
3. 教授式 Web Deck 采用 knowledgeBoard：headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine。
4. 内容逻辑必须是 source proposition -> decomposition -> evidence -> reconstruction；不要只写一个 narrative 段落。
5. leftColumn 放知识链、机制链、定义或推导；rightColumn 放例子、反例、来源证据或边界；sourceTrace 保留来源支持关系。
```

- [ ] **Step 8: Run authoring guidance tests**

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/bundle-authoring-guidance.test.ts
```

Expected:

```text
All three test files pass.
```

- [ ] **Step 9: Commit Task 3**

```bash
git add tools/agent-runtime/learner/content-quality-blueprint.ts tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/learner/authoring-context-service.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/bundle-authoring-guidance.ts tools/agent-runtime/learner/bundle-authoring-guidance.test.ts
git commit -m "feat: require knowledge board authoring"
```

## Task 4: Knowledge Board Quality Gate

**Files:**
- Create: `tools/agent-runtime/quality/knowledge-board-rubric.ts`
- Create: `tools/agent-runtime/quality/knowledge-board-rubric.test.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`
- Modify: `tools/agent-runtime/learner/learning-course-publisher.test.ts`

- [ ] **Step 1: Write failing rubric tests**

Create `tools/agent-runtime/quality/knowledge-board-rubric.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { professorBoardLessonFixture, publishableLessonFixture } from "./test-fixtures.js";
import { evaluateKnowledgeBoardRubric } from "./knowledge-board-rubric.js";

describe("evaluateKnowledgeBoardRubric", () => {
  test("passes board-rich professor lessons", () => {
    const result = evaluateKnowledgeBoardRubric([professorBoardLessonFixture()]);

    expect(result.status).toBe("passed");
    expect(result.issues).toEqual([]);
  });

  test("fails professor lessons that only contain narrative pages", () => {
    const result = evaluateKnowledgeBoardRubric([publishableLessonFixture({ id: "narrative-only" })]);

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "knowledge-board.page.missing",
          severity: "error"
        })
      ])
    );
  });

  test("fails boards without source trace", () => {
    const lesson = professorBoardLessonFixture({ id: "missing-trace" });
    lesson.pages[0]!.knowledgeBoard!.sourceTrace = [];

    const result = evaluateKnowledgeBoardRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "knowledge-board.source-trace.missing",
          pageId: "p1",
          severity: "error"
        })
      ])
    );
  });
});
```

- [ ] **Step 2: Run rubric tests to verify they fail**

Run:

```bash
npm run test:unit -- tools/agent-runtime/quality/knowledge-board-rubric.test.ts
```

Expected:

```text
FAIL because knowledge-board-rubric does not exist.
```

- [ ] **Step 3: Implement the rubric**

Create `tools/agent-runtime/quality/knowledge-board-rubric.ts`:

```ts
import { isRecord } from "./validation-result.js";

export type KnowledgeBoardRubricStatus = "passed" | "failed";

export type KnowledgeBoardRubricIssue = {
  issueId: string;
  severity: "error" | "warning";
  lessonId: string;
  pageId: string;
  reason: string;
  requiredFix: string;
};

export type KnowledgeBoardRubricResult = {
  status: KnowledgeBoardRubricStatus;
  checkedPageCount: number;
  issueCount: number;
  issues: KnowledgeBoardRubricIssue[];
};

export function evaluateKnowledgeBoardRubric(lessons: unknown[]): KnowledgeBoardRubricResult {
  const issues = lessons.flatMap((lesson) => evaluateLesson(lesson));
  return {
    status: issues.some((issue) => issue.severity === "error") ? "failed" : "passed",
    checkedPageCount: lessons.reduce((sum, lesson) => sum + pagesOf(lesson).length, 0),
    issueCount: issues.length,
    issues
  };
}

function evaluateLesson(lesson: unknown): KnowledgeBoardRubricIssue[] {
  const lessonId = isRecord(lesson) && typeof lesson.id === "string" ? lesson.id : "unknown-lesson";
  return pagesOf(lesson).flatMap((page) => evaluatePage(lessonId, page));
}

function evaluatePage(lessonId: string, page: Record<string, unknown>): KnowledgeBoardRubricIssue[] {
  const pageId = typeof page.id === "string" ? page.id : "unknown-page";
  const board = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  if (!board) {
    return [
      {
        issueId: "knowledge-board.page.missing",
        severity: "error",
        lessonId,
        pageId,
        reason: "Professor-mode page is missing page.knowledgeBoard.",
        requiredFix: "Add page.knowledgeBoard with headline, coreProposition, leftColumn, rightColumn, sourceTrace, and bottomLine."
      }
    ];
  }

  const issues: KnowledgeBoardRubricIssue[] = [];
  if (!nonEmptyString(board.coreProposition)) {
    issues.push(issue("knowledge-board.core-proposition.missing", lessonId, pageId, "Add a precise coreProposition."));
  }
  if (!nonEmptySectionArray(board.leftColumn) || !nonEmptySectionArray(board.rightColumn)) {
    issues.push(issue("knowledge-board.columns.shallow", lessonId, pageId, "Fill both leftColumn and rightColumn with structured board sections."));
  }
  if (!Array.isArray(board.sourceTrace) || board.sourceTrace.length === 0) {
    issues.push(issue("knowledge-board.source-trace.missing", lessonId, pageId, "Add sourceTrace entries that connect anchorId to the claim they support."));
  }
  if (!nonEmptyString(board.bottomLine)) {
    issues.push(issue("knowledge-board.bottom-line.missing", lessonId, pageId, "Add a bottomLine conclusion."));
  }
  return issues;
}

function pagesOf(lesson: unknown): Array<Record<string, unknown>> {
  if (!isRecord(lesson) || !Array.isArray(lesson.pages)) {
    return [];
  }
  return lesson.pages.filter(isRecord);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8;
}

function nonEmptySectionArray(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.every((section) => isRecord(section) && nonEmptyString(section.label) && Array.isArray(section.items) && section.items.length > 0);
}

function issue(issueId: string, lessonId: string, pageId: string, requiredFix: string): KnowledgeBoardRubricIssue {
  return {
    issueId,
    severity: "error",
    lessonId,
    pageId,
    reason: requiredFix,
    requiredFix
  };
}
```

- [ ] **Step 4: Run rubric tests**

Run:

```bash
npm run test:unit -- tools/agent-runtime/quality/knowledge-board-rubric.test.ts
```

Expected:

```text
3 tests pass.
```

- [ ] **Step 5: Add failing course quality expectations**

In `tools/agent-runtime/quality/course-quality-report.test.ts`, add:

```ts
test("fails professor-mode lessons that do not include knowledge boards", () => {
  const lesson = publishableLessonFixture({ id: "quality-professor-no-board", targetPageCount: 8 });

  const report = buildCourseQualityReport({
    runId: "quality-professor-no-board",
    coursePackId: "quality-professor-no-board",
    lessons: [lesson],
    authoringContext: { courseIntent: "professor_lecture_deck" }
  });

  expect(report.status).toBe("failed");
  expect(report.checks.professorLecture).toBe("failed");
  expect(report.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        issueId: "knowledge-board.page.missing",
        category: "lecture_structure"
      })
    ])
  );
});

test("passes professor-mode lessons with knowledge boards", () => {
  const lesson = professorBoardLessonFixture({ id: "quality-professor-board", targetPageCount: 8 });

  const report = buildCourseQualityReport({
    runId: "quality-professor-board",
    coursePackId: "quality-professor-board",
    lessons: [lesson],
    authoringContext: { courseIntent: "professor_lecture_deck" }
  });

  expect(report.checks.professorLecture).toBe("passed");
  expect(report.issues.some((issue) => issue.issueId.startsWith("knowledge-board."))).toBe(false);
});
```

- [ ] **Step 6: Run course quality tests to verify they fail**

Run:

```bash
npm run test:unit -- tools/agent-runtime/quality/course-quality-report.test.ts
```

Expected:

```text
FAIL because course-quality-report does not call the knowledge board rubric.
```

- [ ] **Step 7: Integrate the rubric into course quality report**

In `tools/agent-runtime/quality/course-quality-report.ts`, import:

```ts
import { evaluateKnowledgeBoardRubric, type KnowledgeBoardRubricResult } from "./knowledge-board-rubric.js";
```

Add `knowledgeBoardRubric?: KnowledgeBoardRubricResult;` to `CourseQualityReport`.

Inside `buildCourseQualityReport`, after `professorLectureRubric`, add:

```ts
const knowledgeBoardRubric = professorMode ? evaluateKnowledgeBoardRubric(input.lessons) : undefined;
const knowledgeBoardIssues = knowledgeBoardRubric
  ? knowledgeBoardRubric.issues.map((issue) => ({
      issueId: issue.issueId,
      scope: "page" as const,
      severity: issue.severity,
      category: "lecture_structure" as const,
      reason: issue.reason,
      requiredFix: issue.requiredFix,
      rule: issue.issueId,
      path: `${issue.lessonId}.${issue.pageId}.knowledgeBoard`,
      lessonId: issue.lessonId,
      pageId: issue.pageId
    }))
  : [];
```

Add `...knowledgeBoardIssues` to the `issues` array.

Set `checks.professorLecture` from both professor rubric and board issues:

```ts
professorLecture: statusFromCourseQualityIssues([...professorLectureIssues, ...knowledgeBoardIssues])
```

Add `...(knowledgeBoardRubric ? { knowledgeBoardRubric } : {})` to the returned report.

- [ ] **Step 8: Add publisher revision test**

In `tools/agent-runtime/learner/learning-course-publisher.test.ts`, add a professor-mode test using `LearnerProjectService`:

```ts
test("requires knowledge boards before publishing professor lecture decks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-professor-board-"));
  await new LearnerProjectService(root).createProject({
    request: "请生成教授式课程讲义 Web Deck，面向研究生，每个单元 8 页。",
    runId: "professor-board-required",
    courseIntent: "professor_lecture_deck",
    difficultyLevel: "upper_undergraduate_or_graduate",
    unitPages: 8
  });

  const result = await new LearningCoursePublisher(root).publish({
    runId: "professor-board-required",
    lessons: [publishableLessonFixture({ id: "professor-board-required-overview", title: "教授讲义：总览课", targetPageCount: 8 })],
    coursePack: coursePackFixture("professor-board-required", "professor-board-required-overview")
  });

  expect(result.status).toBe("revision_required");
  if (result.status !== "revision_required") {
    throw new Error("expected revision_required");
  }
  expect(result.qualityReport.topIssues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        issueId: "knowledge-board.page.missing"
      })
    ])
  );
});
```

- [ ] **Step 9: Run quality and publisher tests**

Run:

```bash
npm run test:unit -- tools/agent-runtime/quality/knowledge-board-rubric.test.ts tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts
```

Expected:

```text
All three test files pass.
```

- [ ] **Step 10: Commit Task 4**

```bash
git add tools/agent-runtime/quality/knowledge-board-rubric.ts tools/agent-runtime/quality/knowledge-board-rubric.test.ts tools/agent-runtime/quality/course-quality-report.ts tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts
git commit -m "feat: validate professor knowledge boards"
```

## Task 5: Seed Preview Knowledge Board Refresh

**Files:**
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/lessons/professor-agentic-design-depth-v2-20260511-overview.json`
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/lessons/professor-agentic-design-depth-v2-20260511-topic-01.json`
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/lessons/professor-agentic-design-depth-v2-20260511-topic-02.json`
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/lessons/professor-agentic-design-depth-v2-20260511-topic-03.json`
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/lessons/professor-agentic-design-depth-v2-20260511-topic-04.json`
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/lessons/professor-agentic-design-depth-v2-20260511-topic-05.json`
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/lessons/professor-agentic-design-depth-v2-20260511-topic-06.json`
- Modify: `runs/professor-agentic-design-depth-v2-20260511/preview/manifest.json`

- [ ] **Step 1: Add a failing preview assertion script**

Run this command before modifying preview JSON:

```bash
node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
const lessonPath = 'runs/professor-agentic-design-depth-v2-20260511/preview/lessons/professor-agentic-design-depth-v2-20260511-overview.json';
const lesson = JSON.parse(await readFile(lessonPath, 'utf8'));
const missing = lesson.pages.filter((page) => !page.knowledgeBoard).map((page) => page.id);
console.log(JSON.stringify({ lessonId: lesson.id, missing }, null, 2));
if (missing.length > 0) process.exit(1);
NODE
```

Expected:

```text
Exit 1, with missing page ids.
```

- [ ] **Step 2: Convert each existing preview page to include `knowledgeBoard`**

For each lesson JSON, add a `knowledgeBoard` object to every page. Use this exact mapping:

```text
p1  -> synthesis_board
p2  -> definition_board
p3  -> synthesis_board
p4  -> definition_board
p5  -> mechanism_board
p6  -> example_board
p7  -> comparison_board
p8  -> evidence_board
p9  -> boundary_board
p10 -> synthesis_board
```

For each page, derive:

```text
headline        = page.title
coreProposition = the main claim from page.narrative, rewritten as one precise sentence
leftColumn      = concept chain, mechanism chain, definition, or comparison
rightColumn     = example, counterexample, source-backed note, or boundary
sourceTrace     = first two page.sourceAnchorIds with supports text
bottomLine      = one durable conclusion for the page
```

For page `p5` in the overview lesson, the resulting object should look like:

```json
"knowledgeBoard": {
  "boardKind": "mechanism_board",
  "headline": "关键链路：从压力到控制结构",
  "coreProposition": "Agentic Design Patterns 把任务压力转化为可检查的控制结构。",
  "leftColumn": [
    {
      "label": "机制链",
      "emphasis": "mechanism",
      "items": [
        "任务压力决定是否需要 workflow",
        "workflow 把隐含推理变成显式中间状态",
        "中间状态进入证据检查",
        "检查失败触发回退、重试或升级"
      ]
    }
  ],
  "rightColumn": [
    {
      "label": "例子与边界",
      "emphasis": "example",
      "items": [
        "长资料课程生成需要资料采样、章节映射、单元生成和质量审查",
        "短任务、低风险任务不一定需要复杂 workflow"
      ]
    }
  ],
  "sourceTrace": [
    {
      "anchorId": "source-001:chapter-1-prompt-chaining",
      "supports": "支持把复杂任务拆成多个可检查步骤。"
    },
    {
      "anchorId": "source-001:chapter-2-routing",
      "supports": "支持根据任务条件选择不同控制路径。"
    }
  ],
  "bottomLine": "关键链路不是术语列表，而是从任务压力到控制结构的因果路径。"
}
```

- [ ] **Step 3: Update preview manifest notes**

In `runs/professor-agentic-design-depth-v2-20260511/preview/manifest.json`, set `publishNotes` to:

```json
"教材式知识链路 Web Deck 已升级为知识板书结构：学生侧以标题、核心命题、双栏板书和本页结论为主，来源 trace 保留给质量检查和来源视图。"
```

Prepend this item to `revisionHistory`:

```json
{
  "runId": "professor-agentic-design-depth-v2-20260511",
  "revisionId": "knowledge-board-v8",
  "scope": "style",
  "summary": "升级为教授板书双栏结构：每页包含核心命题、左右栏知识板书、来源 trace 和本页结论。",
  "changedLessonIds": [
    "professor-agentic-design-depth-v2-20260511-overview",
    "professor-agentic-design-depth-v2-20260511-topic-01",
    "professor-agentic-design-depth-v2-20260511-topic-02",
    "professor-agentic-design-depth-v2-20260511-topic-03",
    "professor-agentic-design-depth-v2-20260511-topic-04",
    "professor-agentic-design-depth-v2-20260511-topic-05",
    "professor-agentic-design-depth-v2-20260511-topic-06"
  ],
  "changedPages": [],
  "qualityStatus": "passed",
  "createdAt": "2026-05-12T00:00:00.000Z"
}
```

- [ ] **Step 4: Run preview JSON assertions**

Run:

```bash
node --input-type=module <<'NODE'
import { readdir, readFile } from 'node:fs/promises';
const dir = 'runs/professor-agentic-design-depth-v2-20260511/preview/lessons';
const files = (await readdir(dir)).filter((file) => file.endsWith('.json'));
const failures = [];
for (const file of files) {
  const lesson = JSON.parse(await readFile(`${dir}/${file}`, 'utf8'));
  for (const page of lesson.pages) {
    const board = page.knowledgeBoard;
    if (!board) failures.push(`${file}:${page.id}:missing board`);
    if (board && (!board.coreProposition || board.leftColumn.length === 0 || board.rightColumn.length === 0 || board.sourceTrace.length === 0 || !board.bottomLine)) {
      failures.push(`${file}:${page.id}:incomplete board`);
    }
  }
}
console.log(JSON.stringify({ files: files.length, failures }, null, 2));
if (failures.length > 0) process.exit(1);
NODE
```

Expected:

```text
failures is [] and command exits 0.
```

- [ ] **Step 5: Commit Task 5**

```bash
git add runs/professor-agentic-design-depth-v2-20260511/preview/lessons/*.json runs/professor-agentic-design-depth-v2-20260511/preview/manifest.json
git commit -m "chore: refresh professor seed with knowledge boards"
```

## Task 6: End-To-End Verification

**Files:**
- Modify only if checks reveal issues in files touched by Tasks 1-5.

- [ ] **Step 1: Run full local checks**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected:

```text
All commands exit 0.
```

- [ ] **Step 2: Start or reuse the dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected:

```text
Vite serves http://127.0.0.1:5173/
```

- [ ] **Step 3: Run browser-level board assertions**

Run this in a separate terminal while the dev server is running:

```bash
node --input-type=module <<'NODE'
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/#/preview/professor-agentic-design-depth-v2-20260511';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="knowledge-board"]', { timeout: 10_000 });
const bodyText = await page.locator('body').innerText();
const forbidden = ['自学目标', '页内自测', '答案解析', '迁移练习', '本页反馈', '完成进度', '答题记录'];
const present = forbidden.filter((term) => bodyText.includes(term));
const boardCount = await page.locator('[data-testid="knowledge-board"]').count();
const bodyFits = await page.evaluate(() => document.body.scrollHeight <= window.innerHeight + 2);
console.log(JSON.stringify({ url, boardCount, present, bodyFits }, null, 2));
await browser.close();
if (boardCount < 1 || present.length > 0 || !bodyFits) process.exit(1);
NODE
```

Expected:

```text
boardCount is at least 1.
present is [].
bodyFits is true.
```

- [ ] **Step 4: Check git diff scope**

Run:

```bash
git status --short
git diff --stat
```

Expected:

```text
Only schema, renderer, professor authoring, quality gate, tests, and seed preview files changed after the task commits.
```

- [ ] **Step 5: Final commit if verification required fixes**

If Step 1 or Step 3 required fix commits, stage only the touched files and run:

```bash
git add <fixed-files>
git commit -m "fix: stabilize knowledge board verification"
```

If no fixes were required, skip this step.

## Self-Review

- Spec coverage: schema, rendering, hidden source trace, authoring guidance, quality gate, seed preview, and viewport checks are covered by Tasks 1-6.
- Placeholder scan: no open placeholder markers or incomplete code blocks remain.
- Type consistency: the plan uses `knowledgeBoard`, `KnowledgeBoard`, `BoardSection`, `SourceTraceItem`, `sourceTrace`, `leftColumn`, `rightColumn`, and `bottomLine` consistently across schema, renderer, authoring, and quality tasks.
- Scope control: this plan does not modify MCP transport, adapter contracts, mental-model lesson behavior, or the product sidebar.
