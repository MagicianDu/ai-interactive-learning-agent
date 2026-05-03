import { describe, expect, test } from "vitest";

import { analyzeSourceEvidence } from "./source-evidence-analyzer.js";
import { createRunConfigFromArgs } from "../run-config.js";

describe("source evidence analyzer", () => {
  test("summarizes page-level source support for source-backed lessons", () => {
    const config = createRunConfigFromArgs({
      run: "evidence-smoke",
      sourceFile: "/tmp/source.md",
      sourceKind: "book",
      unitPages: "3"
    });
    const summary = analyzeSourceEvidence(
      [
        {
          id: "lesson-1",
          pages: [
            { id: "p1", title: "有来源页面", sourceAnchorIds: ["source-001:page-1"] },
            { id: "p2", title: "类比页面", grounding: { kind: "analogy", note: "教学类比" } },
            { id: "p3", title: "缺证据页面" }
          ]
        }
      ],
      config
    );

    expect(summary).toMatchObject({
      status: "failed",
      totalLessons: 1,
      totalPages: 3,
      supportedPages: 1,
      inferredPages: 1,
      unsupportedPages: 1,
      unsupportedPageRefs: ["lesson-1:p3"]
    });
    expect(summary.pageSupport).toEqual([
      { lessonId: "lesson-1", pageId: "p1", sourceSupport: "supported", sourceAnchorIds: ["source-001:page-1"] },
      { lessonId: "lesson-1", pageId: "p2", sourceSupport: "analogy", sourceAnchorIds: [] },
      { lessonId: "lesson-1", pageId: "p3", sourceSupport: "unsupported", sourceAnchorIds: [] }
    ]);
  });

  test("passes when every source-backed page has anchors or explicit non-source grounding", () => {
    const config = createRunConfigFromArgs({
      run: "evidence-passed",
      sourceFile: "/tmp/source.md",
      sourceKind: "paper",
      unitPages: "2"
    });

    expect(
      analyzeSourceEvidence(
        [
          {
            id: "lesson-1",
            pages: [
              { id: "p1", sourceAnchorIds: ["source-001:paragraph-1"] },
              { id: "p2", grounding: { kind: "inferred", note: "背景推断" } }
            ]
          }
        ],
        config
      )
    ).toMatchObject({
      status: "passed",
      supportedPages: 1,
      inferredPages: 1,
      unsupportedPages: 0
    });
  });
});
