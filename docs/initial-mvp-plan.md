# Initial MVP Plan

> 历史说明：这是早期数据库索引互动 MVP 计划，不是当前默认产品规范。当前默认生成以 `docs/current-product-spec.zh-CN.md` 为准；本文件只用于理解项目起点或开发互动样例。

Topic:

```text
Why database indexes make queries faster
```

## Product Boundary

The MVP should be a 10-page interactive web lesson rendered from a structured lesson object.

It should not be:

- A generic slideshow tool
- A database simulator
- A long-form article
- A UI-only demo without learning design

## Page Sequence

1. Problem scene: querying 10 million rows
2. Intuition: searching a book with and without an index
3. Structure: table rows vs index structure
4. Process: full table scan animation
5. Process: indexed lookup animation
6. Interaction: choose query conditions and see scan path
7. Misconception: indexes always help
8. Code/SQL walkthrough: simple index examples
9. Transfer challenge: decide whether an index helps
10. Summary card

## Required Components

- DeckShell
- DeckPage
- ProgressBar
- PageNavigation
- DiagramFrame
- AnimatedFlow
- StepThrough
- PredictionPrompt
- MultipleChoiceQuiz
- FeedbackPanel
- MisconceptionCheck
- TransferChallenge
- SummaryCard
- CodeBlock
- CodeWalkthrough

## First Implementation Acceptance

- A learner can navigate through all 10 pages.
- At least 3 visual explanations render as SVG or structured HTML.
- Query path visualizer works.
- Index tradeoff checker works.
- Quizzes and checks provide explanatory feedback.
- Lesson content is loaded from structured data.
