# Knowledge Board Image/Text Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the learner-facing knowledge board into an image-left / text-right layout that keeps the visual readable and prevents the正文 from being squeezed out.

**Architecture:** Keep the lesson schema and deck shell unchanged. Localize the layout change in `KnowledgeBoard`, where the visual panel becomes a fixed-height left region and the board text becomes a compact right-side rail. The renderer should collapse to a vertical stack on narrow screens, but the page order and bottom summary must remain stable.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, the local Vite preview server, and browser verification in the Codex in-app browser.

---

## Scope Check

This plan touches one rendering slice: the `KnowledgeBoard` layout used by `textbook_deck` pages. It does not change lesson schema types, preview asset generation, authoring guidance, MCP transport, or the source-grounding pipeline.

## File Structure

- Modify: `src/components/deck/KnowledgeBoard.tsx`
  - Responsibility: render the image-left / text-right layout and keep the bottom summary pinned as the final block.
- Modify: `src/components/deck/KnowledgeBoard.test.tsx`
  - Responsibility: lock the new visual/text split, the compact text rail, and the no-table/no-diagram rule.
- Modify: `src/renderers/WebDeckRenderer.test.tsx`
  - Responsibility: prove the deck renderer still passes Weyl preview pages through the updated board layout without breaking the page shell.

## Task 1: Lock the new layout contract in tests

**Files:**
- Modify: `src/components/deck/KnowledgeBoard.test.tsx`
- Test: `npx vitest run src/components/deck/KnowledgeBoard.test.tsx -t "image-left"`

- [ ] **Step 1: Add the failing test for the image-left / text-right split**

Add this test block to `src/components/deck/KnowledgeBoard.test.tsx`:

```tsx
test("renders a left visual panel and a right text rail", () => {
  render(
    <KnowledgeBoard
      board={board}
      visualSpec={{
        kind: "diagram",
        description: "示意图来源于正文。",
        keyElements: ["关键节点"],
        imageUrl: "/__learning-preview/self-study-weyl-space-time-matter-v1/images/self-study-weyl-space-time-matter-v1-overview/page-06.svg",
        imageAlt: "Weyl 图示",
      }}
    />
  );

  const visualRegion = screen.getByLabelText("知识板书视觉区");
  const textRail = screen.getByLabelText("知识板书正文区");

  expect(within(visualRegion).getByRole("img", { name: "Weyl 图示" })).toBeVisible();
  expect(textRail).toHaveTextContent("机制链");
  expect(textRail).toHaveTextContent("例子与边界");
  expect(textRail).not.toHaveTextContent("知识表格");
  expect(textRail).not.toHaveTextContent("知识图示");
});
```

- [ ] **Step 2: Run the test and confirm it fails on the current layout**

Run:

```bash
npx vitest run src/components/deck/KnowledgeBoard.test.tsx -t "image-left"
```

Expected:

```text
FAIL because the current board still stacks the image above the text.
```

- [ ] **Step 3: Add the test for narrow-screen stacking order**

Add this second test block:

```tsx
test("stacks image above text on narrow screens without changing the reading order", () => {
  render(
    <KnowledgeBoard
      board={board}
      visualSpec={{
        kind: "diagram",
        description: "示意图来源于正文。",
        keyElements: ["关键节点"],
        imageUrl: "/__learning-preview/self-study-weyl-space-time-matter-v1/images/self-study-weyl-space-time-matter-v1-overview/page-06.svg",
        imageAlt: "Weyl 图示",
      }}
    />
  );

  expect(screen.getByLabelText("知识板书视觉区")).toBeInTheDocument();
  expect(screen.getByLabelText("知识板书正文区")).toBeInTheDocument();
  expect(screen.getByText("本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。")).toBeInTheDocument();
});
```

This test does not inspect CSS breakpoints directly. It anchors the semantic order so the implementation can switch between side-by-side and stacked layouts without changing content order.

## Task 2: Implement the image-left / text-right renderer

**Files:**
- Modify: `src/components/deck/KnowledgeBoard.tsx`
- Test: `npx vitest run src/components/deck/KnowledgeBoard.test.tsx`

- [ ] **Step 1: Split the board into a dedicated visual region and a text rail**

Refactor `KnowledgeBoard.tsx` toward this structure:

```tsx
function BoardSectionCard({ section }: { section: BoardSection }) {
  return (
    <div className="rounded-md border border-line bg-white p-2.5 shadow-sm">
      <div className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${emphasisClasses[section.emphasis ?? "note"]}`}>
        {section.label}
      </div>
      <ul className="mt-2 grid gap-1.5 text-sm font-medium leading-5 text-slate-700">
        {section.items.map((item) => (
          <li className="flex gap-2" key={item}>
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KnowledgeBoard({ board, visualSpec }: KnowledgeBoardProps) {
  const railSections = [...board.leftColumn, ...board.rightColumn];

  return (
    <section className="grid min-h-0 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="knowledge-board">
      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(18rem,1.08fr)_minmax(0,0.92fr)]">
        <figure aria-label="知识板书视觉区" className="overflow-hidden rounded-md border border-line bg-white shadow-sm">
          <div className="h-[clamp(15rem,22vw,20rem)] w-full bg-slate-100">
            <img
              alt={isNonEmptyString(visualSpec?.imageAlt) ? visualSpec.imageAlt : board.headline}
              className="h-full w-full object-contain"
              src={visualSpec.imageUrl}
            />
          </div>
        </figure>

        <section aria-label="知识板书正文区" className="grid min-h-0 content-start gap-2.5">
          {railSections.map((section) => (
            <BoardSectionCard key={`${section.label}-${section.items.join("|")}`} section={section} />
          ))}
        </section>
      </div>

      <p className="rounded-md border border-slate-900 bg-slate-950 px-3 py-2 text-sm font-bold leading-5 text-white">
        {board.bottomLine}
      </p>
    </section>
  );
}
```

Keep the current `board.bottomLine` as the last block. Do not reintroduce the old table or programmatic knowledge-diagram fallbacks.

- [ ] **Step 2: Run the test until the new layout passes**

Run:

```bash
npx vitest run src/components/deck/KnowledgeBoard.test.tsx
```

Expected:

```text
PASS with the image region on the left and the compact text rail on the right.
```

- [ ] **Step 3: Tighten spacing only if the image still crowds the text**

If the browser still shows crowding, reduce the image height first, then reduce text padding second. Use this order:

1. lower `h-[clamp(15rem,22vw,20rem)]` to `h-[clamp(13rem,18vw,18rem)]`
2. shrink `p-2.5` to `p-2`
3. shrink `gap-2.5` to `gap-2`

Do not widen the text rail or increase the overall page height. The goal is readability, not a denser page.

## Task 3: Prove the deck still renders Weyl page 6 correctly

**Files:**
- Modify: `src/renderers/WebDeckRenderer.test.tsx`
- Test: `npx vitest run src/renderers/WebDeckRenderer.test.tsx src/components/deck/KnowledgeBoard.test.tsx`
- Test: `npm run typecheck`
- Test: `npm run lint`

- [ ] **Step 1: Add the regression test that exercises the real preview lesson**

Add a test block in `src/renderers/WebDeckRenderer.test.tsx` that renders the Weyl lesson preview page and checks for readable page content:

```tsx
const weylLesson: Lesson = {
  ...databaseIndexLesson,
  id: "weyl-layout-test",
  displayMode: "textbook_deck",
  pages: [
    {
      id: "page-6",
      type: "structure_diagram",
      title: "广义相对论把引力放进 metric",
      learningGoal: "看清 metric、geodesic 和 curvature 的关系。",
      narrative: "本页要在一屏里同时看见图和正文。",
      visualSpec: {
        kind: "diagram",
        description: "Weyl 页面示意图",
        keyElements: ["metric", "geodesic", "curvature"],
        imageUrl: "/__learning-preview/self-study-weyl-space-time-matter-v1/images/self-study-weyl-space-time-matter-v1-overview/page-06.svg",
        imageAlt: "广义相对论把引力放进 metric",
      },
      knowledgeBoard: {
        boardKind: "mechanism_board",
        headline: "广义相对论把引力放进 metric",
        coreProposition: "自由落体可看成沿 geodesic 运动。",
        leftColumn: [
          {
            label: "机制链",
            emphasis: "mechanism",
            items: [
              "inertial force 与 gravitational field 需要统一解释。",
              "Einstein law 连接 curvature 与 energy-momentum.",
            ],
          },
        ],
        rightColumn: [
          {
            label: "例子与边界",
            emphasis: "example",
            items: [
              "旋转圆盘让几何条件卷入运动。",
              "把引力只当 Newtonian force 会看不到 metric.",
            ],
          },
        ],
        sourceTrace: [
          {
            anchorId: "source-001:page-6",
            supports: "Chapter IV 从 relativity of motion 进入 metrical fields and gravitation.",
          },
        ],
        bottomLine: "本页结论：引力不是单独的力项，而是几何结构的一部分。",
      },
    },
  ],
  config: { targetPageCount: 1 },
};

test("renders the Weyl preview page with a visible image and readable text rail", () => {
  render(<WebDeckRenderer lesson={weylLesson} initialPageIndex={5} />);

  expect(screen.getByRole("heading", { name: "广义相对论把引力放进 metric" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /广义相对论把引力放进 metric|Weyl 图示/ })).toBeVisible();
  expect(screen.getByText("自由落体可看成沿 geodesic 运动。")).toBeVisible();
  expect(screen.getByText("反例：把引力只当 Newtonian force 会看不到 metric。")).toBeVisible();
});
```

- [ ] **Step 2: Run the renderer test and confirm the page shell is unchanged**

Run:

```bash
npx vitest run src/renderers/WebDeckRenderer.test.tsx src/components/deck/KnowledgeBoard.test.tsx
```

Expected:

```text
PASS, with the page title and summary still present and the middle section no longer cramped.
```

- [ ] **Step 3: Verify the live preview in the in-app browser**

Run the dev server if needed:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/#/preview/self-study-weyl-space-time-matter-v1/unit/unit-overview/page/6
```

Check two viewports:

1. desktop width: image left, text right, summary visible, no vertical crowding
2. narrow width: image first, text second, same reading order, no truncation

- [ ] **Step 4: Finish with repo checks and commit**

Run:

```bash
npm run typecheck
npm run lint
git add src/components/deck/KnowledgeBoard.tsx src/components/deck/KnowledgeBoard.test.tsx src/renderers/WebDeckRenderer.test.tsx
git commit -m "feat: rebalance knowledge board layout"
```

## Acceptance Criteria

1. The knowledge board shows a readable image-left / text-right layout on desktop.
2. The same page stacks safely on narrow screens without changing content order.
3. `KnowledgeBoard` no longer renders the old image-above-text density pattern.
4. The Weyl preview page still shows the title, readable middle content, and bottom summary on one screen.
5. `npx vitest run src/components/deck/KnowledgeBoard.test.tsx src/renderers/WebDeckRenderer.test.tsx`, `npm run typecheck`, and `npm run lint` all pass.
