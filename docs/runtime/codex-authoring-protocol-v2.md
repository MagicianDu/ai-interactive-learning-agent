# Codex Authoring Protocol V2

This protocol defines how Codex, Claude, or a similar agent authors Chinese learning courses after `learning_agent.prepare_learning_course` returns source semantics, course planning, and content blueprint data.

The current default goal follows `docs/current-product-spec.zh-CN.md`: reconstruct the source into a student self-study academic Web Deck. It is not a teacher deck, quiz lesson, classroom plan, or page-template filling task.

## Default Flow

1. Call `learning_agent.prepare_learning_course` after the learner has provided source or topic, audience, difficulty, structure, and pages per unit.
2. Read `sourceSemantics`, `coursePlan.recommendedUnits`, `coursePlan.sourceCoveragePlan`, `coursePlan.estimatedTotalPages`, and `contentBlueprint.units[*].pageBlueprints`.
3. Author `coursePack` and `lessons` directly in Codex. MCP should validate and publish; it should not replace the large model's authoring work.
4. Call `learning_agent.publish_learning_course`.
5. Immediately create and complete the image pipeline for learner-facing pages: `learning_agent.create_imagegen_manifest` -> built-in Codex `imagegen` per page -> `learning_agent.record_imagegen_asset` or `learning_agent.record_imagegen_batch_item` with `generator=imagegen` -> `learning_agent.validate_imagegen_assets`.
6. Only after the preview uses real local preview assets under `/__learning-preview/<runId>/images/...` should the run be treated as final learner-facing preview. Do not leave `generated.invalid` or any fake/external placeholder URL in published authored lessons.
7. If a deterministic draft exists, call `learning_agent.compare_authoring_quality`.
8. Use `qualityReport.topIssues`, comparison `remainingGaps`, and comparison `revisionInstructions` to revise before export.

In Codex desktop, the built-in `imagegen` tool saves generated images under
`$CODEX_HOME/generated_images/<session-id>/`. Keep those originals and record
each generated PNG/WebP into the run through the MCP image tools. A visible
`visualSpec.imageUrl` is not enough; the referenced file must exist under
`runs/<runId>/preview/images/...`, provenance must say `generator: "imagegen"`,
and `validate_imagegen_assets` plus layout smoke must pass before final handoff.

For source-heavy materials, do not default to exhaustive coverage. Prefer a compact course pack:

- one overview unit
- three to five high-value focused topic units
- stop when the learner can already form a stable mental model from the current package

Do not expand only for the sake of completion when later units mostly repeat the same judgment pattern.

## Page Contract

Every page must perform one explicit mental-model move.

For `student_self_study_textbook`, `contentBlueprint.units[*].pageBlueprints[*].pageType`
may be `codex_designed`. Treat that as an authoring slot, not a page
template. Codex or Claude should choose the actual page type, knowledge role,
and sequence from the source material. The hard constraints are page budget,
source grounding, one-screen density, unique academic claims, image-backed explanation,
examples or boundaries, and student-facing language.
Visible titles must be content propositions or real learner questions. Do not
use page-role labels such as "直观模型", "机制链路", or "来源证据" as titles,
and do not expose authoring scaffold phrases such as "本页围绕..." or
"本页从...入手".

Do not expose rubric or reviewer language such as "学习者需要看见问题、机制和边界",
"大学高年级/研究生课程层级需要额外追问", or "对研究论文学习来说，关键不是记住一句结论".
Do not use semantic-template section labels such as "X 的判断入口", "X 的推理链路",
"X 的证据边界", or "X 的自检问题".

For each page, Codex should check:

- `learningGoal`: what the learner should understand or be able to do after this page.
- `mental-model move`: problem framing, mechanism reveal, state transition, decision rule, misconception repair, or transfer.
- `source synthesis`: which source term, claim, evidence, example, limitation, or boundary is being transformed into learning material.
- `visual role`: what structure, process, comparison, or state change the visual explains.
- `learner action`: what the learner predicts, changes, chooses, orders, debugs, explains, or transfers.
- `feedback mechanism`: why the answer or observation is correct or incorrect, including the causal mechanism or source boundary.
- `sourceAnchorIds`: which source anchors support the page, unless the page is explicitly inferred, analogy, or transfer.

## Source Synthesis Rules

Source-grounded pages must do more than cite anchors.

Good source synthesis:

- uses concrete terms from `sourceSemantics.keyTerms`
- connects claims to `sourceSemantics.evidenceHints`
- preserves `sourceSemantics.limitationHints` where the source has assumptions or boundary conditions
- turns examples into learner actions, not passive descriptions
- distinguishes source claim, Codex inference, analogy, and transfer

Weak source synthesis:

- source anchors exist, but the page says only "本节介绍核心概念"
- the page repeats generic teaching language without source-specific terms
- a paper lesson explains a method but omits evidence and limitations
- a patent lesson explains the idea but does not distinguish claim boundary from embodiment
- a blog lesson lists steps but does not identify failure modes or decision points

## Student Self-Study Authoring Heuristics

Use the `talker-reasoner-paper-current-v11` style as the acceptance reference for source-backed self-study pages:

- Write as a student-facing academic note, not as a teacher speaking script.
- Each page should make one knowledge move and then defend it with source, mechanism, example, or boundary.
- The visible page should feel like "reading a compact textbook page", not "executing a lesson template".
- Topic units should usually be denser than overview units: fewer meta sentences, more direct judgments.
- If the source is a paper, pages should naturally surface research question, contribution claim, method mechanism, evidence path, limitation, and transfer boundary across the unit. Do not dump them as rigid headings on every page.
- `knowledgeBoard.rightColumn` should almost always contain an explicit example, evidence, boundary, limitation, or failure-mode move. If the right column only paraphrases the left column, the page is too weak for self-study.
- Add short formal markers when needed, such as `正式术语：` or `案例分析：`, but only when they increase academic precision rather than turning into visible scaffolding.

Do not let a focused topic unit regress into:

- generic "this page matters" wording
- repeated overview-level framing
- empty architecture praise
- content that could apply to any paper with only nouns swapped

## Difficulty Contract

### Undergraduate Core

- Introduce formal terms after intuition.
- Include worked examples, prediction checks, and misconception feedback.
- Keep prerequisites explicit but minimal.

### Upper-Undergraduate / Graduate

- Include prerequisites, formal terminology, mechanism chains, tradeoffs, and source reading mapping.
- Use classroom discussion prompts and homework-style transfer.
- Preserve assumptions and limitations instead of flattening them away.
- Quality reports expose `checks.academicDepth` and `depthRubric.missingMoves`; revise until prerequisite bridge, formal abstraction, evidence chain, assumption/boundary, critique/discussion, and homework transfer are all represented.

### Research Reading

- Separate research problem, method, evidence, limitations, novelty boundary, and transfer risk.
- Ask learners to evaluate claims, not just remember them.
- Include critique prompts and alternative interpretations when supported by the source.

### Practical Engineering

- Start from an operational problem.
- Use decision tables, runbooks, debugging paths, or parameter experiments.
- Feedback should explain how the decision affects system behavior.

## Visual And Interaction Contract

Codex should design visuals and interactions from the topic, not from a fixed slideshow template.

Useful visual roles:

- structure map
- process flow
- state transition
- evidence chain
- comparison table
- architecture boundary
- decision tree
- timeline

Useful interaction purposes:

- cause-and-effect manipulation
- prediction before reveal
- strategy choice
- ordering a process
- parameter experiment
- misconception repair
- transfer to a new context

The `interactionSpec.cognitivePurpose` must name the cognitive work. Vague purposes such as "帮助理解内容" or "增加互动性" are not enough.

## Revision Contract

When `qualityReport.status=failed` or `compare_authoring_quality.remainingGaps` is non-empty, revise the course before export. Prefer `compare_authoring_quality.revisionInstructions` as the Codex worklist because each item maps a gap to concrete edits and expected verification evidence.

If the comparison report has `remainingGaps`, call `learning_agent.create_quality_revision` for the authored run. This writes a revision brief under `runs/<run-id>/learning-revisions/` so Codex can revise from concrete quality instructions instead of ad hoc notes.

Common fixes:

- generic page: add source-specific terms, mechanism, and learning action
- weak source synthesis: connect source terms, evidence, examples, and limitations to the page
- shallow academic depth: add prerequisites, formal terms, assumptions, critique, and homework-style transfer
- decorative interaction: replace it with prediction, decision, comparison, or parameter manipulation plus explanatory feedback

When a course already has one strong overview and three to five strong focused units, ask whether further expansion adds new mental-model value. If not, stop and preserve quality instead of scaling low-value pages.

Do not ask the learner to approve internal artifacts. Summarize only the preview URL, course shape, quality status, top issues, and next action.
