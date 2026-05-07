# Codex Authoring Protocol V2

This protocol defines how Codex, Claude, or a similar agent authors Chinese learning courses after `learning_agent.prepare_learning_course` returns source semantics, course planning, and content blueprint data.

The goal is not to summarize material into slides. The goal is to reconstruct the source into a university-grade learning experience that builds transferable mental models.

## Default Flow

1. Call `learning_agent.prepare_learning_course` after the learner has provided source or topic, audience, difficulty, structure, and pages per unit.
2. Read `sourceSemantics`, `coursePlan.recommendedUnits`, and `contentBlueprint.units[*].pageBlueprints`.
3. Author `coursePack` and `lessons` directly in Codex. MCP should validate and publish; it should not replace the large model's authoring work.
4. Call `learning_agent.publish_learning_course`.
5. If a deterministic draft exists, call `learning_agent.compare_authoring_quality`.
6. Use `qualityReport.topIssues`, comparison `remainingGaps`, and comparison `revisionInstructions` to revise before export.

## Page Contract

Every page must perform one explicit mental-model move.

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

## Difficulty Contract

### Undergraduate Core

- Introduce formal terms after intuition.
- Include worked examples, prediction checks, and misconception feedback.
- Keep prerequisites explicit but minimal.

### Upper-Undergraduate / Graduate

- Include prerequisites, formal terminology, mechanism chains, tradeoffs, and source reading mapping.
- Use classroom discussion prompts and homework-style transfer.
- Preserve assumptions and limitations instead of flattening them away.

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

Common fixes:

- generic page: add source-specific terms, mechanism, and learning action
- weak source synthesis: connect source terms, evidence, examples, and limitations to the page
- shallow academic depth: add prerequisites, formal terms, assumptions, critique, and homework-style transfer
- decorative interaction: replace it with prediction, decision, comparison, or parameter manipulation plus explanatory feedback

Do not ask the learner to approve internal artifacts. Summarize only the preview URL, course shape, quality status, top issues, and next action.
