# Public Beta Quality Execution Spec

Date: 2026-05-06

## Purpose

This spec is the execution reference for moving AI Interactive Learning Agent from an open-source runnable checkpoint to a public beta product that seed users can try through Codex/MCP with less operator friction and more reliable learning output.

The product should remain an AI-native learning system, not a generic slideshow generator. The near-term quality target is:

```text
public repo
  -> clear local setup
  -> Codex/MCP learner request
  -> source-grounded Chinese course preview
  -> usable learning interface
  -> actionable feedback/revision loop
  -> reproducible quality gates
```

## Current Baseline

The baseline is commit `6b4a1e4 Prepare open source beta checkpoint` on `main`.

Verified baseline capabilities:

- Public GitHub repository with `main` as default branch.
- README quickstart, license, contributing guide, security policy, and GitHub Actions CI.
- React/Vite learner workspace with course pack registry, web deck, knowledge map, source panel, project library, and fixed viewport learning pages.
- Local MCP server with learner-facing project creation, authoring context, deterministic grounded generation, publish, preview, revision, export, and advanced operator tools.
- Codex MCP and skills bundle check.
- Public mock source fixtures under `examples/sources/`.
- Stable verification commands:
  - `npm run test:ci`
  - `npm run test:regression`
  - `npm run seed:check`
  - `npm run codex:mcp:check`

Known baseline limitations:

- README smoke generation writes ignored preview files under `src/course-packs/*-smoke/` and `src/lessons/*-smoke-*/`, which is acceptable for local development but not clean enough for a polished public beta workflow.
- Deterministic generation is useful for smoke previews but not sufficient for high-quality source-backed lessons.
- Critic reports exist, but the learner-facing quality story is still too shallow.
- Codex/Claude operation still requires too much implicit context from the operator.
- The learning interface is usable but does not yet store learner progress or make feedback loops feel product-grade.

## Non-Negotiable Product Principles

- Default output is Chinese-first unless the user explicitly asks for another language.
- Learner mode must not require approval of internal artifacts such as `source-map`, `concept-map`, or `curriculum-plan`.
- Long sources are course packs, not single lessons.
- A course must be source-grounded when a source is provided.
- A learning page should fit the viewport and must not require vertical scrolling for the primary study experience.
- Interactions must teach cause, structure, prediction, misconception, or transfer; decorative interaction does not count.
- Every public default path must be safe for open source and must not depend on private local paths or copyrighted fixture content.

## Public Beta Definition Of Done

The project reaches public beta when all of the following are true:

1. A new external developer can clone the repository, run `npm ci`, run `npm run dev`, and see the default public sample course.
2. A Codex user can install the MCP/skills bundle and complete a public mock source course generation flow from README without editing code.
3. The default smoke path does not leave generated files under tracked source directories unless the user explicitly chooses publish-to-source.
4. Every generated source-backed course returns a compact quality report with source evidence, lesson quality score, and revision recommendations.
5. The learner-facing preview page opens directly into a course and exposes source evidence, structure, practice, tutor, and feedback surfaces without looking like a developer console.
6. CI passes on GitHub for `main`.
7. Local release verification passes:

```bash
npm run test:ci
npm run test:regression
npm run seed:check
npm run codex:mcp:check
```

## Execution Slices

### Slice 1: Public Repository Readiness

Goal: make the GitHub repository itself credible and easy to try.

Work:

- Add GitHub Actions status badge to README.
- Add issue templates for bug reports, feature requests, and source-generation quality reports.
- Add pull request template with verification checklist.
- Add repository topics through GitHub metadata when possible:
  - `mcp`
  - `codex`
  - `ai-learning`
  - `interactive-learning`
  - `typescript`
  - `vite`
- Add a short README section named `Try With Codex` that separates Codex/MCP users from ordinary local developers.
- Add a short screenshot or demo artifact only if it can be generated from public sample content.

Acceptance:

- GitHub repo opens on `main` with clear project purpose, green CI badge, and visible quickstart.
- `README.md` has two distinct paths:
  - local developer path
  - Codex/MCP learner path
- No private paths are introduced.
- `npm run test:ci` passes.

Stop conditions:

- Do not add hosted deployment promises.
- Do not add private screenshots or generated private courses.

### Slice 2: Clean Preview Runtime

Goal: make the learner smoke and generated previews clean enough for open-source users.

Problem:

The current deterministic smoke flow can write generated course files into ignored source-like paths:

```text
src/course-packs/<run-id>/
src/lessons/<run-id>-*/
```

This is confusing for users because generated runtime output appears under `src/`.

Target behavior:

- `learning_agent.generate_grounded_course` should default to a preview runtime output outside tracked source directories.
- Suggested default output:

```text
runs/<run-id>/preview/course-pack.json
runs/<run-id>/preview/lessons/*.json
runs/<run-id>/preview/manifest.json
```

- The frontend should be able to load the generated preview without committing or writing TypeScript source files.
- A separate explicit tool or flag may still support writing source fixtures for maintainers.

Work:

- Introduce a preview manifest format under `runs/<run-id>/preview/`.
- Add runtime service for writing preview JSON instead of TypeScript modules.
- Add frontend preview loader that can read a generated preview through a local manifest path or dev-only generated index.
- Change README smoke to use the clean preview path.
- Keep current source-publish path available behind an explicit maintainer operation.

Acceptance:

- Running README MCP smoke does not create ignored files under `src/course-packs/` or `src/lessons/`.
- `git status --short --ignored=matching` after smoke may show `runs/`, but not generated `src/` course or lesson directories.
- Preview URL still opens in the learner interface.
- `npm run test:ci` and `npm run seed:check` pass.

Stop conditions:

- Do not introduce a database or server-side persistence layer in this slice.
- Do not remove existing registered public sample lessons.

### Slice 3: Quality Report Contract

Goal: make content quality visible, enforceable, and actionable.

Target behavior:

Every generated source-backed course should return a compact quality report containing:

- course-level score
- lesson-level scores
- page-level issue counts
- source evidence status
- Chinese-first status
- interaction quality status
- misconception and transfer coverage
- required fixes
- optional improvements

Quality report shape:

```ts
type CourseQualityReport = {
  status: "passed" | "warning" | "failed";
  score: number;
  runId: string;
  coursePackId: string;
  summary: string;
  lessonScores: Array<{
    lessonId: string;
    score: number;
    status: "passed" | "warning" | "failed";
    requiredFixes: string[];
    optionalImprovements: string[];
  }>;
  checks: {
    sourceEvidence: "passed" | "warning" | "failed";
    chineseFirst: "passed" | "warning" | "failed";
    pageStructure: "passed" | "warning" | "failed";
    interactionQuality: "passed" | "warning" | "failed";
    assessmentCoverage: "passed" | "warning" | "failed";
    transferCoverage: "passed" | "warning" | "failed";
  };
};
```

Work:

- Promote existing critic and source evidence outputs into a course-level quality report.
- Add interaction quality checks:
  - at least one learner action per unit unless the unit is explicitly summary-only
  - feedback must explain mechanism, not just correctness
  - interaction purpose must be cognitive, not decorative
- Add assessment coverage checks:
  - recall or comprehension check
  - prediction or debugging check
  - misconception check
  - transfer challenge
- Add compact report into MCP responses for:
  - `generate_grounded_course`
  - `publish_learning_course`
  - `apply_learning_revision`
  - `export_learning_course`
- Keep large detailed reports available as artifacts or files, not inline in normal learner responses.

Acceptance:

- MCP learner responses include a compact quality summary.
- Detailed quality report is written under `runs/<run-id>/quality/`.
- A course with unsupported source claims fails or warns according to configured thresholds.
- `npm run test:regression` covers at least book, paper, patent, and blog fixtures.
- `npm run seed:check` fails when source evidence is missing.

Stop conditions:

- Do not attempt LLM-as-judge integration in this slice.
- Do not make quality scoring dependent on network access.

### Slice 4: Codex/Claude Natural-Language Operating Path

Goal: make the AI-native product easy to operate through Codex and future compatible clients.

Target behavior:

A user can say:

```text
我有一本书/论文/专利/博客，想生成中文学习网页。先给总览课，再按核心 topic 拆课，每个单元 8 页。
```

The agent should:

1. Ask at most three learner-answerable clarification questions.
2. Call `learning_agent.create_learning_project`.
3. Call `learning_agent.get_authoring_context`.
4. Author or generate the course through the recommended path.
5. Publish or preview the course.
6. Return a concise preview URL and quality summary.
7. Invite learner feedback in natural language.

Work:

- Tighten `skills/learning-agent-operator/SKILL.md` around this exact flow.
- Add a `docs/runtime/codex-user-trial-script.md` with copyable prompts.
- Reduce large JSON in normal tool outputs by summarizing nested reports.
- Keep expert/operator artifacts available only when explicitly requested.
- Add tests that assert default skills do not recommend artifact approval to learners.

Acceptance:

- A fresh Codex session can follow only the skill docs and complete the learner flow.
- Normal learner flow returns preview URL plus quality summary, not large source maps.
- Expert mode still supports artifact review.
- `npm run bundle:check` and skill/MCP contract tests pass.

Stop conditions:

- Do not build a separate chat UI in this slice.
- Do not remove advanced operator tools.

### Slice 5: Learner Feedback And Progress Loop

Goal: make the generated course feel like a learning product, not just a generated artifact.

Target behavior:

The web interface should help the learner answer:

- Where am I in the course?
- What have I completed?
- Which checks did I miss?
- What should be revised if this page is confusing?
- Which source supports this page?

Work:

- Add local progress state:
  - current course
  - current unit
  - current page
  - completed pages
  - quiz attempts
- Add feedback affordance per page:
  - "太抽象"
  - "例子不够"
  - "来源依据不清楚"
  - "想要更难/更简单"
- Map feedback options to `revise_learning_course` scopes.
- Keep the learning page viewport fixed; move progress and feedback into sidebar or secondary panel.
- Make source evidence learner-readable rather than developer-oriented.

Acceptance:

- Refreshing the browser preserves local progress.
- Learner can submit page-level feedback without seeing internal artifacts.
- Feedback creates a revision brief with course ID, unit ID, page ID, and scope.
- The learning page still fits the viewport.

Stop conditions:

- Do not add hosted accounts.
- Do not add cross-device sync.
- Do not let progress UI crowd the main teaching page.

### Slice 6: Engineering Release Gate

Goal: make quality checks simple and repeatable for maintainers and contributors.

Work:

- Add `npm run release:check` as the superset local release gate.
- Suggested command:

```bash
npm run test:ci && npm run test:regression && npm run seed:check && npm run codex:mcp:check
```

- Add a Playwright smoke test command for:
  - root route opens default public sample
  - generated preview route opens public mock course
  - next-page navigation works
  - no console errors except known React devtools info
- Document when to run each gate:
  - `test:ci` for regular PRs
  - `test:regression` for generation/source changes
  - `seed:check` for product/MCP changes
  - `release:check` before public beta release

Acceptance:

- `npm run release:check` passes locally.
- README and CONTRIBUTING mention the release gate.
- CI remains fast enough for normal pull requests.
- Playwright smoke produces deterministic pass/fail output without requiring a human browser.

Stop conditions:

- Do not make every PR run the full slow release gate unless runtime stays acceptable.
- Do not require external API keys for release checks.

## Recommended Implementation Order

Implement in this order:

1. Slice 2: Clean Preview Runtime
2. Slice 3: Quality Report Contract
3. Slice 4: Codex/Claude Natural-Language Operating Path
4. Slice 6: Engineering Release Gate
5. Slice 1: Public Repository Readiness
6. Slice 5: Learner Feedback And Progress Loop

Reasoning:

- Clean preview output removes the biggest open-source polish issue.
- Quality reports address the biggest product trust issue.
- Natural-language operating path improves seed-user activation.
- Release gate protects the growing system.
- Repository metadata is useful but should not block kernel quality.
- Learner progress is valuable after generation quality is more stable.

## Tracking Checklist

- [ ] Slice 2 complete: README smoke no longer writes generated files under `src/`.
- [ ] Slice 3 complete: generated courses return compact quality reports.
- [ ] Slice 4 complete: Codex/Claude learner flow is documented and skill-tested.
- [ ] Slice 6 complete: `npm run release:check` exists and passes.
- [ ] Slice 1 complete: GitHub public repo has badge, templates, and contributor-ready docs.
- [ ] Slice 5 complete: learner progress and page-level feedback loop work locally.

## Release Candidate Gate

Before calling the next checkpoint `public beta`, run:

```bash
npm ci
npm run release:check
npm run mcp -- --list-tools
```

Then perform manual smoke:

```text
1. Open http://127.0.0.1:5173/
2. Confirm default public sample course opens.
3. Run the README Codex/MCP public mock source flow.
4. Open the generated preview URL.
5. Submit one page-level feedback item.
6. Apply revision.
7. Confirm quality report and preview update.
```

The checkpoint is not ready if any of these are true:

- A learner must approve internal artifacts in the default flow.
- A public smoke run writes generated files under tracked source directories by default.
- A source-backed course lacks source evidence.
- A generated course cannot produce a compact quality report.
- The learning page requires vertical scrolling for primary page content.
- CI is red on `main`.

