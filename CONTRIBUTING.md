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
- No private source path or generated private lesson is included.
