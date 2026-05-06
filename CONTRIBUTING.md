# Contributing

Thanks for contributing to AI Interactive Learning Agent.

## Development Setup

```bash
npm install
npm run dev
```

The default demo uses public mock sources under `examples/sources/`.

## Verification

Run the stable OSS gate before opening a pull request:

```bash
npm run test:ci
```

Use the slower source regression gate when changing source ingestion, grounding,
course planning, or MCP learner flows:

```bash
npm run test:regression
npm run seed:check
```

Run the full release gate before public beta checkpoints:

```bash
npx playwright install chromium # first time on a machine
npm run release:check
```

Use `npm run smoke:playwright` when changing preview routing, Vite runtime
middleware, or learner navigation. It starts Vite locally and verifies the
default public sample plus a generated `#/preview/<run-id>` course.

## Source And Privacy Rules

- Do not commit private books, papers, patents, blogs, notes, PDFs, or generated
  courses derived from private sources.
- Do not commit machine-local paths such as `/Users/<name>/...`.
- Use `examples/sources/` for public fixtures.
- Keep `runs/`, `.playwright-cli/`, `dist/`, and generated private previews out
  of source control.

## Pull Request Checklist

- The change is scoped and described clearly.
- Tests or docs were updated for behavior changes.
- `npm run test:ci` passes locally.
- `npm run release:check` passes for public beta or MCP/runtime changes.
- No private source path or generated private lesson is included.
