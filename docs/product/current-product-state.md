# Current Product State

Last verified: 2026-05-03

This document captures the current product shape after the seed-ready beta push. It is the stable reference for what exists today, what is intentionally local-only, and what is still missing before the system can be considered a complete AI-native learning product.

## Product Shape

AI Interactive Learning Agent is currently a local, Codex/MCP-driven learning experience generator.

The product bundle is MCP tools plus skills. MCP exposes stable local capabilities; skills define how Codex, Claude, OpenClaw-style clients, and future agent runtimes should interpret learner intent, select source strategies, avoid internal artifact approval in learner mode, and recover through feedback.

The working seed-ready flow is:

```text
learner intent in Codex
  -> learning_agent.create_learning_project
  -> learning_agent.get_authoring_context
  -> Codex authors coursePack + lessons
  -> learning_agent.publish_learning_course
  -> learning_agent.get_learning_preview
  -> browser learning interface
  -> learning_agent.revise_learning_course
  -> learning_agent.apply_learning_revision
  -> learning_agent.export_learning_course
```

The product is not only a web deck renderer. It now has four cooperating layers:

1. **Skills Layer**
   Defines how an AI operator should interpret learner intent, select workflow paths, judge quality, handle source types, and avoid exposing internal artifacts.

2. **MCP Tool Layer**
   Provides callable capabilities for Codex and other agent clients: project creation, authoring context, validation/publish, deterministic draft generation, preview, revision, export, and advanced operator workflows.

3. **Runtime Layer**
   Normalizes sources, prepares authoring context, writes artifacts, validates Codex-authored course bundles, can generate deterministic drafts, and publishes local preview files.

4. **Learning Surface**
   Renders learner-facing Chinese course packs with web deck navigation, course library, knowledge map, source anchors, and revision-friendly routes.

## Current Verified Capabilities

### Learner-Facing MCP Flow

The following tools are available for normal seed-user use and are now encoded in the skill/MCP contract test:

- `learning_agent.create_learning_project`
- `learning_agent.list_learning_projects`
- `learning_agent.archive_learning_project`
- `learning_agent.get_authoring_context`
- `learning_agent.publish_learning_course`
- `learning_agent.generate_grounded_course`
- `learning_agent.get_learning_preview`
- `learning_agent.revise_learning_course`
- `learning_agent.apply_learning_revision`
- `learning_agent.export_learning_course`

`learning_agent.generate_grounded_course` and `learning_agent.generate_quick_preview` remain available as deterministic draft/smoke-preview paths, but they are not the preferred high-quality default for source-backed seed-user trials.

### MCP And Skills Bundle

Codex can install the local product bundle with:

```bash
npm run codex:bundle:install
npm run bundle:check
npm run codex:mcp:check
```

`codex:bundle:install` installs the `learningAgent` MCP server config and copies the project skill pack into `~/.codex/skills/`. `bundle:check` verifies the package scripts, required skill files, and bundle docs without changing user state.

### Skills Layer

The skill pack now covers the current learner path:

- `skills/learning-agent-operator`: default learner-facing operation and explicit expert/operator fallback.
- `skills/source-to-course`: source kind, course strategy, selected chapter/topic, and page-per-unit routing for books, papers, patents, blogs, notes, folders, and topic-only requests.
- `skills/learner-feedback-revision`: feedback scope mapping, revision application, preview refresh, and export.
- `skills/learning-agent-runner`: single-topic/unit and legacy gate-based lesson operation.

The `tools/mcp-server/skill-mcp-contract.test.ts` check fails when these skills reference missing MCP tools or when `learning-agent-operator` stops defaulting to the learner-facing flow.

### Source Types

The regression suite covers:

- book
- paper
- patent
- blog

Current source regression output includes:

- `generatedUnitCount`
- `semanticStatus`
- `sourceEvidenceStatus`
- `sourceEvidence.supportedPages`
- `sourceEvidence.unsupportedPages`
- `missingConceptLabels`
- `semanticExpectations`
- source anchor count and warning count

Seed readiness fails if a source regression sample has `semanticStatus=failed`, `sourceEvidenceStatus=failed`, or missing source evidence status.

### Course Generation

Long sources now use a Codex-authored path by default. MCP returns authoring context containing:

- one recommended overview unit
- multiple recommended focused units
- source anchors and source samples
- strategy, unit page count, selected chapters/topics
- publish requirements and Codex instructions

Codex writes Chinese-first lesson text, interactions, checks, and course packs; MCP validates and publishes the local preview manifest.

The default organization is `overview_plus_topic`. The runtime also accepts `chapter_guided`, `topic_guided`, `task_guided`, and `hybrid` strategies.

### Learner Interface

The frontend currently supports:

- learner-first course view
- course project selector
- unit selector
- persistent left sidebar for learning functions
- page navigation and stable URL routes
- course library panel
- knowledge map panel
- source anchor display outside the main teaching page
- generated course bundle discovery
- learner-facing fallback text when a page has no interaction or assessment block

### Feedback And Export

Learner feedback can be recorded and applied:

```text
revise_learning_course
apply_learning_revision
get_learning_preview
```

Preview-ready courses can be exported:

```text
export_learning_course
```

The export manifest is written under:

```text
runs/<run-id>/exports/static-course/manifest.json
```

## Current Verification Gates

The release gate is:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run bundle:check
npm run codex:mcp:check
npm run source:regression
npm run seed:check
```

The most recent verified `seed:check` passed with:

```json
{
  "sourceRegression": {
    "total": 4,
    "passed": 4,
    "warnings": 0,
    "failed": 0,
    "sourceEvidence": {
      "passed": 4,
      "warnings": 0,
      "failed": 0,
      "missing": 0
    }
  }
}
```

Warnings are acceptable when the run still generates usable grounded units and the warning is not a semantic or source-evidence failure.

## Local-Only Smoke Artifacts

The local `public-mock-smoke` course generated during browser/MCP verification is intentionally not committed.

Local untracked paths may include:

```text
src/course-packs/public-mock-smoke/
src/lessons/public-mock-smoke-*/
```

These are useful for previewing the current product but should not be treated as source-controlled product examples because they are generated from temporary smoke-test output.

## Current Product Boundary

This is a seed-ready beta, not a complete product.

It is appropriate for seed users to test:

- whether Codex can take a source and learning request in natural language
- whether the system can quickly generate a Chinese preview
- whether the learner interface is understandable
- whether feedback can be applied
- whether course export exists

It is not yet appropriate to promise:

- publication-grade course quality for arbitrary books
- rigorous paragraph-level evidence proof for every claim
- a fully autonomous multi-agent production workflow
- cloud-hosted user/project management
- personalized learner memory
- complete AI tutor, teacher mode, or playground mode

## Main Product Gaps

1. **Skill distribution is local-only**
   The repository now has a Codex MCP+skills bundle installer and check, but it is still a local checkout workflow rather than a versioned package with release artifacts.

2. **Content generation is still too template-like**
   The generated courses are structurally valid, but many pages need deeper source-specific examples, stronger interaction design, and better misconception diagnosis.

3. **Source grounding is not strict enough**
   The system checks anchors and semantic coverage, but it does not yet prove that each important explanation is directly supported by its cited source span.

4. **Revision is targeted but shallow**
   The current targeted revision path can handle simple page-level feedback. It needs stronger scope detection, multi-lesson changes, and quality re-check loops.

5. **Multi-agent orchestration remains operator-oriented**
   Advanced gate-based workflows exist, but the learner-facing product should hide internal artifacts while still benefiting from specialist agents and critic passes.

6. **Frontend is usable, not final**
   The learning surface works for seed trials. It still lacks tutor mode, playgrounds, persistent learner progress, assessment history, and richer interaction components.

## Decision Boundary For Next Work

The next major investment should not be another UI-only pass. The highest-leverage next phase is:

```text
Skills Layer + Course Quality Kernel
```

That means strengthening source grounding, lesson critique, and revision quality while keeping Codex operating through the MCP+skills product bundle rather than as a raw tool caller.
