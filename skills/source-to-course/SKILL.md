---
name: source-to-course
description: Use when converting books, papers, patents, blogs, notes, folders, or topic-only learner requests into course organization strategy, source kind, unit page count, selected chapters/topics, and MCP learner project inputs.
---

# Source To Course

Use this skill to turn learner-supplied material into a course request that the learner-facing MCP flow can execute.

## Product Contract

- Codex or Claude authors the final grounded preview behind `learning_agent.run_one_shot_learning_course` in the default learner profile.
- Keep learner-facing course output中文优先 unless the learner explicitly asks otherwise.
- Preserve `sourceAnchorIds` for books, papers, patents, blogs, notes, folders, and other source-backed materials.
- Advanced authoring tools can record Source Graph V2 and Course Planning V2 artifacts for expert audit, but learner mode should only receive course shape, preview, and quality summary.
- Codex should use `contentBlueprint.units[*].pageBlueprints` before writing lessons as constraints. For `student_self_study_textbook`, `pageType=codex_designed` means Codex/Claude must design each page role from the source instead of following a fixed template.
- Codex should follow `docs/runtime/codex-authoring-protocol-v2.md` (Codex Authoring Protocol V2) and the returned `sourceSemantics`: every page needs a mental-model move, source synthesis, learner action or check, feedback mechanism, and `cognitivePurpose` when interactive.
- 不要让学习者审批内部 artifacts such as source maps, concept maps, curriculum plans, or critic reports in the default learner flow.

## Source Routing

- `book`: long-form PDF/EPUB/text, usually needs an overview unit plus focused topic units, with optional chapter mapping.
- `paper`: extract research problem, method, evidence, limitations, and transfer use cases; keep source grounding visible.
- `patent`: map claims, prior-art problem, mechanism, embodiments, figures, and application boundaries.
- `blog`: extract the main argument, implementation pattern, caveats, and runnable examples.
- `notes` or folder: preserve the user's structure when clear; otherwise infer themes and prerequisites.
- topic-only: generate a compact course from the topic and audience, then ask for source material only if factual grounding is required.

## Strategy Mapping

- `overview_plus_topic`: default for long sources; one overview course plus core-topic units.
- `chapter_guided`: use when the learner asks to follow chapters or sections.
- `topic_guided`: use when the learner asks for core concepts, mental models, or selected topics.
- `task_guided`: use when the learner wants practical workflow, exercises, or application tasks.
- `hybrid`: use when the learner wants chapter traceability and topic-first learning.

Track selected chapters, selected topics, audience, teaching difficulty level, language, and `unitPages` as learner-visible choices. `unitPages` means pages per unit. For long books, preserve the difference between per-unit pages and total course pages: a five-chapter request at 10 pages per chapter should become one overview unit plus five chapter units, approximately 60 pages total.

All course visuals must follow the imagegen teaching illustration policy. Codex designs each page's visual idea, calls imagegen to generate the teaching image, saves the resulting PNG/WebP as a preview-consumable asset, and sets `visualSpec.imageUrl`, `imageAlt`, `imageProvider: "imagegen"`, and `imagePrompt` before treating the preview as final. Do not rely on MCP-generated SVG placeholders. Short labels are allowed when they improve comprehension, but the image must not duplicate the page title, bottom-line sentence, page-card text, or long text blocks. Every image prompt must explicitly forbid long prose, tables, and UI text boxes; the image should explain the knowledge point visually, not reproduce the right-side text rail. Each page needs an independent generated teaching image; do not reuse one unit-level image across multiple pages.

For source-backed `student_self_study_textbook`, use `learning_agent.run_one_shot_learning_course` by default. The learner should not approve review briefs, review reports, image manifests, batch state, or layout reports. Codex handles content design, grounded generation, and publishing behind the scenes in the default path.

For `student_self_study_textbook`, selected topics define the course scope. If the learner asks for "总览 + Prompt Chaining、Tool Use、Reflection" with `unitPages=10`, prepare one course pack with `unit-overview` plus three topic units, about 40 pages total. Do not create one temporary run per topic, and do not redistribute those selected units into the default 100-page whole-book budget unless the learner explicitly requested a total page count.

Ask at most three learner-answerable clarification questions. If the learner did not state teaching difficulty, ask them to choose one of: 入门衔接, 本科核心课程, 大学高年级/研究生课程, 研究论文精读/前沿讨论. If the learner did not state `unitPages`, ask for pages per unit, such as 6, 8, 10, or 12. Never ask a learner to approve source maps, concept maps, curriculum plans, or critic reports in the default flow.

Ask for course intent when the learner's goal is ambiguous:

- `build_mental_model`: interactive Web Deck for mental model construction, self-study, learner actions, feedback, misconception checks, and transfer.
- `professor_lecture_deck`: professor-style Web Deck that feels like university or graduate lecture notes, with course framing, prerequisites, concept maps, method taxonomy, worked examples, discussion prompts, homework, reading path, and lecture takeaways.
- `student_self_study_textbook`: self-study Web textbook for learners who want to avoid reading a long source directly; Codex/Claude designs the page sequence and writes dense student-facing explanations, while MCP validates source grounding and non-repetition.

If the learner says "教授 PPT", "lecture slides", "大学课程讲义", or similar, route to `professor_lecture_deck` but state that the output is still a Web Deck, not PPTX or Slides export.

## Apply The Plan Through MCP

Call the learner-facing tools in this order for the default flow:

```json
{"method":"tools/call","params":{"name":"learning_agent.run_one_shot_learning_course","arguments":{"request":"<Chinese learner request with source path or URL, audience, difficulty level, strategy, and unitPages>"}}}
{"method":"tools/call","params":{"name":"learning_agent.publish_learning_course","arguments":{"runId":"<run-id>","coursePack":"<Codex-authored coursePack>","lessons":"<Codex-authored lessons>"}}}
{"method":"tools/call","params":{"name":"learning_agent.create_imagegen_manifest","arguments":{"runId":"<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.record_imagegen_asset","arguments":{"runId":"<run-id>","lessonId":"<lesson-id>","pageId":"<page-id>","sourceImagePath":"<local imagegen PNG/WebP path>","generator":"imagegen","recordedBy":"codex-imagegen-<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.validate_imagegen_assets","arguments":{"runId":"<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"<run-id>"}}}
```

If `learning_agent.run_one_shot_learning_course` returns `clarification_required`, ask only those learner-visible questions and call it again. If it returns `authoring_required`, immediately use the returned `codexInstruction` to author `coursePack` and `lessons`, then call `learning_agent.publish_learning_course`. For authored textbook decks, do not stop there: complete `learning_agent.create_imagegen_manifest`, `learning_agent.record_imagegen_asset` or the batch tools, and `learning_agent.validate_imagegen_assets` so every page points to a real local preview image under `/__learning-preview/<runId>/images/...`. Do not treat `generated.invalid` as a publishable image URL. After asset validation succeeds, show only the learner-visible preview URL, course shape, and compact quality summary. Use `learning_agent.calibrate_learning_course`, `prepare_content_review`, imagegen batch tools, or production-pipeline tools only in authoring/operator mode.

When you switch into the production pipeline or imagegen batch path in authoring/operator mode, prefer the returned `nextItem` and `executionChecklist` instead of manually inferring the next page task. In Codex desktop, use the built-in `imagegen` tool directly; generated images are saved under `$CODEX_HOME/generated_images/<session-id>/`. Record each generated file through `learning_agent.record_imagegen_batch_item` with `status=succeeded`, `sourceImagePath`, `generator=imagegen`, and a concrete `recordedBy` value such as `codex-imagegen-<run-id>`. Do not stop after generating images in chat; the preview is not final until those files are copied into `runs/<runId>/preview/images/...`, provenance says `generator=imagegen`, `validate_imagegen_assets` passes, and the local image URLs return 200.

Professor lecture Web Deck example:

```json
{"method":"tools/call","params":{"name":"learning_agent.prepare_learning_course","arguments":{"request":"请用 /tmp/book.pdf 生成教授式中文 Web Deck，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。","sourcePath":"/tmp/book.pdf","sourceKind":"book","audience":"研究生","difficultyLevel":"upper_undergraduate_or_graduate","unitPages":10,"courseIntent":"professor_lecture_deck"}}}
```

Normal outputs should be compact: preview URL, course shape, `coursePlan.estimatedTotalPages` when available, and `qualityReport` status/score/checks/issueSummary/topIssues. Keep detailed artifacts available only when the learner explicitly asks for expert review.

## Advanced Authoring

Use this mode only when the user specifically asks to inspect separated source context, create deterministic drafts, or compare authored content against a draft baseline.

```json
{"method":"tools/call","params":{"name":"learning_agent.create_learning_project","arguments":{"request":"<Chinese learner request>"}}}
{"method":"tools/call","params":{"name":"learning_agent.get_authoring_context","arguments":{"runId":"<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.generate_grounded_course","arguments":{"runId":"<draft-run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.compare_authoring_quality","arguments":{"authoredRunId":"<authored-run-id>","draftRunId":"<draft-run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.create_quality_revision","arguments":{"runId":"<authored-run-id>"}}}
```

If the workflow produced both a deterministic draft run and a Codex-authored run, summarize the authored-vs-draft improvements plus remaining gaps. If there are remaining gaps, use the resulting brief as Codex's revision worklist. This is a quality delta report and revision loop, not a learner approval artifact.

When inspecting expert details, prefer the latest `source-graph`, `course-plan`, `unit-plan`, `authoring-context`, `course-ir`, `lesson-bundle`, and `publish-validation` artifacts. Do not turn those artifacts into learner approval steps.

## Quality Checklist

- Keep generated learning content Chinese-first unless requested otherwise.
- Codex should author the course content from the authoring context; MCP validates and publishes it.
- Preserve the learner's requested teaching difficulty level in lesson prerequisites, examples, assessments, and transfer tasks.
- For long sources, prefer an overview unit followed by focused units instead of compressing the entire source into one short lesson.
- Use Course Planning V2 expectations from authoring context to preserve strategy reason, source mapping, expected interactions, expected assessments, and transfer expectations.
- For long books, check `coursePlan.sourceCoveragePlan`, `estimatedTotalPages`, and `planningNotes` before authoring; do not compress all chapters into one short unit unless the learner explicitly asks for a summary-only course.
- Use `contentBlueprint.units[*].pageBlueprints` as the page-budget and quality checklist. In `student_self_study_textbook`, do not copy a fixed page template; design distinct page roles and ensure every page has a unique `knowledgeBoard`.
- For `student_self_study_textbook`, page titles must be content propositions or real learner questions. Do not use page-role labels such as "直观模型", "机制链路", or "来源证据" as visible titles, and do not write scaffold phrases such as "本页围绕..." or "本页从...入手".
- For `student_self_study_textbook`, `knowledgeBoard.leftColumn/rightColumn[*].label` must be a content-specific mini-heading. Prefer labels like "局部尺规", "比较相邻向量", or "曲面几何证据"; avoid generic template labels such as "机制链", "正式术语", "例子 / 证据", and "边界案例".
- For `student_self_study_textbook` overview-plus-topic courses, read `docs/runtime/self-study-golden-samples.md` and author all planned units in one `coursePack.units` bundle before publishing.
- For source-backed `student_self_study_textbook`, read `docs/runtime/content-review-loop.md`, complete the three-round content review, and validate imagegen batch assets before returning the final preview.
- Do not ask the learner to approve internal artifacts such as source maps, concept maps, or curriculum plans.
- Preserve chapter or section mappings when the learner asks for them.
- Keep every unit's page count aligned with the requested `unitPages`.
- Make the preview the main acceptance surface.
- If `qualityReport.status=failed`, revise from `topIssues` and republish; do not export unless a maintainer explicitly uses an expert override for debugging.
