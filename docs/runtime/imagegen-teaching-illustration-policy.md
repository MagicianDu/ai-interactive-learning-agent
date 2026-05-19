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
