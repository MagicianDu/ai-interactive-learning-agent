## Summary

Describe the product/runtime change and the learner-facing impact.

## Verification

- [ ] `npm run test:ci`
- [ ] `npm run test:regression` if source generation, grounding, or MCP behavior changed
- [ ] `npm run seed:check` if learner-facing MCP flow changed
- [ ] `npm run smoke:playwright` if preview routing, Vite runtime, or navigation changed
- [ ] `npm run release:check` for public beta checkpoints

## Privacy And Source Safety

- [ ] No private books, papers, patents, blogs, notes, generated private lessons, or local machine paths are committed.
- [ ] Public fixtures live under `examples/sources/`.
- [ ] Runtime output remains under ignored `runs/`.

## Screenshots Or Preview

Add a public sample preview route or screenshot when UI changed.
