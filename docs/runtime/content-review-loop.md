# Content Review Loop

Default source-backed self-study courses use Codex as a content reviewer before final imagegen publishing. MCP creates review briefs and records state; Codex reads the brief, critiques the course, revises the bundle, and republishes.

## Default Flow

1. Publish the draft course with `learning_agent.publish_learning_course`.
2. Call `learning_agent.prepare_content_review` with `maxRounds=3`.
3. Codex acts as `content-review-agent`: critique first, revise second.
4. Republish the revised `coursePack` and `lessons`.
5. Call `learning_agent.record_content_review_report` for that round.
6. Repeat until the third round completes or `prepare_content_review` returns `review_complete`.
7. Use the third-round revised bundle for imagegen batch generation and final preview.

Learners should not approve review artifacts. They should see the preview URL, course shape, compact quality summary, and remaining high-level risks only.

## Review Report

After each revision round, Codex must record a compact reviewer report:

```json
{
  "method": "tools/call",
  "params": {
    "name": "learning_agent.record_content_review_report",
    "arguments": {
      "runId": "<run-id>",
      "round": 1,
      "reviewerVerdict": "revise",
      "summary": "本轮修复了模板化标题，但部分来源页知识密度仍偏低。",
      "issues": [
        {
          "lessonId": "<lesson-id>",
          "pageId": "<page-id>",
          "severity": "major",
          "category": "density",
          "finding": "页面只给出抽象判断，缺少来源中的具体约束关系。",
          "recommendation": "补充来源概念之间的条件、例子和失效边界。"
        }
      ]
    }
  }
}
```

MCP records:

- `round-###-content-review-report.json`: reviewer verdict, issues, measured metrics, and delta.
- `content-review-state.json`: latest round, latest verdict, latest metrics, latest delta, and final verdict after round 3.

Useful metrics include template label count, missing imagegen asset count, generic title count, low-density page count, source-anchored page count, and source-trace page count. The metric delta is the practical signal that review is improving content instead of only adding process.

## Review Focus

Round 1 checks structure and knowledge chain:

- planned units and page budgets are preserved
- page titles are content propositions, not template roles
- overview and topic units have different jobs
- pages form a coherent student-readable sequence

Round 2 checks source fidelity and density:

- source-backed pages use concrete source terms, examples, limits, or relations
- `sourceAnchorIds` and `knowledgeBoard.sourceTrace` support the actual claim
- the page does not collapse the source into generic summary language

Round 3 checks learner readability and image/text fit:

- every page teaches one concrete knowledge judgment
- right-side notes are dense but readable
- section labels are content-specific mini-headings
- image prompts describe the middle visual idea and forbid long prose, tables, and UI panels

## Imagegen Batch After Review

After the final review round:

1. Call `learning_agent.create_imagegen_manifest`.
2. Codex reads `runs/<run-id>/quality/imagegen/imagegen-prompt-manifest.json`.
3. Codex calls imagegen for each manifest item.
4. Call `learning_agent.record_imagegen_asset` for every generated PNG/WebP.
5. Call `learning_agent.validate_imagegen_assets`.
6. If validation fails, regenerate or record the affected page images and validate again.

The final preview should contain imagegen PNG/WebP assets only. SVG placeholders, missing files, unsafe prompts, or prompts that allow long prose, tables, or UI panels block acceptance.
