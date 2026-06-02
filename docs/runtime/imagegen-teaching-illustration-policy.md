# Imagegen Teaching Illustration Policy

Date: 2026-05-13

## Product Rule

All learner-facing generated courses use this visual pipeline:

```text
Codex content design
  -> imagegen teaching illustration generation
  -> saved preview image asset
  -> Web Deck renders visualSpec.imageUrl
```

This applies to books, papers, patents, blogs, topic-only lessons, professor
Web Decks, student self-study textbooks, and mental-model lessons.

## Required Asset Contract

Every page that includes `visualSpec` must include:

```json
{
  "visualSpec": {
    "imageUrl": "<preview-consumable png or webp asset>",
    "imageAlt": "<learner-facing alt text>",
    "imageProvider": "imagegen",
    "imagePrompt": "<the prompt Codex used to generate the teaching image>"
  }
}
```

`imageUrl` must not point to a generated SVG placeholder. The publisher must
fail the course with a revision request if a visual page lacks the imagegen
asset contract.

For `textbook_deck` learner-facing pages, the image is required on every page.
Do not publish a text-only textbook page and expect the renderer to synthesize a
placeholder.

## Image Content Rules

- The image explains the middle visual idea only.
- Short labels, direction words, axis markers, and local annotations are allowed
  when they improve comprehension.
- The image must not repeat the page title.
- The image must not repeat the bottom-line sentence.
- The image must not repeat text already shown in the page cards.
- The image must not contain long prose, paragraph-like explanation, or UI-like
  text panels.
- The image must not contain tables or programmatic "knowledge diagram"
  placeholders in the middle visual area. It should be an imagegen-generated
  teaching illustration.
- Prefer concrete scientific, technical, conceptual, or process imagery over
  decorative stock-like art.
- The prompt must explicitly forbid long prose, tables, and UI text boxes. A
  prompt that permits or omits these guards should be rejected before publish.
- Source images may be used as references only when allowed and useful; the
  final asset is still an imagegen-generated teaching illustration and must not
  be presented as an original source figure.
- Each page needs its own teaching image. Reusing the same generated image
  across multiple pages is not acceptable even if the file is copied to
  different preview paths.

## Runtime Boundary

MCP validates and publishes. Codex designs content, calls imagegen, saves the
asset, and supplies `visualSpec.imageUrl`. The MCP publisher must not silently
invent placeholder visuals because that hides missing authoring work from the
learner-facing preview.

## Batch Workflow

For source-backed self-study courses, run imagegen as a batch after the final
Codex content-review round:

1. `learning_agent.create_imagegen_manifest` writes
   `runs/<run-id>/quality/imagegen/imagegen-prompt-manifest.json`.
2. Codex reads each manifest item, calls imagegen, and saves the resulting
   PNG/WebP file locally.
3. `learning_agent.record_imagegen_asset` copies the generated file into
   `runs/<run-id>/preview/images/<lesson-id>/` and rewrites the page
   `visualSpec`.
4. `learning_agent.validate_imagegen_assets` blocks missing files, SVG
   references, missing `imageProvider: "imagegen"`, unsafe prompts, and prompts
   without explicit guards against long prose, tables, and UI text boxes. It
   also blocks duplicate image content across pages by hashing the recorded
   preview assets.

This workflow is semi-automatic by design: Codex still makes the visual design
decision and calls imagegen, while MCP keeps paths, manifests, and validation
deterministic.

## Codex Built-In Imagegen Workflow

When Codex operates this repository directly, use the built-in `imagegen` tool
as the default image path. Do not wait for a separate image API key, and do not
substitute placeholder PNGs or generated SVGs.

The practical sequence is:

1. Call `learning_agent.start_imagegen_batch` and use its `nextItem` order as
   the page execution order.
2. For each page, call the built-in `imagegen` tool with a page-specific
   teaching prompt.
3. Codex saves generated images under:

```text
$CODEX_HOME/generated_images/<session-id>/<image-id>.png
```

In the current desktop environment this is usually:

```text
/Users/dm/.codex/generated_images/<session-id>/<image-id>.png
```

4. Leave the original generated file in that directory.
5. Record the generated file into the project through MCP:

```json
{
  "name": "learning_agent.record_imagegen_batch_item",
  "arguments": {
    "runId": "<run-id>",
    "lessonId": "<lesson-id>",
    "pageId": "page-01",
    "status": "succeeded",
    "sourceImagePath": "/Users/dm/.codex/generated_images/<session-id>/<image-id>.png",
    "generator": "imagegen",
    "recordedBy": "codex-imagegen"
  }
}
```

6. Run `learning_agent.validate_imagegen_assets`.
7. Run layout smoke before claiming the preview is final.

Do not treat a page as image-complete just because `visualSpec.imageUrl` exists.
The corresponding file must exist under `runs/<run-id>/preview/images/...`, the
URL must return 200 in the local preview server, and provenance must show
`generator: "imagegen"`.

If many images are generated in sequence, map them to pages by immediate
recording whenever possible. If recording is delayed, list the generated image
directory by modification time and map the files to the batch `nextItem` order
used during generation; then validate every page after recording.

Lessons from `active-portfolio-book-chapter-pilot-v1`:

- `course-quality-report.json` passing does not imply image assets are present.
- `preview/images/...` missing means the browser will show broken images even
  when the lesson JSON already has `imageUrl`.
- `record_imagegen_batch_item` should be called with `generator=imagegen`; an
  `unknown` provenance record is treated as invalid.
- The final acceptance evidence is the combination of:
  - `qualityReport.status=passed`
  - `validate_imagegen_assets.status=passed`
  - image URL checks returning 200
  - layout smoke passing with `loadedImageCount=1` on each page

## Practical Acceptance Notes

Use the following practical defaults for current student self-study Web Decks:

- Save the final learner-facing asset under `runs/<run-id>/preview/images/<lesson-id>/page-XX-imagegen-v1.png` unless there is a strong reason to use another preview-safe format.
- The page should consume the local preview asset directly through `visualSpec.imageUrl`; do not leave image files only in temporary model output folders.
- Treat image prompt guards as hard publish requirements, not style advice. The prompt should explicitly forbid:
  - `长段落文字`
  - `表格`
  - `UI 文本框` or `UI 面板`
- A good prompt should also state that the image is for knowledge explanation and should not repeat the page title, page正文, or bottom-line sentence.
- If a small course pack already has one strong overview plus a few strong topic units, finish the image batch for those units first. Do not postpone usable visuals until a hypothetical "complete course pack" exists.
