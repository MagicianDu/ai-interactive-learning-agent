# Seed User Product Acceleration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rapidly turn the current beta kernel into a seed-user-facing product experience where users can see a polished learning workspace, understand the generation flow, explore multiple learning product forms, and share generated outputs.

**Architecture:** Keep the current runtime, MCP tools, promoted lessons, and course-pack registry as the backend/kernel. Build a stronger React product shell on top: guided start, course workspace, product-mode surfaces, generation/review timeline, sample gallery, and share/export affordances. Do not block on hosted SaaS or provider APIs; make the local/Codex-driven workflow feel like a coherent product.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, lucide-react, existing lesson/course schemas, Vitest, Testing Library, Playwright/browser smoke where available.

---

## Product Acceleration Boundary

This plan targets a larger seed-user trial where users need to feel:

```text
This is not a JSON runtime demo.
This is a product that turns technical sources into interactive Chinese learning experiences.
```

The product should show:

- A clear Chinese product home/workspace instead of only selectors.
- A guided “create learning project” experience that produces Codex/MCP-ready prompts and commands.
- A course-pack workspace with learning path, source coverage, generated units, and next actions.
- Multiple usable learning product forms: Web Deck, Knowledge Map, Practice, Teacher, Playground, Tutor.
- Better Chinese learning content presentation, not only engineering metadata.
- Share/export affordances for seed users to show results to others.

## Non-Goals

- Hosted login, cloud persistence, payments, team accounts, or SaaS deployment.
- Fully automatic browser-to-MCP execution from the frontend.
- Direct provider API adapters for OpenAI/Anthropic.
- Perfect semantic parsing of every long book.
- Full real-time collaborative editing.

## Speed Strategy

Prioritize product-perceived value:

```text
Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5
```

Then add operational support:

```text
Task 6 -> Task 7 -> Task 8
```

Task 1-5 should be developed first even if Task 6-8 are not complete.

---

## Task 1: Product Home And Guided Start

**Files:**
- Create: `src/product/ProductHome.tsx`
- Create: `src/product/GuidedStartPanel.tsx`
- Create: `src/product/product-copy.ts`
- Modify: `src/app/App.tsx`
- Test: `src/product/ProductHome.test.tsx`

- [ ] **Step 1: Create product copy constants**

Create `src/product/product-copy.ts`:

```ts
export const productCopy = {
  name: "AI Interactive Learning Agent",
  headline: "把技术资料变成可交互的中文学习体验",
  subtitle: "从书籍、论文、专利、博客或笔记出发，生成总览课、核心 topic 课、练习、教师材料和实验视图。",
  primaryAction: "创建学习项目",
  secondaryAction: "查看示例课程",
  supportedSources: ["书籍 PDF", "论文", "专利", "技术博客", "课程笔记", "文档目录"],
  workflow: ["导入资料", "规划课程", "审核关键节点", "生成多种学习形态", "分享或继续迭代"]
} as const;
```

- [ ] **Step 2: Build guided start panel**

Create `src/product/GuidedStartPanel.tsx` with controlled fields:

```ts
type GuidedStartState = {
  sourcePath: string;
  sourceKind: "book" | "paper" | "patent" | "blog" | "documentation" | "notes";
  audience: string;
  unitPages: number;
  strategy: "overview_plus_topic" | "chapter_guided" | "topic_guided" | "hybrid";
};
```

Required behavior:

- Default language is Chinese.
- Generate a Chinese Codex prompt.
- Generate a CLI command using `npm run agent:plan`.
- Include copy buttons for both prompt and command.
- Show a short “接下来会发生什么” workflow list.

Prompt template:

```text
请用这份资料生成一套中文学习材料：{sourcePath}
资料类型是 {sourceKind}。先给一个总览课，再按核心 topic 拆课。
每个单元 {unitPages} 页，面向 {audience}。
保留来源映射，关键节点先让我审核。遇到 reviewQueue 时不要自动 approve。
```

- [ ] **Step 3: Build product home**

Create `src/product/ProductHome.tsx`:

```ts
type ProductHomeProps = {
  courseCount: number;
  lessonCount: number;
  onStart: () => void;
  onOpenSamples: () => void;
};
```

Render:

- Product name and Chinese headline.
- Two action buttons.
- Source type chips.
- Workflow steps.
- Stats: course packs, lessons, product modes.
- Embed `GuidedStartPanel` when start is active.

- [ ] **Step 4: Integrate into App**

Modify `src/app/App.tsx`:

- Add top-level mode state:

```ts
type AppSection = "home" | "workspace";
```

- Default to `home`.
- Product home action “查看示例课程” opens `workspace`.
- Keep the existing course workspace behavior intact.

- [ ] **Step 5: Test**

Create `src/product/ProductHome.test.tsx`:

```ts
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { ProductHome } from "./ProductHome";

describe("ProductHome", () => {
  test("shows Chinese product positioning and guided start", async () => {
    const user = userEvent.setup();
    render(<ProductHome courseCount={2} lessonCount={5} onOpenSamples={() => undefined} onStart={() => undefined} />);

    expect(screen.getByText("把技术资料变成可交互的中文学习体验")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "创建学习项目" }));
    expect(screen.getByText(/请用这份资料生成一套中文学习材料/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run test -- src/product/ProductHome.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/product src/app/App.tsx
git commit -m "Add product home and guided start"
```

---

## Task 2: Course Workspace Upgrade

**Files:**
- Create: `src/product/CourseWorkspace.tsx`
- Create: `src/product/CourseHero.tsx`
- Create: `src/product/ProductModeTabs.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/components/course/CourseShell.tsx`
- Test: `src/product/CourseWorkspace.test.tsx`

- [ ] **Step 1: Extract workspace from App**

Create `src/product/CourseWorkspace.tsx`:

```ts
type CourseWorkspaceProps = {
  lessons: typeof lessonRegistry;
  coursePacks: typeof coursePackRegistry;
};
```

Move current course pack selector, lesson selector, mode switch, `CourseShell`, `CanvasMapRenderer`, `LearningProductRenderer`, and `WebDeckRenderer` orchestration from `App.tsx` into this component.

- [ ] **Step 2: Add course hero**

Create `src/product/CourseHero.tsx`:

```ts
type CourseHeroProps = {
  title: string;
  sourceKind?: string;
  strategy?: string;
  unitCount: number;
  generatedCount: number;
  modeLabel: string;
};
```

Show:

- Course title.
- Source kind.
- Strategy.
- Generated progress.
- Current learning mode.
- Primary action “开始学习当前单元”.

- [ ] **Step 3: Add product mode tabs**

Create `src/product/ProductModeTabs.tsx` using icon buttons from `lucide-react`:

```ts
type ProductModeTab = {
  id: "deck" | "map" | "assessment" | "teacher" | "playground" | "tutor";
  label: string;
  description: string;
};
```

Required labels:

```text
学习
知识地图
练习
教师
实验
导师
```

- [ ] **Step 4: Improve CourseShell product language**

Modify `src/components/course/CourseShell.tsx`:

- Rename visible label `资料包` to `学习项目`.
- Rename `有课件` to `已生成`.
- Rename `待生成单元` to `待生成`.
- Add short unit path copy:

```text
先用总览课建立全局地图，再进入核心 topic。
```

- [ ] **Step 5: Test**

Create `src/product/CourseWorkspace.test.tsx`:

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CourseWorkspace } from "./CourseWorkspace";
import { lessonRegistry } from "../lessons/registry";
import { coursePackRegistry } from "../course-packs/registry";

describe("CourseWorkspace", () => {
  test("renders product mode tabs and course progress", () => {
    render(<CourseWorkspace lessons={lessonRegistry} coursePacks={coursePackRegistry} />);

    expect(screen.getByRole("button", { name: /学习/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /知识地图/ })).toBeInTheDocument();
    expect(screen.getByText(/已生成/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run test -- src/product/CourseWorkspace.test.tsx src/components/course/CourseShell.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/product src/app/App.tsx src/components/course/CourseShell.tsx
git commit -m "Upgrade course workspace experience"
```

---

## Task 3: Make Product Modes Feel Real

**Files:**
- Modify: `src/renderers/LearningProductRenderer.tsx`
- Create: `src/renderers/AssessmentProductView.tsx`
- Create: `src/renderers/TeacherProductView.tsx`
- Create: `src/renderers/PlaygroundProductView.tsx`
- Create: `src/renderers/TutorProductView.tsx`
- Test: `src/renderers/LearningProductRenderer.test.tsx`

- [ ] **Step 1: Split mode renderers**

Move existing mode-specific code out of `LearningProductRenderer.tsx` into four files:

```text
AssessmentProductView.tsx
TeacherProductView.tsx
PlaygroundProductView.tsx
TutorProductView.tsx
```

Keep `LearningProductRenderer.tsx` as a dispatcher.

- [ ] **Step 2: Upgrade Assessment mode**

`AssessmentProductView` must provide:

- Quiz list.
- Learner answer selection for multiple-choice pages.
- Immediate explanatory feedback.
- Misconception and transfer sections.
- Completion count.

State shape:

```ts
const [answers, setAnswers] = useState<Record<string, string>>({});
```

- [ ] **Step 3: Upgrade Teacher mode**

`TeacherProductView` must provide:

- 45-minute suggested pacing.
- Instructor notes generated from page goals.
- Classroom questions.
- Common misconception handling.
- “复制教学提纲” button.

The copied outline should include:

```text
课程标题
学习目标
页面节奏
课堂提问
误区提醒
迁移任务
```

- [ ] **Step 4: Upgrade Playground mode**

`PlaygroundProductView` must:

- Render interaction pages as experiment cards.
- Let user switch options.
- Show observation and feedback.
- Include “我观察到了什么” note area per card.

- [ ] **Step 5: Upgrade Tutor mode**

`TutorProductView` must:

- Render a guided conversation script.
- Let user pick “我不理解 / 给我例子 / 考考我”.
- Return deterministic Chinese responses from lesson content.
- Make clear this is a local tutor simulation, not a live LLM chat.

- [ ] **Step 6: Test**

Update `src/renderers/LearningProductRenderer.test.tsx`:

```ts
test("assessment mode provides answer feedback", async () => {
  const user = userEvent.setup();
  render(<LearningProductRenderer lesson={databaseIndexLesson} mode="assessment" />);
  await user.click(screen.getAllByRole("button")[0]!);
  expect(screen.getByText(/反馈|为什么/)).toBeInTheDocument();
});
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm run test -- src/renderers/LearningProductRenderer.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/renderers
git commit -m "Make learning product modes interactive"
```

---

## Task 4: Generation And Review Timeline In Product UI

**Files:**
- Create: `src/product/GenerationTimeline.tsx`
- Create: `src/product/demoBetaStatus.ts`
- Modify: `src/product/CourseWorkspace.tsx`
- Test: `src/product/GenerationTimeline.test.tsx`

- [ ] **Step 1: Add demo beta status model**

Create `src/product/demoBetaStatus.ts` with a static beta-status-like object:

```ts
export const demoBetaStatus = {
  status: "beta_status",
  parent: {
    approvedGates: ["source-map", "concept-map", "curriculum-plan"],
    nextActions: ["Run learning_agent.run_course for demo-course-pack to create or advance course units."]
  },
  operatorHints: {
    readyToPromote: false,
    reviewQueue: [],
    nextToolCalls: [
      {
        toolName: "learning_agent.run_course",
        input: { runId: "demo-course-pack", unitSelector: "all", maxSteps: 20 },
        reason: "Create or advance child unit runs."
      }
    ]
  },
  childRuns: [
    { unitId: "unit-overview", title: "总览课", approvedGates: ["learning-architecture", "lesson", "critic-report"] },
    { unitId: "unit-topic-01", title: "核心 topic", approvedGates: ["learning-architecture", "lesson"] }
  ]
} as const;
```

- [ ] **Step 2: Build timeline**

Create `src/product/GenerationTimeline.tsx`:

```ts
type GenerationTimelineProps = {
  status: typeof demoBetaStatus;
};
```

Render stages:

```text
资料解析
概念图谱
课程规划
单元生成
质量检查
发布
```

For each stage show:

- completed / active / waiting state.
- related gate.
- next tool call if active.
- review queue count.

- [ ] **Step 3: Integrate into workspace**

Modify `CourseWorkspace.tsx`:

- Add a right-side or top band “生成进度”.
- Use `demoBetaStatus` for now.
- Display next MCP call in Chinese:

```text
下一步：learning_agent.run_course
```

- [ ] **Step 4: Test**

Create `src/product/GenerationTimeline.test.tsx`:

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { GenerationTimeline } from "./GenerationTimeline";
import { demoBetaStatus } from "./demoBetaStatus";

describe("GenerationTimeline", () => {
  test("shows review-aware generation stages", () => {
    render(<GenerationTimeline status={demoBetaStatus} />);

    expect(screen.getByText("资料解析")).toBeInTheDocument();
    expect(screen.getByText(/下一步：learning_agent.run_course/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test -- src/product/GenerationTimeline.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/product
git commit -m "Add generation timeline to product workspace"
```

---

## Task 5: Share And Export Experience

**Files:**
- Create: `src/product/ShareExportPanel.tsx`
- Modify: `src/product/CourseWorkspace.tsx`
- Test: `src/product/ShareExportPanel.test.tsx`

- [ ] **Step 1: Build export panel**

Create `ShareExportPanel.tsx`:

```ts
type ShareExportPanelProps = {
  lessonTitle: string;
  courseTitle?: string;
  lessonJson: unknown;
};
```

Actions:

- Copy current URL.
- Copy lesson title and summary.
- Download lesson JSON via `Blob`.
- Show suggested share message in Chinese.

Share message template:

```text
我用 AI Interactive Learning Agent 生成了一套中文互动学习材料：《{lessonTitle}》。
它包含学习路径、可视化解释、互动练习、误区检查和迁移任务。
```

- [ ] **Step 2: Integrate into workspace**

Modify `CourseWorkspace.tsx`:

- Add `ShareExportPanel` near the course hero.
- Pass selected lesson data.

- [ ] **Step 3: Test**

Create `ShareExportPanel.test.tsx`:

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ShareExportPanel } from "./ShareExportPanel";

describe("ShareExportPanel", () => {
  test("shows Chinese share message and export action", () => {
    render(<ShareExportPanel lessonTitle="哈希表为什么快" lessonJson={{ id: "hash-table" }} />);

    expect(screen.getByText(/中文互动学习材料/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导出 JSON/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run test -- src/product/ShareExportPanel.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/product
git commit -m "Add share and export panel"
```

---

## Task 6: Seed Demo Gallery With Product Stories

**Files:**
- Create: `src/product/SampleGallery.tsx`
- Create: `src/product/sampleStories.ts`
- Modify: `src/product/ProductHome.tsx`
- Test: `src/product/SampleGallery.test.tsx`

- [ ] **Step 1: Define sample stories**

Create `sampleStories.ts`:

```ts
export const sampleStories = [
  {
    id: "book",
    sourceType: "书籍",
    title: "一本技术书 -> 总览课 + topic 课程包",
    promise: "适合快速建立系统心智模型。",
    examplePrompt: "请用这本书生成中文课程包：先做总览课，再按核心 topic 拆课。"
  },
  {
    id: "paper",
    sourceType: "论文",
    title: "一篇论文 -> 方法解释 + 复现实验路径",
    promise: "适合理解论文贡献、方法边界和实验逻辑。",
    examplePrompt: "请用这篇论文生成中文学习材料，重点解释方法、实验和局限。"
  },
  {
    id: "patent",
    sourceType: "专利",
    title: "一份专利 -> 权利要求地图 + 技术方案课",
    promise: "适合理解 claims、实施例和技术差异。",
    examplePrompt: "请用这份专利生成中文学习材料，保留权利要求和实施例映射。"
  }
] as const;
```

- [ ] **Step 2: Build gallery**

Create `SampleGallery.tsx`:

- Render the three stories.
- Each card has source type, title, promise, prompt preview.
- Button “使用这个示例”.

- [ ] **Step 3: Integrate into ProductHome**

Show gallery below guided start. Clicking “使用这个示例” fills or displays its prompt in `GuidedStartPanel`.

- [ ] **Step 4: Test**

Run:

```bash
npm run test -- src/product/SampleGallery.test.tsx src/product/ProductHome.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/product
git commit -m "Add seed demo gallery"
```

---

## Task 7: Product Visual Pass And Responsive QA

**Files:**
- Modify: `src/styles/index.css`
- Modify: `src/product/*.tsx`
- Modify: `src/app/App.tsx`
- Test: existing UI tests

- [ ] **Step 1: Product style rules**

Apply these UI constraints:

- Chinese-first navigation labels.
- No nested cards inside cards.
- Dense but readable SaaS/product workspace layout.
- Avoid a dark-only one-note palette; use light workspace surfaces for product pages.
- No oversized marketing hero after first viewport; product controls must be visible immediately.
- Mobile width must keep buttons and labels from overflowing.

- [ ] **Step 2: Browser smoke**

Start:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

Check:

- Home loads.
- Guided start prompt visible.
- Workspace opens.
- Tabs switch: 学习 / 知识地图 / 练习 / 教师 / 实验 / 导师.
- No text overlap at desktop and mobile widths.

- [ ] **Step 3: Automated checks**

Run:

```bash
npm run test -- src/product src/renderers src/components/course
npm run typecheck
npm run build
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "Polish seed product experience"
```

---

## Task 8: Minimum Operational Guardrails

**Files:**
- Modify: `package.json`
- Create: `scripts/beta-seed-check.ts`
- Create: `docs/runtime/seed-user-guide.md`
- Create: `docs/runtime/seed-user-prompts.md`

- [ ] **Step 1: Add lightweight readiness command**

Add:

```json
"seed:check": "tsx scripts/beta-seed-check.ts"
```

`scripts/beta-seed-check.ts` should run:

```text
npm run test -- src/product src/renderers src/components/course tools/mcp-server/json-rpc-server.test.ts
npm run typecheck
npm run build
npm run mcp -- --list-tools
```

- [ ] **Step 2: Add seed user guide**

Create `docs/runtime/seed-user-guide.md` with:

```text
1. What the product does
2. How to use the web workspace
3. How to create a project prompt
4. How to connect Codex or Claude through MCP
5. How to review generated artifacts
6. How to view and share the result
7. Known beta limits
```

- [ ] **Step 3: Add prompt pack**

Create `docs/runtime/seed-user-prompts.md` with exact Chinese prompts for:

```text
Book -> overview_plus_topic course pack
Paper -> method and experiment learning path
Patent -> claim and embodiment map
Blog -> practical tutorial lesson
Continue existing run -> beta_status and operatorHints
```

- [ ] **Step 4: Final check and commit**

Run:

```bash
npm run seed:check
```

Expected: pass.

Commit:

```bash
git add package.json scripts docs/runtime
git commit -m "Add seed product readiness guide"
```

---

## Product Acceptance Criteria

Before inviting a larger seed-user group, the product must satisfy:

- The first screen clearly explains the product in Chinese.
- A user can generate a Codex-ready prompt without reading README.
- A user can open a course workspace and understand progress, units, source mapping, and modes.
- Web Deck, Knowledge Map, Practice, Teacher, Playground, and Tutor all feel intentionally designed, not placeholder pages.
- The generated lesson can be shared or exported from the UI.
- The product runs with `npm run dev` and builds with `npm run build`.
- The MCP workflow remains available for real generation.

## Recommended Parallelization

If using subagents:

- Worker A: Task 1 and Task 6, product home and gallery.
- Worker B: Task 2 and Task 5, workspace and share/export.
- Worker C: Task 3, learning product modes.
- Worker D: Task 4 and Task 8, generation timeline and operational docs.

Avoid parallel edits to `src/app/App.tsx`; merge Task 1 first, then Task 2.

## Self-Review

- Spec coverage: This revised plan directly targets product shape expansion and seed-user perceived experience, while preserving the existing MCP/runtime kernel.
- Placeholder scan: No TBD/TODO placeholders remain; each task includes exact files, behavior, commands, and expected outcomes.
- Type consistency: Product component names are consistent across tasks: `ProductHome`, `GuidedStartPanel`, `CourseWorkspace`, `ProductModeTabs`, `GenerationTimeline`, `ShareExportPanel`, and `SampleGallery`.
