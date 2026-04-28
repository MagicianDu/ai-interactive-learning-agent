# Database Index MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable web-deck MVP for "Why database indexes make queries faster" while establishing a minimal reusable lesson schema, renderer, component set, and variable page-count contract.

**Architecture:** Use a vertical slice: typed lesson data flows into a generic `WebDeckRenderer`, which delegates to deck, visual, interaction, and assessment components. The database-index lesson is the first 10-page sample, but navigation, progress, schema metadata, and rendering must use `pages.length` and `targetPageCount` rather than a hard-coded total.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, SVG, Vitest, Testing Library, ESLint.

---

## Scope Decisions

- Lesson implementation data will be TypeScript, not runtime JSON import, to keep schema validation strong during early iteration.
- Tailwind will be used immediately because the UI needs fast iteration and consistent visual hierarchy.
- Interaction state will stay local inside interaction and assessment components.
- The current directory is not a git repository. Commit steps are included for the worker who initializes git or runs this inside a repo, but they cannot be executed until `.git/` exists.

## File Structure

Create or modify these files:

- Modify: `package.json` - add working scripts and dev dependencies for Vite, TypeScript, Tailwind, ESLint, Vitest.
- Create: `index.html` - Vite HTML entry.
- Create: `tsconfig.json` - app TypeScript config.
- Create: `tsconfig.node.json` - Vite config TypeScript config.
- Create: `vite.config.ts` - React/Vitest config.
- Create: `tailwind.config.ts` - Tailwind content config.
- Create: `postcss.config.js` - Tailwind PostCSS config.
- Create: `eslint.config.js` - flat ESLint config.
- Create: `src/main.tsx` - React root entry.
- Create: `src/app/App.tsx` - app-level lesson loading.
- Create: `src/styles/index.css` - Tailwind base and global styles.
- Create: `src/schemas/lesson.schema.ts` - lesson, page, visual, interaction, assessment, feedback, and page-count types.
- Create: `src/lessons/database-index/lesson.ts` - typed database-index lesson.
- Create: `src/renderers/WebDeckRenderer.tsx` - generic lesson-to-deck renderer.
- Create: `src/components/deck/DeckShell.tsx` - deck state and layout shell.
- Create: `src/components/deck/DeckPage.tsx` - page layout.
- Create: `src/components/deck/ProgressBar.tsx` - progress display based on actual page count.
- Create: `src/components/deck/PageNavigation.tsx` - previous/next controls.
- Create: `src/components/deck/PageDots.tsx` - page jump controls.
- Create: `src/components/assessment/FeedbackPanel.tsx` - explanatory feedback display.
- Create: `src/components/assessment/MultipleChoiceQuiz.tsx` - reusable MCQ.
- Create: `src/components/assessment/PredictionPrompt.tsx` - reusable prediction check.
- Create: `src/components/assessment/MisconceptionCheck.tsx` - reusable misconception check.
- Create: `src/components/assessment/TransferChallenge.tsx` - reusable transfer prompt.
- Create: `src/components/assessment/AssessmentRenderer.tsx` - assessment dispatcher.
- Create: `src/components/interaction/QueryPathVisualizer.tsx` - query path interaction.
- Create: `src/components/interaction/IndexTradeoffChecker.tsx` - index tradeoff interaction.
- Create: `src/components/interaction/InteractionRenderer.tsx` - interaction dispatcher.
- Create: `src/components/visual/DiagramFrame.tsx` - reusable visual frame.
- Create: `src/components/visual/TableScanVisual.tsx` - full scan SVG/HTML visual.
- Create: `src/components/visual/BookIndexComparison.tsx` - book index comparison visual.
- Create: `src/components/visual/IndexTreeVisual.tsx` - simplified B+ tree visual.
- Create: `src/components/visual/AccessPathFlow.tsx` - scan/index flow visual.
- Create: `src/components/visual/VisualRenderer.tsx` - visual dispatcher.
- Create: `src/components/common/CodeBlock.tsx` - small SQL/code block.
- Create: `src/components/common/ConceptCard.tsx` - compact concept card.
- Create: `src/test/setup.ts` - Testing Library setup.
- Create: `src/components/deck/DeckShell.test.tsx` - page-count and navigation tests.
- Create: `src/components/interaction/QueryPathVisualizer.test.tsx` - query path feedback tests.
- Create: `src/components/interaction/IndexTradeoffChecker.test.tsx` - tradeoff feedback tests.
- Create: `src/renderers/WebDeckRenderer.test.tsx` - 10-page rendering and variable page-count tests.
- Modify: `README.md` - add actual run and extension instructions after implementation.

---

### Task 1: Tooling And Project Entry

**Files:**
- Modify: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `eslint.config.js`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Replace `package.json` with working scripts and dependencies**

Use this content:

```json
{
  "name": "ai-interactive-learning-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "AI-driven interactive learning experience generator.",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "framer-motion": "^12.0.0",
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.18.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.18.0",
    "globals": "^15.14.0",
    "jsdom": "^25.0.1",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.20.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Add the Vite HTML entry**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Interactive Learning Agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.app.json" }
  ]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "allowJs": true,
    "strict": true
  },
  "include": ["vite.config.ts", "tailwind.config.ts", "postcss.config.js", "eslint.config.js"]
}
```

- [ ] **Step 4: Add Vite, Tailwind, PostCSS, ESLint, and test setup**

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        paper: "#f7f8fb",
        line: "#d9deea",
        accent: "#0f766e",
        signal: "#b45309"
      },
      boxShadow: {
        lesson: "0 18px 55px rgba(23, 32, 51, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
```

Create `postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

Create `eslint.config.js`:

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.app.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  }
);
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install exits successfully.

- [ ] **Step 6: Verify scripts are registered**

Run:

```bash
npm run typecheck
```

Expected: it may fail because source files are not created yet, but the command should invoke `tsc -b` rather than report a missing script.

- [ ] **Step 7: Commit**

If this directory has been initialized as git:

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts tailwind.config.ts postcss.config.js eslint.config.js src/test/setup.ts
git commit -m "chore: add frontend tooling"
```

Expected: commit succeeds. If `.git/` does not exist, skip this step and note it in the final implementation report.

---

### Task 2: Lesson Schema And Page Count Contract

**Files:**
- Create: `src/schemas/lesson.schema.ts`

- [ ] **Step 1: Write the schema file**

Create `src/schemas/lesson.schema.ts`:

```ts
export type LessonPageType =
  | "problem_scene"
  | "intuition_visual"
  | "structure_diagram"
  | "process_animation"
  | "interactive_model"
  | "code_walkthrough"
  | "quiz"
  | "misconception_check"
  | "transfer_challenge"
  | "summary_card";

export type VisualKind =
  | "diagram"
  | "flow"
  | "timeline"
  | "tree"
  | "table"
  | "graph"
  | "architecture"
  | "animation";

export type InteractionKind =
  | "stepper"
  | "slider"
  | "drag_drop"
  | "prediction"
  | "choice"
  | "code_edit"
  | "parameter_experiment"
  | "build_from_parts"
  | "query_path"
  | "index_tradeoff";

export type AssessmentKind =
  | "multiple_choice"
  | "true_false"
  | "ordering"
  | "prediction"
  | "debugging"
  | "short_answer"
  | "transfer";

export type LessonConfig = {
  targetPageCount: number;
  minPageCount?: number;
  maxPageCount?: number;
};

export type VisualSpec = {
  kind: VisualKind;
  description: string;
  keyElements: string[];
  states?: string[];
  component?: "table_scan" | "book_index" | "index_tree" | "access_path" | "tradeoff" | "summary";
};

export type InteractionOption = {
  id: string;
  label: string;
  resultTitle: string;
  outcomeId: string;
  resultTone: "neutral" | "success" | "warning" | "danger";
  explanation: string;
};

export type InteractionSpec = {
  kind: InteractionKind;
  learnerAction: string;
  expectedObservation: string;
  cognitivePurpose: string;
  options?: InteractionOption[];
};

export type AssessmentSpec = {
  kind: AssessmentKind;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
};

export type FeedbackSpec = {
  correctFeedback: string;
  incorrectFeedback: string;
  misconceptionAddressed?: string;
};

export type LessonPage = {
  id: string;
  type: LessonPageType;
  title: string;
  learningGoal: string;
  narrative: string;
  visualSpec?: VisualSpec;
  interactionSpec?: InteractionSpec;
  assessmentSpec?: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
  code?: {
    language: string;
    value: string;
  };
};

export type Misconception = {
  id: string;
  statement: string;
  correction: string;
};

export type TransferTask = {
  id: string;
  prompt: string;
  targetMentalModel: string;
};

export type Lesson = {
  id: string;
  title: string;
  audience: string;
  config: LessonConfig;
  prerequisites: string[];
  learningObjectives: string[];
  pages: LessonPage[];
  misconceptions: Misconception[];
  transferTasks: TransferTask[];
  summary: string[];
};

export function getPageCountLabel(lesson: Lesson): string {
  return `${lesson.pages.length} pages, target ${lesson.config.targetPageCount}`;
}
```

- [ ] **Step 2: Add a schema smoke test through TypeScript**

Run:

```bash
npm run typecheck
```

Expected: typecheck still may fail because app entry files are missing, but there should be no errors inside `src/schemas/lesson.schema.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/schemas/lesson.schema.ts
git commit -m "feat: define lesson schema"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 3: Database Index Lesson Data

**Files:**
- Create: `src/lessons/database-index/lesson.ts`

- [ ] **Step 1: Create the lesson directory**

Run:

```bash
mkdir -p src/lessons/database-index
```

Expected: directory exists.

- [ ] **Step 2: Create typed lesson data**

Create `src/lessons/database-index/lesson.ts` with the full 10-page sample. The first page should look exactly like this and the remaining pages should follow the approved design in `examples/database-index/lesson-design.json`, preserving the same IDs and adding `config` plus `visualSpec.component` values:

```ts
import type { Lesson } from "../../schemas/lesson.schema";

export const databaseIndexLesson = {
  id: "database-index-speed",
  title: "Why database indexes make queries faster",
  audience: "Learners who understand basic database tables and simple SQL SELECT queries.",
  config: {
    targetPageCount: 10,
    minPageCount: 6,
    maxPageCount: 14
  },
  prerequisites: [
    "A table is made of rows and columns.",
    "A WHERE clause filters rows.",
    "A database may inspect rows to answer a query."
  ],
  learningObjectives: [
    "Explain why a full table scan becomes expensive as a table grows.",
    "Describe how an index reduces the search space for selective queries.",
    "Predict when a query can use an index lookup versus a full scan.",
    "Identify tradeoffs of indexes, including write overhead and storage cost.",
    "Apply index reasoning to a new query or schema situation."
  ],
  pages: [
    {
      id: "p01-problem-10m-rows",
      type: "problem_scene",
      title: "The 10 million row question",
      learningGoal: "Feel the cost difference between looking everywhere and narrowing the search.",
      narrative:
        "A users table has 10 million rows. The product team asks for one user's order history by email. Without help, the database may need to inspect row after row until it finds the match.",
      visualSpec: {
        kind: "table",
        component: "table_scan",
        description: "A long table strip with one highlighted target row buried among many muted rows.",
        keyElements: ["10,000,000 rows label", "target email row", "scanner moving row by row", "work counter"],
        states: ["unknown target location", "scan begins", "many rows inspected", "target found"]
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "If there is no index on email, what is the worst-case number of rows the database may inspect?",
        options: ["1 row", "About log2(10,000,000) rows", "Up to 10,000,000 rows", "Only rows with matching email domain"],
        correctAnswer: "Up to 10,000,000 rows"
      },
      feedbackSpec: {
        correctFeedback: "Yes. Without a useful access path, the database may need to check every row in the table.",
        incorrectFeedback:
          "The tempting assumption is that the database somehow jumps to the right row. Without an index or another access path, it does not know where that row is."
      }
    }
  ],
  misconceptions: [
    {
      id: "m01-indexes-always-help",
      statement: "Indexes always make queries faster.",
      correction:
        "Indexes speed up queries only when they match the access pattern and reduce enough read work to justify storage and write maintenance."
    }
  ],
  transferTasks: [
    {
      id: "t01-cache-customer-lookup",
      prompt:
        "A cache has millions of objects and frequent lookups by customer_id. Decide whether to add a secondary lookup and explain the tradeoff.",
      targetMentalModel:
        "Use a maintained access path when repeated selective lookup saves more read work than it costs in writes and storage."
    }
  ],
  summary: [
    "A full table scan tests many rows because it has no shortcut to the target.",
    "An index is a separate organized access path over selected key values.",
    "A useful index reduces search space before row access.",
    "Selectivity and query/index alignment determine whether the index helps.",
    "Composite index order matters because the structure is sorted by leading keys first.",
    "Indexes trade read speed for write maintenance and storage overhead."
  ]
} satisfies Lesson;
```

When adding pages 2 through 10, use these required component mappings:

```ts
const requiredVisualComponentsByPage = {
  "p02-book-index-intuition": "book_index",
  "p03-table-vs-index-structure": "index_tree",
  "p04-full-table-scan": "table_scan",
  "p05-indexed-lookup": "access_path",
  "p06-query-path-visualizer": "access_path",
  "p07-indexes-always-help": "tradeoff",
  "p08-sql-walkthrough": "access_path",
  "p09-transfer-cache-lookup": "tradeoff",
  "p10-summary": "summary"
} as const;
```

For page 6, set `interactionSpec.kind` to `"query_path"` and include these options:

```ts
[
  {
    id: "email",
    label: "WHERE email = 'sam@example.com'",
    resultTitle: "Index lookup",
    outcomeId: "index_lookup",
    resultTone: "success",
    explanation: "The predicate matches the email index, so the database can search the ordered key structure before fetching the row."
  },
  {
    id: "created",
    label: "WHERE created_at > '2026-01-01'",
    resultTitle: "Full table scan",
    outcomeId: "full_scan",
    resultTone: "neutral",
    explanation: "The available index is on email, not created_at, so this condition does not provide a useful shortcut."
  },
  {
    id: "domain",
    label: "WHERE email LIKE '%@example.com'",
    resultTitle: "Limited or no index benefit",
    outcomeId: "partial_index",
    resultTone: "warning",
    explanation: "A leading wildcard prevents a simple ordered lookup because the searchable prefix is missing."
  }
]
```

For page 7, set `interactionSpec.kind` to `"index_tradeoff"` and include these options:

```ts
[
  {
    id: "unique-email",
    label: "Add index for frequent unique email lookup",
    resultTitle: "Good tradeoff",
    outcomeId: "good_tradeoff",
    resultTone: "success",
    explanation: "Frequent selective reads usually justify the extra index maintenance and storage."
  },
  {
    id: "tiny-report",
    label: "Add index for a rare report on a tiny table",
    resultTitle: "Weak tradeoff",
    outcomeId: "bad_tradeoff",
    resultTone: "warning",
    explanation: "The read savings are small, so write maintenance and storage may cost more than the index saves."
  },
  {
    id: "write-heavy",
    label: "Add many indexes to a write-heavy event table",
    resultTitle: "Risky tradeoff",
    outcomeId: "bad_tradeoff",
    resultTone: "danger",
    explanation: "Every write must maintain more index structures, so a write-heavy workload can slow down."
  }
]
```

- [ ] **Step 3: Add a page-count invariant test later in Task 11**

Do not add a separate test in this task. Task 11 will verify `databaseIndexLesson.pages.length === 10` and that a shortened copy renders correctly.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: lesson data type errors are fixed before moving on. If remaining errors come from missing app files, continue to Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/lessons/database-index/lesson.ts
git commit -m "feat: add database index lesson data"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 4: App Entry And Global Styles

**Files:**
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles/index.css`

- [ ] **Step 1: Create global CSS**

Create `src/styles/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color: #172033;
  background: #f7f8fb;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 248, 251, 0.96)),
    #f7f8fb;
}

button,
input,
textarea,
select {
  font: inherit;
}

#root {
  min-height: 100vh;
}
```

- [ ] **Step 2: Create app entry**

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/index.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 3: Create App component**

Create `src/app/App.tsx`:

```tsx
import { databaseIndexLesson } from "../lessons/database-index/lesson";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";

export function App() {
  return <WebDeckRenderer lesson={databaseIndexLesson} />;
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: failures now identify missing `WebDeckRenderer`; continue to Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/app/App.tsx src/styles/index.css
git commit -m "feat: add app entry"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 5: Deck Components

**Files:**
- Create: `src/components/deck/DeckShell.tsx`
- Create: `src/components/deck/DeckPage.tsx`
- Create: `src/components/deck/ProgressBar.tsx`
- Create: `src/components/deck/PageNavigation.tsx`
- Create: `src/components/deck/PageDots.tsx`

- [ ] **Step 1: Create `ProgressBar`**

```tsx
type ProgressBarProps = {
  currentIndex: number;
  total: number;
};

export function ProgressBar({ currentIndex, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const percentage = ((currentIndex + 1) / safeTotal) * 100;

  return (
    <div aria-label="Lesson progress" className="h-2 w-full rounded-full bg-slate-200">
      <div
        className="h-2 rounded-full bg-accent transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `PageNavigation`**

```tsx
import { ArrowLeft, ArrowRight } from "lucide-react";

type PageNavigationProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
};

export function PageNavigation({ canGoBack, canGoForward, onBack, onForward }: PageNavigationProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowLeft size={18} />
        Previous
      </button>
      <button
        type="button"
        onClick={onForward}
        disabled={!canGoForward}
        className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `PageDots`**

```tsx
type PageDotsProps = {
  total: number;
  currentIndex: number;
  onSelect: (index: number) => void;
};

export function PageDots({ total, currentIndex, onSelect }: PageDotsProps) {
  return (
    <div aria-label="Page selector" className="flex flex-wrap items-center gap-2">
      {Array.from({ length: total }, (_, index) => (
        <button
          key={index}
          type="button"
          aria-label={`Go to page ${index + 1}`}
          aria-current={index === currentIndex ? "page" : undefined}
          onClick={() => onSelect(index)}
          className={
            index === currentIndex
              ? "h-2.5 w-8 rounded-full bg-accent"
              : "h-2.5 w-2.5 rounded-full bg-slate-300 hover:bg-slate-400"
          }
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `DeckPage`**

```tsx
import type { ReactNode } from "react";
import type { LessonPage } from "../../schemas/lesson.schema";

type DeckPageProps = {
  page: LessonPage;
  pageNumber: number;
  totalPages: number;
  children: ReactNode;
};

export function DeckPage({ page, pageNumber, totalPages, children }: DeckPageProps) {
  return (
    <article className="grid min-h-[620px] gap-6 rounded-lg bg-white p-6 shadow-lesson lg:grid-cols-[0.9fr_1.2fr] lg:p-8">
      <section className="flex flex-col gap-5">
        <div className="text-sm font-semibold uppercase tracking-wide text-accent">
          Page {pageNumber} of {totalPages}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500">{page.type.replaceAll("_", " ")}</p>
          <h1 className="text-3xl font-semibold leading-tight text-ink">{page.title}</h1>
        </div>
        <p className="rounded-md border border-line bg-paper p-4 text-sm font-medium text-slate-700">
          Learning goal: {page.learningGoal}
        </p>
        <p className="text-base leading-7 text-slate-700">{page.narrative}</p>
      </section>
      <section className="min-w-0">{children}</section>
    </article>
  );
}
```

- [ ] **Step 5: Create `DeckShell`**

```tsx
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Lesson } from "../../schemas/lesson.schema";
import { PageDots } from "./PageDots";
import { PageNavigation } from "./PageNavigation";
import { ProgressBar } from "./ProgressBar";

type DeckShellProps = {
  lesson: Lesson;
  renderPage: (currentIndex: number) => ReactNode;
};

export function DeckShell({ lesson, renderPage }: DeckShellProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = lesson.pages.length;
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < total - 1;
  const pageCountLabel = useMemo(() => {
    const target = lesson.config.targetPageCount;
    return target ? `${total} pages, target ${target}` : `${total} pages`;
  }, [lesson.config.targetPageCount, total]);

  function goTo(index: number) {
    setCurrentIndex(Math.min(Math.max(index, 0), total - 1));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 py-5 md:px-8">
      <header className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-accent">AI Interactive Learning Agent</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink md:text-3xl">{lesson.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{lesson.audience}</p>
          </div>
          <div className="rounded-md bg-paper px-3 py-2 text-sm font-medium text-slate-700">{pageCountLabel}</div>
        </div>
        <ProgressBar currentIndex={currentIndex} total={total} />
      </header>
      {renderPage(currentIndex)}
      <footer className="flex flex-col gap-4 rounded-lg border border-line bg-white p-4 md:flex-row md:items-center md:justify-between">
        <PageDots total={total} currentIndex={currentIndex} onSelect={goTo} />
        <PageNavigation
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={() => goTo(currentIndex - 1)}
          onForward={() => goTo(currentIndex + 1)}
        />
      </footer>
    </main>
  );
}
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: deck components typecheck. Remaining failures reference missing renderer and child components.

- [ ] **Step 7: Commit**

```bash
git add src/components/deck
git commit -m "feat: add deck shell"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 6: Assessment Components

**Files:**
- Create: `src/components/assessment/FeedbackPanel.tsx`
- Create: `src/components/assessment/MultipleChoiceQuiz.tsx`
- Create: `src/components/assessment/PredictionPrompt.tsx`
- Create: `src/components/assessment/MisconceptionCheck.tsx`
- Create: `src/components/assessment/TransferChallenge.tsx`
- Create: `src/components/assessment/AssessmentRenderer.tsx`

- [ ] **Step 1: Create feedback component**

```tsx
type FeedbackPanelProps = {
  tone: "neutral" | "correct" | "incorrect";
  title: string;
  children: string;
};

export function FeedbackPanel({ tone, title, children }: FeedbackPanelProps) {
  const toneClass =
    tone === "correct"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "incorrect"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-line bg-paper text-slate-700";

  return (
    <section className={`rounded-md border p-4 ${toneClass}`} aria-live="polite">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6">{children}</p>
    </section>
  );
}
```

- [ ] **Step 2: Create multiple choice and prediction components**

Both components should accept `assessmentSpec` and `feedbackSpec`, render options, compare selected option to `correctAnswer`, and show `FeedbackPanel`.

Use this core answer function in both files:

```tsx
function getFeedback(selected: string, correctAnswer: string | undefined) {
  if (!correctAnswer) {
    return "neutral" as const;
  }
  return selected === correctAnswer ? "correct" : "incorrect";
}
```

- [ ] **Step 3: Create misconception and transfer components**

`MisconceptionCheck` should present the prompt and a pair of buttons:

```tsx
const choices = ["This is always true", "It depends on workload and query shape"];
```

`TransferChallenge` should present the prompt, a textarea, and a "Show model answer" button. The model answer should use `assessmentSpec.correctAnswer` when present.

- [ ] **Step 4: Create assessment dispatcher**

Create `src/components/assessment/AssessmentRenderer.tsx`:

```tsx
import type { AssessmentSpec, FeedbackSpec } from "../../schemas/lesson.schema";
import { MisconceptionCheck } from "./MisconceptionCheck";
import { MultipleChoiceQuiz } from "./MultipleChoiceQuiz";
import { PredictionPrompt } from "./PredictionPrompt";
import { TransferChallenge } from "./TransferChallenge";

type AssessmentRendererProps = {
  assessmentSpec: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
};

export function AssessmentRenderer({ assessmentSpec, feedbackSpec }: AssessmentRendererProps) {
  if (assessmentSpec.kind === "prediction") {
    return <PredictionPrompt assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />;
  }

  if (assessmentSpec.kind === "multiple_choice") {
    return <MultipleChoiceQuiz assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />;
  }

  if (assessmentSpec.kind === "transfer") {
    return <TransferChallenge assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />;
  }

  return <MisconceptionCheck assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />;
}
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: assessment files typecheck after imports are aligned.

- [ ] **Step 6: Commit**

```bash
git add src/components/assessment
git commit -m "feat: add assessment components"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 7: Visual Components

**Files:**
- Create: `src/components/visual/DiagramFrame.tsx`
- Create: `src/components/visual/TableScanVisual.tsx`
- Create: `src/components/visual/BookIndexComparison.tsx`
- Create: `src/components/visual/IndexTreeVisual.tsx`
- Create: `src/components/visual/AccessPathFlow.tsx`
- Create: `src/components/visual/VisualRenderer.tsx`

- [ ] **Step 1: Create diagram frame**

```tsx
import type { ReactNode } from "react";

type DiagramFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function DiagramFrame({ title, description, children }: DiagramFrameProps) {
  return (
    <figure className="rounded-lg border border-line bg-paper p-4">
      <figcaption className="mb-4">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </figcaption>
      {children}
    </figure>
  );
}
```

- [ ] **Step 2: Create the four required visuals**

Each visual should wrap an SVG or structured HTML diagram in `DiagramFrame`.

`TableScanVisual` must include visible labels:

```text
Full scan
Rows inspected
Target row
```

`BookIndexComparison` must include visible labels:

```text
Without index
Back-of-book index
Jump to page
```

`IndexTreeVisual` must include visible labels:

```text
Root
Branch
Leaf keys
Row pointers
```

`AccessPathFlow` must include visible labels:

```text
Query condition
Planner choice
Full scan
Index lookup
Fetch matching rows
```

- [ ] **Step 3: Create visual dispatcher**

Create `src/components/visual/VisualRenderer.tsx`:

```tsx
import type { VisualSpec } from "../../schemas/lesson.schema";
import { AccessPathFlow } from "./AccessPathFlow";
import { BookIndexComparison } from "./BookIndexComparison";
import { DiagramFrame } from "./DiagramFrame";
import { IndexTreeVisual } from "./IndexTreeVisual";
import { TableScanVisual } from "./TableScanVisual";

type VisualRendererProps = {
  title: string;
  visualSpec?: VisualSpec;
};

export function VisualRenderer({ title, visualSpec }: VisualRendererProps) {
  if (!visualSpec) {
    return null;
  }

  if (visualSpec.component === "table_scan") {
    return <TableScanVisual title={title} visualSpec={visualSpec} />;
  }

  if (visualSpec.component === "book_index") {
    return <BookIndexComparison title={title} visualSpec={visualSpec} />;
  }

  if (visualSpec.component === "index_tree") {
    return <IndexTreeVisual title={title} visualSpec={visualSpec} />;
  }

  if (visualSpec.component === "access_path" || visualSpec.component === "tradeoff") {
    return <AccessPathFlow title={title} visualSpec={visualSpec} />;
  }

  return (
    <DiagramFrame title={title} description={visualSpec.description}>
      <ul className="grid gap-2 text-sm text-slate-700">
        {visualSpec.keyElements.map((element) => (
          <li key={element} className="rounded-md bg-white px-3 py-2">
            {element}
          </li>
        ))}
      </ul>
    </DiagramFrame>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: visual components typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/components/visual
git commit -m "feat: add lesson visuals"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 8: Interaction Components

**Files:**
- Create: `src/components/interaction/QueryPathVisualizer.tsx`
- Create: `src/components/interaction/IndexTradeoffChecker.tsx`
- Create: `src/components/interaction/InteractionRenderer.tsx`

- [ ] **Step 1: Create query path visualizer**

Create `QueryPathVisualizer` that:

- receives `InteractionSpec`
- defaults to the first option
- renders each option as a button
- shows selected `resultTitle`
- shows selected `explanation`
- visually distinguishes lesson-specific `outcomeId` values such as `full_scan`, `index_lookup`, and `partial_index` using generic `resultTone`

Core implementation:

```tsx
import { useState } from "react";
import type { InteractionSpec } from "../../schemas/lesson.schema";
import { FeedbackPanel } from "../assessment/FeedbackPanel";

type QueryPathVisualizerProps = {
  interactionSpec: InteractionSpec;
};

export function QueryPathVisualizer({ interactionSpec }: QueryPathVisualizerProps) {
  const options = interactionSpec.options ?? [];
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "");
  const selected = options.find((option) => option.id === selectedId) ?? options[0];

  if (!selected) {
    return null;
  }

  const tone = selected.resultTone === "success" ? "correct" : selected.resultTone === "danger" ? "incorrect" : "neutral";

  return (
    <section className="grid gap-4 rounded-lg border border-line bg-white p-4">
      <div>
        <h3 className="text-base font-semibold text-ink">Query path visualizer</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{interactionSpec.learnerAction}</p>
      </div>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelectedId(option.id)}
            className={
              option.id === selected.id
                ? "rounded-md border border-accent bg-teal-50 px-3 py-2 text-left text-sm font-medium text-ink"
                : "rounded-md border border-line bg-paper px-3 py-2 text-left text-sm text-slate-700"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      <FeedbackPanel tone={tone} title={selected.resultTitle}>
        {selected.explanation}
      </FeedbackPanel>
    </section>
  );
}
```

- [ ] **Step 2: Create index tradeoff checker**

Use the same structure as `QueryPathVisualizer`, but title it `Index tradeoff checker` and set `tone` from the generic `resultTone`: `"success"` maps to `"correct"`, `"danger"` maps to `"incorrect"`, and all other tones map to `"neutral"`.

- [ ] **Step 3: Create interaction dispatcher**

```tsx
import type { InteractionSpec } from "../../schemas/lesson.schema";
import { IndexTradeoffChecker } from "./IndexTradeoffChecker";
import { QueryPathVisualizer } from "./QueryPathVisualizer";

type InteractionRendererProps = {
  interactionSpec?: InteractionSpec;
};

export function InteractionRenderer({ interactionSpec }: InteractionRendererProps) {
  if (!interactionSpec) {
    return null;
  }

  if (interactionSpec.kind === "index_tradeoff") {
    return <IndexTradeoffChecker interactionSpec={interactionSpec} />;
  }

  if (interactionSpec.kind === "query_path") {
    return <QueryPathVisualizer interactionSpec={interactionSpec} />;
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h3 className="text-base font-semibold text-ink">Learner action</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">{interactionSpec.learnerAction}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{interactionSpec.expectedObservation}</p>
    </section>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: interaction components typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/components/interaction
git commit -m "feat: add database index interactions"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 9: Renderer And Page Composition

**Files:**
- Create: `src/renderers/WebDeckRenderer.tsx`
- Create: `src/components/common/CodeBlock.tsx`
- Create: `src/components/common/ConceptCard.tsx`

- [ ] **Step 1: Create common components**

Create `src/components/common/CodeBlock.tsx`:

```tsx
type CodeBlockProps = {
  language: string;
  value: string;
};

export function CodeBlock({ language, value }: CodeBlockProps) {
  return (
    <pre className="overflow-x-auto rounded-md bg-ink p-4 text-sm leading-6 text-white">
      <code aria-label={`${language} code`}>{value}</code>
    </pre>
  );
}
```

Create `src/components/common/ConceptCard.tsx`:

```tsx
type ConceptCardProps = {
  title: string;
  items: string[];
};

export function ConceptCard({ title, items }: ConceptCardProps) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-paper px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Create WebDeckRenderer**

Create `src/renderers/WebDeckRenderer.tsx`:

```tsx
import { AssessmentRenderer } from "../components/assessment/AssessmentRenderer";
import { ConceptCard } from "../components/common/ConceptCard";
import { CodeBlock } from "../components/common/CodeBlock";
import { DeckPage } from "../components/deck/DeckPage";
import { DeckShell } from "../components/deck/DeckShell";
import { InteractionRenderer } from "../components/interaction/InteractionRenderer";
import { VisualRenderer } from "../components/visual/VisualRenderer";
import type { Lesson } from "../schemas/lesson.schema";

type WebDeckRendererProps = {
  lesson: Lesson;
};

export function WebDeckRenderer({ lesson }: WebDeckRendererProps) {
  return (
    <DeckShell
      lesson={lesson}
      renderPage={(currentIndex) => {
        const page = lesson.pages[currentIndex];
        return (
          <DeckPage page={page} pageNumber={currentIndex + 1} totalPages={lesson.pages.length}>
            <div className="grid gap-4">
              <VisualRenderer title={page.title} visualSpec={page.visualSpec} />
              <InteractionRenderer interactionSpec={page.interactionSpec} />
              {page.assessmentSpec ? (
                <AssessmentRenderer assessmentSpec={page.assessmentSpec} feedbackSpec={page.feedbackSpec} />
              ) : null}
              {page.code ? <CodeBlock language={page.code.language} value={page.code.value} /> : null}
              {page.type === "summary_card" ? <ConceptCard title="Remember" items={lesson.summary} /> : null}
            </div>
          </DeckPage>
        );
      }}
    />
  );
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: app now typechecks once lesson data includes all required pages and child components exist.

- [ ] **Step 4: Commit**

```bash
git add src/renderers/WebDeckRenderer.tsx src/components/common
git commit -m "feat: render lesson deck"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 10: Complete Lesson Content And SQL Walkthrough

**Files:**
- Modify: `src/lessons/database-index/lesson.ts`

- [ ] **Step 1: Verify the lesson has exactly 10 sample pages**

Run:

```bash
node -e "const fs=require('fs'); const text=fs.readFileSync('src/lessons/database-index/lesson.ts','utf8'); console.log((text.match(/id: \"p[0-9][0-9]-/g)||[]).length)"
```

Expected output:

```text
10
```

- [ ] **Step 2: Add SQL code to page 8**

Page `p08-sql-walkthrough` must include:

```ts
code: {
  language: "sql",
  value: [
    "CREATE INDEX users_email_idx ON users(email);",
    "",
    "SELECT *",
    "FROM users",
    "WHERE email = 'sam@example.com';",
    "",
    "CREATE INDEX orders_user_status_idx ON orders(user_id, status);",
    "",
    "SELECT *",
    "FROM orders",
    "WHERE user_id = 42 AND status = 'paid';"
  ].join("\n")
}
```

- [ ] **Step 3: Confirm variable page-count metadata**

Verify `databaseIndexLesson.config` contains:

```ts
config: {
  targetPageCount: 10,
  minPageCount: 6,
  maxPageCount: 14
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lessons/database-index/lesson.ts
git commit -m "feat: complete database index lesson"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 11: Tests For Page Count, Rendering, And Interactions

**Files:**
- Create: `src/components/deck/DeckShell.test.tsx`
- Create: `src/components/interaction/QueryPathVisualizer.test.tsx`
- Create: `src/components/interaction/IndexTradeoffChecker.test.tsx`
- Create: `src/renderers/WebDeckRenderer.test.tsx`

- [ ] **Step 1: Add deck navigation test**

Create `src/components/deck/DeckShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Lesson } from "../../schemas/lesson.schema";
import { DeckShell } from "./DeckShell";

const lesson = {
  id: "test",
  title: "Variable page lesson",
  audience: "Test learners",
  config: { targetPageCount: 2, minPageCount: 1, maxPageCount: 3 },
  prerequisites: [],
  learningObjectives: [],
  misconceptions: [],
  transferTasks: [],
  summary: [],
  pages: [
    { id: "one", type: "problem_scene", title: "One", learningGoal: "First", narrative: "First page" },
    { id: "two", type: "summary_card", title: "Two", learningGoal: "Second", narrative: "Second page" }
  ]
} satisfies Lesson;

describe("DeckShell", () => {
  it("uses the actual lesson page count for navigation", async () => {
    const user = userEvent.setup();
    render(<DeckShell lesson={lesson} renderPage={(index) => <div>Rendered page {index + 1}</div>} />);

    expect(screen.getByText("Rendered page 1")).toBeInTheDocument();
    expect(screen.getByText("2 pages, target 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Rendered page 2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add query path visualizer test**

Create `src/components/interaction/QueryPathVisualizer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { InteractionSpec } from "../../schemas/lesson.schema";
import { QueryPathVisualizer } from "./QueryPathVisualizer";

const spec = {
  kind: "query_path",
  learnerAction: "Choose a query condition.",
  expectedObservation: "The access path changes.",
  cognitivePurpose: "Predict planner behavior.",
  options: [
    {
      id: "email",
      label: "WHERE email = 'sam@example.com'",
      resultTitle: "Index lookup",
      outcomeId: "index_lookup",
      resultTone: "success",
      explanation: "The predicate matches the email index."
    },
    {
      id: "created",
      label: "WHERE created_at > '2026-01-01'",
      resultTitle: "Full table scan",
      outcomeId: "full_scan",
      resultTone: "neutral",
      explanation: "The available index is on email, not created_at."
    }
  ]
} satisfies InteractionSpec;

describe("QueryPathVisualizer", () => {
  it("shows explanatory feedback for the selected query", async () => {
    const user = userEvent.setup();
    render(<QueryPathVisualizer interactionSpec={spec} />);

    await user.click(screen.getByRole("button", { name: /created_at/i }));

    expect(screen.getByText("Full table scan")).toBeInTheDocument();
    expect(screen.getByText(/not created_at/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Add tradeoff checker test**

Create `src/components/interaction/IndexTradeoffChecker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { InteractionSpec } from "../../schemas/lesson.schema";
import { IndexTradeoffChecker } from "./IndexTradeoffChecker";

const spec = {
  kind: "index_tradeoff",
  learnerAction: "Choose whether to add an index.",
  expectedObservation: "The read/write tradeoff changes.",
  cognitivePurpose: "Reason about workload.",
  options: [
    {
      id: "unique-email",
      label: "Add index for frequent unique email lookup",
      resultTitle: "Good tradeoff",
      outcomeId: "good_tradeoff",
      resultTone: "success",
      explanation: "Frequent selective reads usually justify the extra index maintenance and storage."
    },
    {
      id: "tiny-report",
      label: "Add index for a rare report on a tiny table",
      resultTitle: "Weak tradeoff",
      outcomeId: "bad_tradeoff",
      resultTone: "warning",
      explanation: "The read savings are small."
    }
  ]
} satisfies InteractionSpec;

describe("IndexTradeoffChecker", () => {
  it("explains why a weak index tradeoff is weak", async () => {
    const user = userEvent.setup();
    render(<IndexTradeoffChecker interactionSpec={spec} />);

    await user.click(screen.getByRole("button", { name: /rare report/i }));

    expect(screen.getByText("Weak tradeoff")).toBeInTheDocument();
    expect(screen.getByText(/read savings are small/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Add renderer tests**

Create `src/renderers/WebDeckRenderer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { databaseIndexLesson } from "../lessons/database-index/lesson";
import { WebDeckRenderer } from "./WebDeckRenderer";

describe("WebDeckRenderer", () => {
  it("renders the database index lesson from structured data", () => {
    render(<WebDeckRenderer lesson={databaseIndexLesson} />);

    expect(databaseIndexLesson.pages).toHaveLength(10);
    expect(screen.getByText("The 10 million row question")).toBeInTheDocument();
    expect(screen.getByText("10 pages, target 10")).toBeInTheDocument();
  });

  it("renders a shorter lesson without assuming ten pages", () => {
    const shortLesson = {
      ...databaseIndexLesson,
      config: { targetPageCount: 6, minPageCount: 6, maxPageCount: 14 },
      pages: databaseIndexLesson.pages.slice(0, 6)
    };

    render(<WebDeckRenderer lesson={shortLesson} />);

    expect(screen.getByText("6 pages, target 6")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/**/*.test.tsx
git commit -m "test: cover deck rendering and interactions"
```

Expected: commit succeeds only when the directory is a git repository.

---

### Task 12: README, Quality Check, And Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with real run instructions**

Add this section:

```md
## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL printed in the terminal.

## Verify

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Current Lesson

The first sample lesson is `Why database indexes make queries faster`.

It is implemented as a 10-page default lesson, but the renderer and schema support variable page counts through `lesson.config.targetPageCount` and `lesson.pages.length`.

## Extend With A New Lesson

1. Create a structured lesson object under `src/lessons/<lesson-id>/lesson.ts`.
2. Set `config.targetPageCount`, `config.minPageCount`, and `config.maxPageCount`.
3. Add pages using the schema in `src/schemas/lesson.schema.ts`.
4. Reuse deck, visual, interaction, and assessment components.
5. Run the quality rubric in `docs/quality-rubric.md` before publishing.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected:

```text
typecheck: pass
lint: pass
test: pass
build: pass
```

- [ ] **Step 3: Start dev server for preview**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL, usually `http://localhost:5173/`. Open it and verify:

- Page 1 renders.
- Navigation moves through all 10 pages.
- Progress changes as pages change.
- Query path visualizer changes feedback.
- Index tradeoff checker changes feedback.
- Quiz and prediction feedback explain why.
- The layout remains readable at tablet width.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document MVP lesson workflow"
```

Expected: commit succeeds only when the directory is a git repository.

---

## Plan Self-Review

- Spec coverage: The plan covers React/Vite/Tailwind setup, schema, page-count metadata, typed lesson data, deck renderer, visual components, two required interactions, assessments, README, and verification.
- Page-count requirement: `LessonConfig`, `pages.length`, `DeckShell`, and renderer tests explicitly prevent hard-coding 10 pages.
- Scope control: The plan excludes LLM generation, real database integration, canvas mode, AI tutor mode, teacher mode, and authoring UI.
- Test coverage: The plan includes tests for variable page count, default 10-page sample, query path feedback, and tradeoff feedback.
- Known execution constraint: This folder currently is not a git repository, so commit steps require `git init` or a repo context before execution.
