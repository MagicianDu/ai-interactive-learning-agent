# source-ingest

## Description

Extract teachable concepts from books, articles, notes, code, papers, or pasted technical text.

## When To Use

Use before lesson planning when source material exists and the core ideas must be distilled.

## Inputs

- Source text, file path, URL, notes, or topic
- Target audience if available
- Desired lesson scope if available

## Outputs

```json
{
  "concepts": [],
  "dependencies": [],
  "examples": [],
  "misconceptions": [],
  "candidateInteractions": []
}
```

## Workflow

1. Identify the main concept and supporting concepts.
2. Extract prerequisite assumptions.
3. Find examples, analogies, and concrete situations.
4. Identify hidden structures, flows, states, or causal mechanisms.
5. List likely misconceptions.
6. Propose candidate learner actions.
7. Remove trivia and passive explanation fragments.

## Quality Checklist

- Concepts are teachable, not just headings.
- Dependencies are explicit.
- Misconceptions are plausible.
- Candidate interactions require learner thinking.
- Output can feed learning architecture directly.

