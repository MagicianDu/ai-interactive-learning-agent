# Codex Quality Calibration Loop Design

Date: 2026-05-13

## Purpose

Improve the stability and quality of Codex-authored learning courses by adding a rubric-driven calibration loop after initial authoring and before the learner sees the final preview.

The problem is not that Codex cannot write good course content. The problem is that one-shot authoring is inconsistent: some runs produce dense self-study material, while others drift into generic summaries, teacher-facing slides, repeated page structures, or weak source synthesis. The product needs a repeatable mechanism that turns quality feedback into concrete revision work.

This design adopts the MCP quality-report plus Codex revision loop. MCP remains the validator and publisher. Codex remains the course author and reviser.

## Product Goals

1. Add a default three-round quality calibration loop for Codex-authored courses.
2. Convert quality reports into concrete revision briefs instead of open-ended reflection prompts.
3. Improve `student_self_study_textbook` stability for long books, papers, patents, blogs, and notes.
4. Reduce weak source synthesis, repeated page structures, generic summaries, and teacher-facing phrasing before preview.
5. Keep the learner-facing workflow compact: the learner sees preview URL, course shape, quality summary, and top remaining issues, not internal artifacts.
6. Preserve user constraints: source, audience, difficulty, strategy, selected chapters/topics, unit pages, and total page budget.

## Non-Goals

- Do not replace Codex/Claude authoring with deterministic content generation.
- Do not expose internal review artifacts as learner approval steps.
- Do not require exactly three revisions when the course already passes the stop criteria.
- Do not make the loop specific to one source such as Weyl or Agentic Design Patterns.
- Do not add a new renderer or redesign the Web Deck UI in this slice.

## Existing Foundation

The loop should build on current project contracts:

- `learning_agent.prepare_learning_course`: prepares source anchors, course plan, content blueprint, and Codex authoring guidance.
- `learning_agent.publish_learning_course`: validates and publishes Codex-authored `coursePack` and `lessons`.
- `course-quality-report.json`: records score, blocking issues, warnings, check statuses, and page-level issues.
- `learning_agent.create_quality_revision`: converts comparison findings into revision briefs.
- `learning_agent.revise_learning_course`: records learner feedback as targeted revision briefs.
- `docs/runtime/codex-authoring-protocol-v2.md`: defines source synthesis, difficulty, visual/interaction, and revision contracts.
- `docs/runtime/self-study-golden-samples.md`: records accepted self-study title and density patterns.

## User-Facing Flow

The user should be able to ask from Codex or a similar agent:

```text
用这本书生成中文自学课程，先总览再按核心 topic 拆课，每个单元 8 页，面向研究生。
```

The system flow should be:

1. Agent calls `prepare_learning_course`.
2. Codex authors a complete course bundle.
3. Agent calls `publish_learning_course`.
4. If quality fails or warnings cross thresholds, the calibration loop runs.
5. Codex revises the bundle from structured revision briefs.
6. Agent republishes and repeats until stop criteria are met or `maxRounds` is reached.
7. Agent returns preview URL and a compact quality summary.

The learner should not approve source graph, unit plan, page blueprints, or internal revision artifacts.

## Calibration Rounds

### Round 1: Structure Calibration

Question: does the course structure match the learner request and avoid template-like pages?

Checks:

- User-selected `strategy`, `selectedChapters`, `selectedTopics`, `unitPages`, and `targetTotalPages` are preserved.
- Every unit has the requested page count unless the plan explicitly explains a compact exception.
- Page titles are learner-facing propositions or real questions, not page-role labels.
- Pages are not repeated board templates with only the topic name changed.
- Overview and topic units have different roles.
- A topic unit reads like a compressed textbook chapter, not a list of teaching prompts.

Revision brief should target:

- missing units
- wrong strategy
- repeated page roles
- generic titles
- weak unit progression
- mismatch between page budget and generated pages

### Round 2: Source Calibration

Question: does each page transform source material into a useful knowledge judgment?

Checks:

- Every source-backed page has `sourceAnchorIds`.
- `knowledgeBoard.sourceTrace` explains how source anchors support the proposition.
- Pages use source-specific terms, examples, evidence, limitations, or boundaries.
- Paper courses separate research problem, method, evidence, limitations, and transfer risk.
- Patent courses separate claim boundary, technical solution, embodiment, and risk boundary.
- Blog/documentation courses separate practice problem, operation path, decision point, and failure mode.
- Warnings such as `quality.page.source-synthesis-weak` are treated as revision work, not ignored.

Revision brief should target:

- weak source synthesis
- unsupported claims
- source anchors that do not match page content
- missing evidence chain
- missing assumptions or limitations
- source-kind depth gaps

### Round 3: Learner Calibration

Question: would a student reading this deck feel that each page teaches something concrete?

Checks:

- The course is written for students to self-study, not for professors to present.
- Each page explains one mental-model move with enough density.
- `knowledgeBoard` content has mechanism, example or boundary, and bottom-line judgment.
- The page does not use authoring scaffold phrases such as "本页围绕" or "本页从...入手".
- The course avoids low-density filler such as learning objectives, class discussion labels, and generic review prompts when the chosen intent is `student_self_study_textbook`.
- The final preview is one-screen readable without clipping or vertical scrolling in the Web Deck shell.

Revision brief should target:

- too generic
- too teacher-facing
- too low-density
- repeated phrasing
- missing mechanism
- missing example or boundary
- viewport-fit risk

## Tool Contract

Add a learner-facing MCP tool:

```ts
learning_agent.calibrate_learning_course
```

Input:

```ts
{
  runId: string;
  maxRounds?: number;        // default 3, max 5
  minScore?: number;         // default 90 for self-study, 85 for other intents
  failOnWarnings?: boolean;  // default false, but source synthesis warnings are revision targets
  focus?: Array<"structure" | "source" | "learner">;
}
```

Output:

```ts
{
  status:
    | "calibration_ready"
    | "revision_required"
    | "calibration_complete"
    | "calibration_stopped";
  runId: string;
  round: number;
  maxRounds: number;
  currentQuality: {
    status: string;
    score: number;
    requiredFixCount: number;
    optionalImprovementCount: number;
    topIssues: unknown[];
  };
  revisionBriefPath?: string;
  codexInstruction?: string;
  stopReason?: string;
  previewUrl?: string;
}
```

This tool should not rewrite lessons itself. It should read the current published preview and quality report, generate a structured revision brief for Codex, and tell Codex exactly what to revise before calling `publish_learning_course` again.

## Internal Artifacts

Each calibration run should write:

```text
runs/<run-id>/quality/calibration/
  calibration-state.json
  round-001-structure.json
  round-002-source.json
  round-003-learner.json
```

Each round artifact should include:

- round number
- round kind
- input quality report path
- detected issues
- revision targets
- expected evidence after revision
- publish result after revision when available
- stop decision

These artifacts are for operator/debug use. Normal learner responses should summarize them.

## Stop Criteria

The loop should stop early when all conditions are true:

- `publish_learning_course.status = preview_ready`
- no blocking quality issues
- quality score is at or above `minScore`
- no repeated page-title or repeated `knowledgeBoard` issue
- no `source_synthesis_weak` warning for source-backed pages when `courseIntent = student_self_study_textbook`
- no self-study scaffold language issue

The loop should stop with `calibration_stopped` when:

- `maxRounds` is reached
- the same issue appears in two consecutive rounds without improvement
- the revision would violate user constraints
- required source artifacts are missing
- Codex needs a fresh authoring pass rather than bounded revision

## Codex Revision Instruction

The tool should produce concise revision instructions in this shape:

```text
请读取当前 preview coursePack 与 lessons，并按 calibration revision brief 修订。
本轮目标：source calibration。
必须修复：
- self-study-weyl-space-time-matter-v1-topic-01/page-07: source synthesis weak. Add source-specific terms, evidence, and boundary from the listed anchors.
- self-study-weyl-space-time-matter-v1-topic-03/page-03: connect Lorentz transformation claim to source evidence.
保持不变：
- runId
- coursePack.units
- unit page counts
- sourceAnchorIds unless the current anchor is clearly wrong
修订后调用 learning_agent.publish_learning_course。
```

Codex should modify only the necessary pages unless the brief says the whole unit structure is flawed.

## Quality Metrics

Track these metrics per round:

- quality score
- blocking issue count
- warning count
- weak source synthesis page count
- repeated title count
- repeated board content count
- source anchored page ratio
- self-study scaffold phrase count
- average page text density
- changed page count

The final response should include:

- preview URL
- final score and status
- number of calibration rounds
- changed pages summary
- remaining warnings, if any

## Testing Strategy

Unit tests:

- `calibration-service.test.ts`
  - returns `calibration_complete` when quality already meets stop criteria
  - creates a structure revision brief for repeated titles
  - creates a source revision brief for `quality.page.source-synthesis-weak`
  - creates a learner revision brief for scaffold language and low-density pages
  - stops after `maxRounds`
  - preserves selected chapters/topics and page budgets

- `runtime-tools.test.ts`
  - exposes `learning_agent.calibrate_learning_course`
  - validates required `runId`
  - rejects unsafe run ids

- `tool-contracts.test.ts`
  - includes the MCP tool schema
  - marks the tool learner-facing

Integration tests:

- publish a weak self-study fixture
- run calibration
- inspect revision brief
- apply a Codex-authored fixed bundle in test fixture form
- republish
- assert quality score improves and source synthesis warnings drop

Manual acceptance:

- Run the current Weyl preview through source calibration.
- The three existing `source_synthesis_weak` warnings become concrete page revision instructions.
- After Codex revision and republish, quality score should rise above 90 or remaining warnings should be explicitly justified.

## Acceptance Criteria

1. `learning_agent.calibrate_learning_course` is available through runtime tools and MCP contracts.
2. The default max round count is 3.
3. A preview-ready course with no issues returns `calibration_complete` without asking Codex to revise.
4. A failed or warning-heavy course returns `revision_required` with a specific revision brief path and Codex instruction.
5. Source synthesis warnings are converted into page-specific revision targets.
6. The tool never asks the learner to approve internal artifacts.
7. Course constraints are preserved across calibration instructions.
8. The Weyl preview can produce a source calibration brief from its current three warnings.
9. Targeted unit tests and `npm run typecheck` pass.

## Rollout Plan

Phase 1 should implement the calibration planner and MCP tool only. It should not auto-edit content.

Phase 2 should add an operator command that runs one calibration round and prints the Codex revision instruction.

Phase 3 should add an optional `--auto-rounds 3` workflow for Codex-controlled sessions, where Codex revises and republishes after each brief.

Phase 4 should add benchmark reporting across books, papers, patents, blogs, and documentation.
