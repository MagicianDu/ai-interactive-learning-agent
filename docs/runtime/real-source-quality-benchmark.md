# Real Source Quality Benchmark

This benchmark records what source-backed Codex-authored courses must preserve across different input types. It complements automated real-source regression without committing private or copyrighted generated course content.

## Shared Quality Dimensions

Every source-backed course should be checked for:

- source semantics: course pages use source-specific terms, examples, evidence, and limitations
- source synthesis: anchors support learning claims rather than acting as decorative citations
- academic depth: difficulty level changes prerequisites, formal terms, critique, discussion, and transfer
- learner action: interactions ask learners to predict, decide, compare, debug, manipulate, or transfer
- feedback mechanism: feedback explains why the learner's assumption works or fails
- visual purpose: visuals expose structure, process, state, boundary, evidence chain, or decision logic
- transfer: each unit ends with a new-context application task

## Source Kind Expectations

### book

- Preserve chapter or section mapping when requested.
- Start with a whole-source overview, then split into core topics or chapters.
- Extract recurring concepts, examples, author assumptions, and conceptual dependencies.

### paper

- Separate research problem, method, evidence, limitations, and novelty boundary.
- Use source evidence to explain why a claim is supported or still uncertain.
- Include critique and transfer tasks suitable for research reading.

### patent

- Distinguish claim boundary, technical solution, embodiment, and implementation example.
- Make learner tasks compare what is protected, what is merely described, and what is inferred.
- Preserve risk boundaries and prior-art framing.
- Required depth moves: 权利要求边界, 现有技术问题, 技术方案/机制, 实施例, 法律/适用边界, 规避或迁移判断.

### blog

- Extract the practical problem, workflow, implementation choices, caveats, and failure modes.
- Convert steps into learner decisions, not just a checklist.
- Mark inferred background separately from source-backed claims.
- Required depth moves: 实际问题, 作者方案, 实现路径, caveat/失败模式, 可操作检查, 迁移边界.

### documentation

- Preserve API or system contract, parameters, lifecycle, constraints, and failure cases.
- Convert reference material into task-guided learning with debugging or configuration checks.
- Make version or environment assumptions explicit when present.

### notes

- Preserve the user's structure when it is meaningful.
- Infer prerequisites and missing transitions cautiously.
- Separate the user's claims from Codex-added background.

### topic-only

- Ask for source material when factual grounding matters.
- If the learner wants a topic-only course, mark examples and claims as model-generated rather than source-backed.
- Focus on mental model, worked examples, misconception checks, and transfer.

## Seed Regression Samples

The current automated sample set covers:

- book: local agent workflow notes
- paper: local Talker-Reasoner architecture mock paper
- patent: public patent URL
- blog: public technical blog URL

Documentation, notes, and topic-only are tracked here as benchmark categories and should be added as automated samples once lightweight public fixtures exist.

## Automated Report Shape

`npm run source:regression` now includes a `qualityBenchmark` object. It is intentionally a benchmark report, not a learner approval artifact.

Fields:

- `status`: `passed`, `warning`, or `failed`.
- `summary`: source-kind coverage counts, sample readiness counts, warning sample count, and failed sample count.
- `qualityDimensions`: the shared benchmark dimensions listed above.
- `sourceKinds`: one row per benchmark source kind with `coverage`, `status`, `sampleIds`, missing dimensions, failing samples, warning samples, and acceptance checks.
- `nextActions`: concrete maintainer actions, such as adding tracked-only samples or raising missing quality dimensions for an automated source kind.

Interpretation:

- `failed` means at least one automated sample failed project readiness, grounded publishing, semantic checks, source evidence, or source graph checks.
- `warning` means automated samples are usable but some dimensions or tracked-only source kinds still need stronger coverage.
- `tracked_only` source kinds keep future requirements visible without blocking the current public regression suite.
