# Full Product Delivery Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move AI Interactive Learning Agent from the current Web Deck MVP plus file-backed agent runtime into a complete source-grounded, natural-language-operated learning experience product.

**Architecture:** Preserve the existing separation between source artifacts, agent runtime, structured learning objects, and renderers. Build outward in thin vertical slices: natural-language operation first, source grounding second, course-pack UX third, runtime/MCP automation fourth, and additional product forms after the Web Deck path is dependable.

**Tech Stack:** TypeScript, Node.js ESM, React, Vite, Vitest, local file-backed runtime under `tools/agent-runtime`, JSON artifacts under `runs/<run-id>/`, renderer components under `src/`, and project skills under `skills/`.

---

## Product Target

The complete product should let a user say, in Codex or another compatible agent environment:

```text
用这本书生成一套中文课程：先做总览课，再按核心 topic 拆课。
每个单元 10 页，面向有基础编程经验但缺少系统心智模型的学习者。
保留章节映射，生成 Web Deck，并给我可审查的中间产物。
```

The system should then:

1. Normalize the source material, whether it is a topic, book, paper, patent, blog, notes folder, URL, or mixed corpus.
2. Build a source map with anchors and coverage metadata.
3. Build a concept map with dependencies, examples, misconceptions, and inferred concepts.
4. Create a curriculum plan that defaults to overview plus core topic units while preserving source/chapter mapping.
5. Generate one or more learning units with objectives, pages, visuals, interactions, assessments, feedback, transfer tasks, and summary cards.
6. Run review gates before publishing.
7. Promote approved learning units into a browsable course pack.
8. Render the result as a Web Deck first, then support knowledge maps, playgrounds, tutor mode, teacher mode, and assessment mode.

The product is complete only when natural-language operation, source grounding, course-pack browsing, quality gates, and at least one additional product form beyond Web Deck are usable end to end.

## Current Baseline

Already implemented:

- React/Vite Web Deck renderer.
- Structured lesson schema and sample lessons.
- Reusable deck, visual, interaction, and assessment components.
- File-backed runtime with `init`, `run`, `submit`, `approve`, `revise`, `promote`, and course-unit commands.
- Source-backed course-pack concepts: `source-map`, `concept-map`, `curriculum-plan`, `selectedUnit`, and child unit runs.
- Operator skill for Codex-style manual generation.
- Frontend lesson discovery and course-pack registry discovery.
- Local test coverage for runtime, promotion, registries, and core UI components.

Current limitations:

- Natural-language operation still depends on an operator translating intent into CLI commands.
- Codex, Claude, and OpenClaw are not true runtime adapters yet; current behavior is manual/operator-driven.
- There is no MCP server exposing runtime commands as agent tools.
- Source parsing and grounding are skeletal and need real PDF/text/URL/folder normalization.
- Course-pack UI exists only as a basic selector, not as a full learning product surface.
- Canvas map, playground, AI tutor, teacher mode, and assessment mode are not productized.
- Quality gates exist as artifacts, but automatic validation is still shallow.
- Packaging, sharing, export, and run management are not product-grade.

## Acceptance Strategy

Every phase must ship a runnable vertical slice. A phase is not accepted because documents exist; it is accepted when a user can exercise the behavior locally and inspect durable artifacts.

Global verification for every implementation slice:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

When a slice touches the runtime, it must also include at least one CLI smoke path under a disposable run id. Example:

```bash
npm run agent:init -- --topic "哈希表" --unit-pages 8 --language zh-CN --adapter mock --run smoke-topic-run
npm run agent:run -- --run smoke-topic-run
```

When a slice touches generated lessons or course packs, it must include browser verification against the Vite app.

## Phase Acceptance Goals

### Phase 1: Natural-Language Codex Operation

**User outcome:** A user can describe a source-backed course request in Chinese, and Codex can deterministically translate it into runtime actions without the user manually assembling CLI flags.

Acceptance criteria:

- A Chinese natural-language request can be mapped into a run plan containing source type, source path or URL, audience, page count per unit, planning strategy, output language, adapter, and run id.
- The run plan is written to disk before execution for review.
- The operator can approve, edit, or reject the plan.
- Approved plans can initialize a runtime run.
- The behavior is documented in the operator skill and README.

Concrete validation:

```bash
npm run agent:init -- \
  --source-file "/absolute/path/to/source.pdf" \
  --source-kind book \
  --source-title "Sample Book" \
  --unit-pages 10 \
  --strategy overview_plus_topic \
  --language zh-CN \
  --adapter codex \
  --run nl-operation-smoke
```

The same fields must be producible from a Chinese natural-language request through the Codex operator workflow.

### Phase 2: Source Ingestion And Grounding

**User outcome:** A book, paper, patent, blog, notes folder, or URL can become a source map with inspectable anchors and coverage metadata.

Acceptance criteria:

- `source-map` supports source kinds: `book`, `paper`, `patent`, `blog`, `documentation`, `notes`, `course`, `mixed`, and `unknown`.
- PDF and plain text sources produce stable anchors with page, heading, section, or paragraph locators where available.
- Patents preserve claim, figure, embodiment, and prior-art anchors when present in text.
- Papers preserve abstract, method, experiment, result, limitation, and citation-related anchors when present in text.
- Blogs and docs preserve heading hierarchy and URL anchors.
- The runtime records extraction warnings instead of silently dropping unsupported sections.
- Generated source facts in downstream artifacts reference anchors.

Concrete validation:

```bash
npm run agent:init -- \
  --source-file "/absolute/path/to/source.pdf" \
  --source-kind book \
  --source-title "Sample Book" \
  --unit-pages 10 \
  --adapter mock \
  --run source-grounding-smoke
npm run agent:run -- --run source-grounding-smoke
```

Expected artifact:

```text
runs/source-grounding-smoke/artifacts/source-map.v1.json
```

The artifact must contain non-empty `sources`, source nodes, anchors, extraction notes, and coverage warnings when applicable.

### Phase 3: Curriculum And Course-Pack Product UX

**User outcome:** A source-backed run produces an overview unit plus topic units, and the frontend exposes a coherent course surface rather than a single lesson dropdown.

Acceptance criteria:

- `curriculum-plan` always marks strategy, overview unit, unit list, chapter mapping, concept coverage, and source coverage.
- Course units support `overview`, `topic`, `chapter`, `practice`, `assessment`, and `teacher` kinds.
- The frontend shows course title, source type, overview unit, topic units, source/chapter mapping, learning objectives, and status for generated units.
- A user can open any promoted unit from the course surface.
- A course can contain generated and not-yet-generated units without breaking the UI.
- The UI remains Chinese-first by default.

Concrete validation:

```bash
npm run agent:units -- --run <source-backed-run-id>
npm run agent:course -- --run <source-backed-run-id> --all true
npm run agent:promote-units -- --run <source-backed-run-id> --all true
npm run dev
```

The Vite app must show the promoted course pack and allow unit navigation.

### Phase 4: MCP Server And Runtime Adapters

**User outcome:** Codex or another compatible agent can drive the runtime through tools instead of relying on hand-written shell commands.

Acceptance criteria:

- A local MCP server exposes tool contracts for initializing runs, checking status, submitting artifacts, approving gates, listing units, running units, and promoting lessons.
- Tool inputs and outputs are typed and documented.
- MCP tools call the existing runtime services instead of duplicating orchestration logic.
- Runtime adapter identity remains separate from model selection.
- Unsupported model or runtime capabilities produce explicit errors and never silently substitute providers.
- Codex can use the MCP tools for at least one source-backed run.

Tool surface:

```text
learning_agent.init_run
learning_agent.status
learning_agent.submit_artifact
learning_agent.approve_gate
learning_agent.revise_gate
learning_agent.list_units
learning_agent.run_course
learning_agent.promote_units
learning_agent.promote_lesson
```

Concrete validation:

```bash
npm run typecheck
npm run test
```

And one interactive Codex-driven MCP smoke run must create a run directory under:

```text
runs/<mcp-smoke-run-id>/
```

### Phase 5: Quality Gates And Automated Lesson Critic

**User outcome:** Generated lessons are rejected or revised when they fail learning quality, Chinese-first output, grounding, interaction, assessment, or product requirements.

Acceptance criteria:

- Lesson validation checks page count, required page types, objective coverage, visual count, interaction count, assessment count, misconception check, transfer task, and summary card.
- Interaction validation checks learner action, expected observation, cognitive purpose, and explanatory feedback.
- Source-backed lessons validate that source claims carry anchors or are marked as inferred or analogy.
- Chinese-first validation checks page titles, learning goals, learner actions, feedback, quiz prompts, and summary text.
- Critic reports distinguish blocking fixes from optional improvements.
- Promotion refuses unapproved or critically failing lessons.

Concrete validation:

```bash
npm run test -- tools/agent-runtime
npm run agent:promote -- --run <run-id>
```

Promotion must fail with an actionable message when the approved lesson lacks required product quality.

### Phase 6: Web Deck Hardening

**User outcome:** The Web Deck is a polished, reusable, responsive lesson player suitable for real learners and demos.

Acceptance criteria:

- Course and lesson selection are clear for books with many units.
- Page navigation supports keyboard, clickable controls, progress, and direct unit switching.
- Visual, interaction, quiz, misconception, transfer, and summary pages render consistently.
- Empty, partial, and failed generated units have explicit states.
- The UI follows the Chinese-first requirement.
- The UI is responsive on laptop and tablet-sized viewports.
- Browser verification covers at least one generated source-backed course pack.

Concrete validation:

```bash
npm run dev
```

Open the Vite URL and verify:

- course pack selection works
- unit selection works
- navigation works
- at least two interactions provide explanatory feedback
- quiz feedback renders
- transfer challenge renders

### Phase 7: Canvas Knowledge Map

**User outcome:** A learner can zoom out from a course and see concepts, dependencies, chapters, and learning units as a navigable map.

Acceptance criteria:

- A `CanvasMapRenderer` renders concept nodes, dependency edges, source/chapter anchors, and linked lesson units.
- Clicking a node opens the related lesson page or unit.
- Map layout remains readable for small, medium, and large course packs.
- Source-backed nodes distinguish explicit source concepts from inferred teaching concepts.
- The map can be generated from `concept-map` and `curriculum-plan` artifacts.

Concrete validation:

```bash
npm run test -- src
npm run build
```

At least one generated course pack must render both Web Deck and Canvas Map views.

### Phase 8: Interactive Playground

**User outcome:** Lessons can include sandbox-style experiments where learners manipulate parameters and observe causal effects.

Acceptance criteria:

- Playground specs are represented in the learning object layer.
- At least three reusable playground families exist: algorithm execution, systems pipeline, and parameter experiment.
- Playground interactions produce explanatory feedback, not only visual state changes.
- Lessons can link from Web Deck pages into playground states.
- Playground state is serializable enough for generated lessons to configure it.

Concrete validation:

```bash
npm run test -- src/components src/renderers
npm run build
```

At least one source-backed course unit must include a working playground page.

### Phase 9: AI Tutor Mode

**User outcome:** A tutor can guide a learner through visual and interactive objects without replacing the lesson with plain chat.

Acceptance criteria:

- Tutor messages are grounded in the active lesson page, source anchors, learner response, and current interaction state.
- Tutor can ask diagnostic questions, explain feedback, and suggest next actions.
- Tutor mode records misconception signals.
- Tutor cannot introduce unsupported source claims without anchor or inference marking.
- Tutor can be disabled without breaking the lesson.

Concrete validation:

```bash
npm run test
npm run build
```

Manual browser validation must show tutor guidance on at least one quiz or interaction page.

### Phase 10: Teacher And Assessment Modes

**User outcome:** A generated course can produce instructor-facing and assessment-facing materials, not only learner-facing lessons.

Acceptance criteria:

- Teacher mode includes instructor notes, pacing, live questions, common misconceptions, demo instructions, and post-class review tasks.
- Assessment mode includes recall, prediction, misconception, transfer, and applied debugging tasks.
- Assessment items link back to learning objectives and source concepts.
- Teacher and assessment outputs can be exported as files under `runs/<run-id>/exports/`.
- The frontend can preview teacher and assessment materials.

Concrete validation:

```bash
npm run agent:run -- --run <run-id>
npm run build
```

Expected outputs:

```text
runs/<run-id>/exports/teacher/
runs/<run-id>/exports/assessment/
```

### Phase 11: Packaging, Sharing, And Operations

**User outcome:** Approved lessons and course packs can be exported, shared, reopened, and audited.

Acceptance criteria:

- Exports include static Web Deck assets, course metadata, source mapping, and artifact manifest.
- Run status is easy to inspect across all runs.
- Failed runs show clear recovery actions.
- Published course packs record the exact approved artifact versions used.
- README documents run, review, promote, export, and preview flows.
- A release checklist exists for local product demos.

Concrete validation:

```bash
npm run build
npm run preview
npm run agent:status -- --run <run-id>
```

The preview build must show the same promoted course pack as the dev build.

## Recommended Work Path

The next execution sequence should be:

1. Implement Phase 1 natural-language run planning inside Codex operator workflow.
2. Implement Phase 2 source ingestion and grounding for PDF and plain text first.
3. Upgrade Phase 3 course-pack frontend so books and long sources no longer feel like single lessons.
4. Add Phase 5 automated quality gates before scaling generation volume.
5. Add Phase 4 MCP server once the CLI/service boundary is stable enough to expose as tools.
6. Harden Web Deck in Phase 6.
7. Start Canvas Map in Phase 7 as the first non-Web-Deck product form.
8. Add Playground in Phase 8 for topics where manipulation is central.
9. Add Tutor, Teacher, and Assessment modes after the learning object layer can support them without special cases.
10. Add packaging and sharing once generated artifacts are reliable.

This order keeps the project moving toward the full product while avoiding a trap where many renderers exist but source-backed generation remains weak.

## Implementation Slices

### Slice 1: Natural-Language Run Planner

**Files:**

- Create: `tools/agent-runtime/natural-language/run-intent.ts`
- Create: `tools/agent-runtime/natural-language/run-intent.test.ts`
- Create: `tools/agent-runtime/natural-language/run-plan-service.ts`
- Create: `tools/agent-runtime/natural-language/run-plan-service.test.ts`
- Modify: `tools/agent-runtime/cli.ts`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `README.md`

- [ ] Add a typed `RunIntent` object that captures source, learner profile, planning strategy, unit page count, language, runtime adapter, and model preferences.
- [ ] Add deterministic parsing helpers for the common Chinese phrases already used by this project, including `总览课`, `按核心 topic`, `按章节`, `每个单元 N 页`, `中文学习者`, `论文`, `专利`, `博客`, `书`, and local file paths.
- [ ] Add a run-plan writer that stores reviewable plans under `runs/<run-id>/run.plan.json`.
- [ ] Add a CLI command that can create a run from a reviewed plan.
- [ ] Update the operator skill so Codex uses plan review before initializing source-backed runs.
- [ ] Add tests for Chinese request mapping and plan-to-run-config conversion.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.

### Slice 2: Source Normalization And Anchors

**Files:**

- Create: `tools/agent-runtime/source/source-normalizer.ts`
- Create: `tools/agent-runtime/source/source-normalizer.test.ts`
- Create: `tools/agent-runtime/source/source-anchor.ts`
- Create: `tools/agent-runtime/source/source-anchor.test.ts`
- Modify: `tools/agent-runtime/corpus-types.ts`
- Modify: `tools/agent-runtime/adapters/mock-adapter.ts`
- Modify: `tools/agent-runtime/adapters/codex-manual-adapter.ts`
- Modify: `docs/runtime/artifact-contracts.md`

- [ ] Add normalized source document types for file, folder, URL, text, and topic inputs.
- [ ] Add anchor locators for page, heading, paragraph, claim, figure, table, and URL fragment.
- [ ] Add source-kind-specific extraction expectations for books, papers, patents, blogs, documentation, and notes.
- [ ] Add runtime warnings for unsupported file formats or missing anchor fidelity.
- [ ] Update manual prompts so source-ingest requests demand anchors and warning records.
- [ ] Add tests for source records, anchor ids, and extraction warnings.
- [ ] Run the full verification command set.

### Slice 3: Course-Pack Frontend

**Files:**

- Create: `src/components/course/CourseShell.tsx`
- Create: `src/components/course/CourseUnitList.tsx`
- Create: `src/components/course/SourceMappingPanel.tsx`
- Create: `src/components/course/CourseStatusBadge.tsx`
- Create: `src/components/course/CourseShell.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/course-packs/registry.ts`
- Modify: `src/schemas/course-pack.schema.ts`
- Modify: `src/styles/index.css`

- [ ] Render course-pack title, source kind, strategy, overview unit, topic units, and generation status.
- [ ] Show source/chapter mapping for each unit when available.
- [ ] Allow switching between units without losing the selected course.
- [ ] Show stable empty states for units that are planned but not promoted.
- [ ] Keep lesson-only mode working when no course packs exist.
- [ ] Add tests for course selection, unit selection, and planned-but-missing units.
- [ ] Verify the app with `npm run dev` after tests pass.

### Slice 4: Automated Quality Gates

**Files:**

- Create: `tools/agent-runtime/quality/lesson-quality-validator.ts`
- Create: `tools/agent-runtime/quality/lesson-quality-validator.test.ts`
- Create: `tools/agent-runtime/quality/source-grounding-validator.ts`
- Create: `tools/agent-runtime/quality/source-grounding-validator.test.ts`
- Create: `tools/agent-runtime/quality/chinese-first-validator.ts`
- Create: `tools/agent-runtime/quality/chinese-first-validator.test.ts`
- Modify: `tools/agent-runtime/promotion/lesson-promotion-service.ts`
- Modify: `tools/agent-runtime/course-pack-service.ts`
- Modify: `docs/quality-rubric.md`

- [ ] Validate minimum lesson completeness before promotion.
- [ ] Validate interaction feedback completeness before promotion.
- [ ] Validate source-backed claims against source anchors or inference markings.
- [ ] Validate Chinese-first learner-facing fields by default.
- [ ] Return actionable error messages that name the failing page, field, and rule.
- [ ] Add tests for accepted lessons and rejected lessons.
- [ ] Run the full verification command set.

### Slice 5: MCP Server

**Files:**

- Create: `tools/mcp-server/index.ts`
- Create: `tools/mcp-server/tool-contracts.ts`
- Create: `tools/mcp-server/runtime-tools.ts`
- Create: `tools/mcp-server/runtime-tools.test.ts`
- Modify: `package.json`
- Modify: `docs/runtime/runtime-adapters.md`
- Modify: `README.md`

- [ ] Expose runtime services as MCP tools without copying orchestration logic.
- [ ] Add typed tool inputs and outputs for run init, status, submit, approve, revise, unit listing, course run, and promotion.
- [ ] Add clear errors for unsupported adapters, missing run ids, missing files, and unapproved gates.
- [ ] Add an npm script for starting the local MCP server.
- [ ] Document Codex usage with MCP tools.
- [ ] Add tests that call tool handlers directly.
- [ ] Run the full verification command set.

### Slice 6: Web Deck Product Hardening

**Files:**

- Modify: `src/renderers/WebDeckRenderer.tsx`
- Modify: `src/components/deck/DeckShell.tsx`
- Modify: `src/components/deck/PageNavigation.tsx`
- Modify: `src/components/visual/VisualRenderer.tsx`
- Modify: `src/components/interaction/InteractionRenderer.tsx`
- Modify: `src/components/assessment/AssessmentRenderer.tsx`
- Modify: `src/styles/index.css`
- Add or update tests under `src/`

- [ ] Add stronger responsive layout behavior for laptop and tablet viewports.
- [ ] Add keyboard navigation and direct page navigation states.
- [ ] Add consistent empty states for incomplete visual, interaction, and assessment specs.
- [ ] Add course-aware navigation labels where a lesson belongs to a course pack.
- [ ] Add tests for navigation and renderer fallback states.
- [ ] Verify in the browser with at least one promoted course pack.

### Slice 7: First Additional Product Form

**Files:**

- Create: `src/renderers/CanvasMapRenderer.tsx`
- Create: `src/renderers/CanvasMapRenderer.test.tsx`
- Create: `src/components/canvas/ConceptNode.tsx`
- Create: `src/components/canvas/ConceptEdge.tsx`
- Create: `src/components/canvas/MapViewport.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/schemas/course-pack.schema.ts`

- [ ] Add a Canvas Map view generated from concept-map and curriculum-plan structures.
- [ ] Support concept nodes, dependency edges, source anchors, and linked unit ids.
- [ ] Add a Web Deck to Canvas Map switch for course packs.
- [ ] Add tests for map rendering and unit navigation.
- [ ] Verify one source-backed course pack in both views.

## Release Gates

A product increment can be considered release-quality only when:

- All global verification commands pass.
- The related CLI or MCP smoke path passes.
- A human can inspect the generated artifacts under `runs/<run-id>/artifacts/`.
- Approval gates are respected.
- Generated learner-facing output is Chinese-first by default.
- The frontend can open the promoted output without manual code registration.
- The README or relevant skill explains how to operate the new behavior.

## Risk Register

| Risk | Product Impact | Mitigation |
| --- | --- | --- |
| Source parsing becomes broad but shallow | Lessons may lose grounding and trust | Start with PDF/text/URL normalization and explicit extraction warnings |
| Renderer work outruns generation quality | Product looks usable but produces weak lessons | Prioritize quality gates before adding many visual modes |
| MCP duplicates CLI logic | Runtime behavior diverges across entrypoints | MCP tools must wrap existing services |
| Natural language remains informal | Codex usage stays dependent on the operator's memory | Write run plans to disk and require review before initialization |
| Course packs become too large for the current UI | Books feel unusable in the frontend | Build course shell, unit status, and source mapping before more renderers |
| Multi-provider naming hides missing capability | Users think a model was used when it was not | Adapter logs must record model mismatch and fallback decisions |

## Near-Term Definition Of Done

The next major milestone is accepted when a user can complete this flow:

1. Give Codex a Chinese natural-language request and a local source file.
2. Codex creates a reviewable run plan.
3. The user approves the plan.
4. The runtime initializes a source-backed run.
5. The runtime generates or requests `source-map`, `concept-map`, and `curriculum-plan`.
6. The course plan includes one overview unit plus core topic units with source/chapter mapping.
7. At least one unit is generated, approved, promoted, and visible in the Web Deck.
8. The frontend shows the course surface rather than only a single lesson dropdown.
9. `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass.

That milestone is the bridge from "runnable MVP" to "real product foundation."
