# Public Beta Quality Execution Plan

Date: 2026-05-06

Source spec: `docs/superpowers/specs/2026-05-06-public-beta-quality-execution-spec.md`

## Goal

Move the project from an open-source runnable checkpoint to a public beta shape:

```text
public repo
  -> clear setup
  -> Codex/MCP learner request
  -> clean generated preview
  -> compact quality report
  -> learner-facing course UI
  -> feedback/revision loop
  -> repeatable release gate
```

## Guardrails

- Default learner path is Chinese-first.
- Default learner flow must not require approving internal artifacts.
- Generated smoke output must not write TypeScript files under `src/` unless explicitly requested by a maintainer operation.
- Source-backed courses must carry source evidence and a compact quality summary.
- Main learning pages must remain viewport-fit and avoid vertical scrolling.
- Tests and docs must be updated in the same slice as behavior changes.

## Task 1: Clean Preview Runtime Contract

Files:

- `tools/agent-runtime/learner/learning-course-publisher.ts`
- `tools/agent-runtime/learner/grounded-course-service.ts`
- `tools/agent-runtime/learner/learning-preview-service.ts`
- `tools/agent-runtime/learner/*.test.ts`

Steps:

1. Introduce a preview runtime output under `runs/<run-id>/preview/`.
2. Write `course-pack.json`, `lessons/*.json`, and `manifest.json` for default publish/generate calls.
3. Preserve source publishing only behind an explicit maintainer mode.
4. Update publish/generate result types so normal responses point to preview files and preview URL.
5. Update tests to assert the default path does not create `src/course-packs/<run-id>` or `src/lessons/<lesson-id>`.

Verification:

- Targeted publisher and grounded-course tests pass.
- `git status --short --ignored=matching` after smoke shows `runs/` output, not generated `src/` paths.

## Task 2: Frontend Generated Preview Loading

Files:

- `vite.config.ts`
- `src/product/product-route.ts`
- `src/product/CourseWorkspace.tsx`
- `src/product/*preview*.ts`
- Relevant tests under `src/product/`

Steps:

1. Add a dev-only preview route such as `#/preview/<run-id>`.
2. Add a Vite dev middleware that serves `runs/<run-id>/preview/manifest.json` and linked lesson/course JSON from a safe local endpoint.
3. Add a frontend loader that fetches the manifest, normalizes it into registry-like entries, and opens the course directly.
4. Keep registered public sample courses as the default for normal local dev and production builds.

Verification:

- Product route tests cover `#/preview/<run-id>`.
- Workspace tests cover loading a preview manifest and rendering the generated unit.

## Task 3: Course Quality Report Contract

Files:

- `tools/agent-runtime/quality/`
- `tools/agent-runtime/learner/grounded-course-service.ts`
- `tools/agent-runtime/learner/learning-course-publisher.ts`
- `tools/agent-runtime/learner/export-bundle-service.ts`
- `tools/agent-runtime/learner/targeted-revision-service.ts`
- `tools/mcp-server/runtime-tools.ts`
- `tools/mcp-server/*.test.ts`

Steps:

1. Create a `CourseQualityReport` builder from existing critic, Chinese-first, source grounding, page structure, interaction, assessment, and transfer checks.
2. Write detailed reports under `runs/<run-id>/quality/course-quality-report.json`.
3. Return a compact summary in learner-facing MCP responses.
4. Keep detailed diagnostics available by file path/artifact reference.
5. Ensure unsupported source claims warn or fail deterministically without network access.

Verification:

- Unit tests cover passed, warning, and failed report states.
- Regression tests still cover book, paper, patent, and blog fixtures.
- `seed:check` fails if source evidence is missing.

## Task 4: Codex/Claude Natural-Language Operating Path

Files:

- `skills/learning-agent-operator/SKILL.md`
- `skills/learning-agent-runner/SKILL.md`
- `docs/runtime/codex-user-trial-script.md`
- `scripts/learning-agent-bundle.test.ts`
- `tools/mcp-server/skill-mcp-contract.test.ts`

Steps:

1. Tighten skill workflow around learner-answerable clarification questions.
2. Document a copyable Codex/Claude trial path for book, paper, patent, blog, and pasted-source cases.
3. Make normal responses emphasize preview URL, quality summary, and learner feedback instead of internal artifacts.
4. Keep expert artifact review documented as optional advanced mode.

Verification:

- Skill bundle check passes.
- Skill/MCP contract tests assert learner flow does not instruct artifact approval by default.

## Task 5: Engineering Release Gate

Files:

- `package.json`
- `scripts/`
- `README.md`
- `CONTRIBUTING.md`

Steps:

1. Add `npm run release:check` as the superset local gate.
2. Add deterministic browser smoke coverage for default sample, generated preview route, next-page navigation, and console error checks.
3. Document when to run `test:ci`, `test:regression`, `seed:check`, and `release:check`.

Verification:

- `npm run release:check` passes locally.

## Task 6: Public Repository Readiness

Files:

- `README.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
- Existing public docs

Steps:

1. Add GitHub Actions status badge.
2. Add distinct README paths for local developers and Codex/MCP learners.
3. Add issue templates for bugs, features, and source-generation quality reports.
4. Add pull request template with verification checklist.
5. Add repository topics through GitHub metadata if authenticated access allows it.

Verification:

- Docs contain no private local paths or private generated courses.
- `npm run test:ci` passes after docs/templates changes.

## Task 7: Learner Feedback And Progress Loop

Files:

- `src/product/CourseWorkspace.tsx`
- `src/product/LearningSidebar.tsx`
- New local progress/feedback helpers under `src/product/`
- `tools/agent-runtime/learner/learning-revision-service.ts`
- Relevant tests

Steps:

1. Persist current course, unit, page, completed pages, and quiz attempts in local storage.
2. Add learner-facing page feedback options:
   - `太抽象`
   - `例子不够`
   - `来源依据不清楚`
   - `想要更难`
   - `想要更简单`
3. Convert page feedback into a revision brief containing course ID, unit ID, page ID, and scope.
4. Keep progress and feedback in sidebar/secondary panels, not inside the main teaching canvas.
5. Make source evidence wording learner-readable.

Verification:

- Refresh preserves progress.
- Feedback tests assert the revision brief scope.
- Viewport-fit tests still pass.

## Final Validation

Run:

```bash
npm run test:ci
npm run test:regression
npm run seed:check
npm run codex:mcp:check
npm run release:check
npm run mcp -- --list-tools
```

Manual smoke:

1. Open `http://127.0.0.1:5173/`.
2. Confirm the public sample opens as a learner-facing course.
3. Run README public mock source generation through MCP.
4. Open the generated preview URL.
5. Submit one page-level feedback item.
6. Apply revision and confirm the quality report updates.

