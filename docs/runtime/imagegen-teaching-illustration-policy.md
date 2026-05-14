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

## Runtime Boundary

MCP validates and publishes. Codex designs content, calls imagegen, saves the
asset, and supplies `visualSpec.imageUrl`. The MCP publisher must not silently
invent placeholder visuals because that hides missing authoring work from the
learner-facing preview.
