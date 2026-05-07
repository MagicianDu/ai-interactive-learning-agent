# Future Development Plan

Last updated: 2026-05-06

Historical note: this document records the development direction used before
the product-core pruning pass. Current product truth lives in `README.md` and
`docs/product/product-core.md`. Use the references below for context only, not
as the default learner workflow or current implementation order.

Historical serial product mainline reference:

- Historical reference only: `docs/superpowers/specs/2026-05-06-product-mainline-development-spec.md`

Historical execution plan for Milestone B plus bounded parallel pre-research:

- Historical reference only: `docs/superpowers/plans/2026-05-06-milestone-b-parallel-workstreams.md`

Historical Milestone C feedback-to-revision spec and execution plan:

- Historical reference only: `docs/superpowers/specs/2026-05-06-milestone-c-feedback-revision-design.md`
- Historical reference only: `docs/superpowers/plans/2026-05-06-milestone-c-feedback-revision.md`

Parallel exploration tracks are recorded for later promotion here:

```text
docs/product/parallel-exploration-backlog.md
```

Historical executable spec for the public-beta quality push:

- Historical reference only: `docs/superpowers/specs/2026-05-06-public-beta-quality-execution-spec.md`

Do not use historical specs as the public product promise unless they are
promoted back into `docs/product/product-core.md` or a current runtime guide.

## Product Direction

The target product is an AI-native learning experience generator.

The durable architecture should be:

```text
Skills
  define how AI agents reason, route, critique, recover, and communicate
MCP tools
  expose stable callable capabilities
Runtime
  executes source normalization, course generation, validation, revision, export
Learning surface
  renders interactive learner-facing experiences
```

MCP alone is not enough. It exposes actions but does not encode judgment. Skills must become the product's operating system for Codex, Claude, OpenClaw, and future agent clients.

## Development Principles

- Keep the default path learner-facing.
- Do not expose internal artifacts unless the user explicitly asks for expert/operator mode.
- Preserve Chinese-first learning content by default.
- Treat long sources as course packs, not single short lessons.
- Prefer source-grounded examples over generic explanations.
- Make every interaction serve mental model construction.
- Keep release gates executable and fast enough for frequent use.

## Phase 1: Skills And MCP Alignment

Goal: turn the existing skills into a usable AI-native product layer.

Status on 2026-05-03: baseline implemented. The repository now has learner-facing operator, source routing, and feedback revision skills aligned with current MCP tools, a contract test included in `npm run seed:check`, and a Codex local MCP+skills bundle installer/check. Remaining Phase 1 work is versioned release packaging beyond a local checkout.

### Work Items

- Completed: rewrite `skills/learning-agent-operator/SKILL.md` around the seed-ready flow:

```text
create_learning_project
get_authoring_context
publish_learning_course
get_learning_preview
revise_learning_course
apply_learning_revision
export_learning_course
```

- Completed: keep advanced gate-based operation as an explicit expert mode, not the default.
- Completed: keep `learning-agent-runner` scoped to single topic/unit workflows only.
- Completed: add a `source-to-course` skill for source-type routing:
  - book
  - paper
  - patent
  - blog
  - notes/folder
  - topic only
- Completed: add a `learner-feedback-revision` skill for feedback interpretation and revision application.
- Completed: add a `skill-mcp-contract` check that verifies skill docs mention only existing MCP tools and preferred workflows.
- Completed: add public packaging/install docs and `bundle:check` for the MCP plus skills bundle.
- Remaining: turn the local bundle into a versioned release package.

### Acceptance

- A new Codex session can read the skill and choose the seed-ready tool path without being told tool names.
- Skill docs do not recommend deprecated default flows.
- Contract test fails if skills reference missing MCP tools.
- README clearly states that the product is distributed as MCP plus skills.

## Phase 2: Course Quality Kernel

Goal: improve generated lesson quality beyond structural validity.

Status on 2026-05-04: source evidence mapping baseline implemented. Grounded course generation now returns `sourceEvidence`; critic reports include page-level source support; `source:regression` and `seed:check` fail on failed or missing source evidence status.

Status update on 2026-05-04: default high-quality authoring is moving from deterministic MCP generation to Codex-authored course bundles. MCP now exposes authoring context and keeps deterministic generation as a draft/smoke path.

### Work Items

- Strengthen source semantics:
  - richer concept labels
  - source-specific examples
  - prerequisite extraction
  - misconception extraction
  - candidate interaction extraction
- Baseline implemented: add source evidence mapping:
  - each key claim maps to one or more source spans
  - inferred/analogy/background claims are explicitly marked
  - unsupported claims are flagged
- Improve unit planning:
  - distinguish overview, chapter, topic, task, and transfer units
  - preserve chapter references while allowing pedagogical reorder
  - generate unit-level learning objectives
- Improve page planning:
  - concrete problem first
  - visual model
  - learner action
  - feedback
  - terminology/code/formula
  - transfer

### Acceptance

- Real book, paper, patent, and blog regression samples produce courses with fewer generic pages.
- Critic reports flag generic explanations and weak interactions.
- `source:regression` includes source evidence status in addition to semantic status.
- Generated lessons contain meaningful interactions instead of only visual summaries.
- Default high-quality flow uses `get_authoring_context` followed by Codex-authored `publish_learning_course`.

## Phase 3: Critic And Revision Loop

Goal: make quality control part of the generation loop, not only a final check.

### Work Items

- Upgrade `lesson-critic` from checklist to blocking quality gate.
- Add page-level quality scoring:
  - problem clarity
  - source support
  - visual usefulness
  - interaction purpose
  - feedback quality
  - transfer quality
- Add revision planner:
  - classify learner feedback by scope
  - page-level
  - unit-level
  - course-level
  - source coverage
  - style/readability
- Re-run critic after `apply_learning_revision`.

### Acceptance

- `apply_learning_revision` returns both changed lesson IDs and quality re-check status.
- Feedback like "第 3 页太抽象" produces concrete page changes, not only publish notes.
- Critic can block export when required fixes remain.

## Phase 4: Learner Product Surface

Goal: improve the user-facing learning experience after the kernel is stronger.

### Work Items

- Add richer interaction components:
  - timeline stepper
  - graph/path explorer
  - drag-to-order
  - prediction prompt
  - compare strategies
  - parameter experiment
- Add AI tutor mode:
  - explain current page
  - ask diagnostic questions
  - route feedback into revision tools
  - reference source anchors
- Add learner progress:
  - current page
  - completed units
  - quiz attempts
  - misconception notes
- Add better export/share options:
  - static package
  - markdown summary
  - teacher handout

### Acceptance

- A seed user can learn through the generated course without seeing developer language.
- The tutor can operate the current page without replacing the visual lesson.
- Learner progress survives refresh for a local project.

## Phase 5: Multi-Agent Production Runtime

Goal: move from local deterministic generation to robust specialist-agent orchestration.

### Work Items

- Define fresh subagent roles:
  - source analyst
  - curriculum planner
  - visual pedagogy designer
  - interaction designer
  - assessment designer
  - lesson writer
  - critic
  - revision editor
- Support model selection by role.
- Support runtime adapters:
  - Codex
  - Claude
  - OpenClaw
  - local/mock
- Keep learner path simple while allowing expert/operator audit mode.
- Add run recovery and partial retry.

### Acceptance

- Long-source generation can split work by unit or role.
- Failed unit generation can be retried without restarting the whole course.
- Expert mode can inspect artifacts, but learner mode never requires artifact approval.

## Phase 6: Productization

Goal: make the system usable outside a local development checkout.

### Work Items

- Package MCP server and skill pack together.
- Add installation and upgrade docs.
- Add project persistence beyond local generated source files.
- Add user/project library storage.
- Add deployment path for preview/share.
- Add privacy controls for private books and documents.

### Acceptance

- A new user can install the MCP + skills bundle and generate a course from Codex.
- Private-source generated lessons are not accidentally committed.
- Exported packages have clear provenance and source-use metadata.

## Immediate Next Sprint

The next sprint should move from Phase 1 into Phase 2 and Phase 3.

Recommended task order:

1. Strengthen source evidence mapping before adding more UI-heavy interaction components.
2. Upgrade critic and revision loops so feedback changes are quality-checked before export.
3. Add richer source-specific examples, misconceptions, and candidate interactions.
4. Prepare versioned MCP+skills release packaging after the quality kernel is less template-like.

## Open Decisions

- Should generated seed-user previews under `src/lessons` be ignored by default, or should the runtime write seed previews outside source-controlled directories?
- Should the first public skill pack target Codex only, or be written as a runtime-neutral agent skill pack?
- Should source evidence mapping be implemented before richer interaction components?
- Should teacher mode wait until the learner course quality kernel is stronger?

Recommended answers:

- Keep real-source seed previews out of commits unless explicitly promoted as examples.
- Write skills runtime-neutrally, with Codex-specific examples.
- Implement source evidence mapping before new UI-heavy interaction work.
- Delay teacher mode until generated learner lessons are consistently useful.
