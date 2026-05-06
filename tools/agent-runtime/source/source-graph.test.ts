import { describe, expect, it } from "vitest";

import type { SourceAnchor, SourceStructureNode } from "../corpus-types.js";
import { extractSourceSemantics } from "../learner/source-semantic-extractor.js";
import { buildSourceGraph } from "./source-graph.js";

function anchor(anchorId: string, label: string, quote: string, locator: SourceAnchor["locator"]): SourceAnchor {
  return {
    sourceId: "source-001",
    anchorId,
    label,
    locator,
    quote
  };
}

function node(
  id: string,
  type: SourceStructureNode["type"],
  title: string,
  anchorIds: string[],
  children: string[] = []
): SourceStructureNode {
  return {
    id,
    sourceId: "source-001",
    type,
    title,
    anchorIds,
    children
  };
}

describe("buildSourceGraph", () => {
  it("preserves chapter source units for book inputs", () => {
    const anchors = [
      anchor("source-001:chapter-1", "第 1 章 Agent Loop", "第 1 章 Agent Loop", {
        kind: "heading",
        headingPath: ["第 1 章 Agent Loop"]
      }),
      anchor("source-001:p1", "Paragraph 1", "Agent loop connects planning, tool use, reflection, and evaluation.", {
        kind: "paragraph",
        paragraphId: "1"
      })
    ];
    const graph = buildSourceGraph({
      runId: "book-run",
      sourceKind: "book",
      structure: [
        node("source-001:root", "document", "Agent Workflow Patterns", anchors.map((item) => item.anchorId), [
          "source-001:chapter-1",
          "source-001:p1"
        ]),
        node("source-001:chapter-1", "chapter", "第 1 章 Agent Loop", ["source-001:chapter-1"]),
        node("source-001:p1", "paragraph", "Paragraph 1", ["source-001:p1"])
      ],
      anchors,
      semantics: extractSourceSemantics({ sourceKind: "book", anchors })
    });

    expect(graph.sourceKind).toBe("book");
    expect(graph.sourceUnits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "source-001:chapter-1",
          title: "第 1 章 Agent Loop",
          kind: "chapter",
          anchorIds: ["source-001:chapter-1"],
          role: "chapter"
        })
      ])
    );
    expect(graph.concepts).toHaveLength(5);
    expect(graph.examples.length).toBeGreaterThanOrEqual(2);
    expect(graph.misconceptions.length).toBeGreaterThanOrEqual(2);
    expect(graph.candidateInteractions.length).toBeGreaterThanOrEqual(2);
  });

  it("classifies paper sections into problem, method, experiment, conclusion, and limitation roles", () => {
    const anchors = [
      anchor("paper:introduction", "Introduction", "Introduction describes the research problem.", {
        kind: "heading",
        headingPath: ["Introduction"]
      }),
      anchor("paper:method", "Method", "Method explains the proposed architecture.", {
        kind: "heading",
        headingPath: ["Method"]
      }),
      anchor("paper:experiments", "Experiments", "Experiments evaluate the method.", {
        kind: "heading",
        headingPath: ["Experiments"]
      }),
      anchor("paper:limitations", "Limitations", "Limitations bound the claim.", {
        kind: "heading",
        headingPath: ["Limitations"]
      }),
      anchor("paper:conclusion", "Conclusion", "Conclusion summarizes transfer conditions.", {
        kind: "heading",
        headingPath: ["Conclusion"]
      })
    ];
    const graph = buildSourceGraph({
      runId: "paper-run",
      sourceKind: "paper",
      structure: anchors.map((item) => node(item.anchorId, "section", item.label, [item.anchorId])),
      anchors,
      semantics: extractSourceSemantics({ sourceKind: "paper", anchors })
    });

    expect(graph.sourceUnits.map((unit) => unit.role)).toEqual(
      expect.arrayContaining(["problem", "method", "experiment", "limitation", "conclusion"])
    );
    expect(graph.concepts.map((concept) => concept.label)).toEqual(
      expect.arrayContaining(["研究问题", "方法结构", "证据边界", "局限条件", "迁移应用"])
    );
  });

  it("classifies patent claims, embodiments, background, and figures", () => {
    const anchors = [
      anchor("patent:bg", "背景技术", "背景技术 describes the prior art problem.", {
        kind: "heading",
        headingPath: ["背景技术"]
      }),
      anchor("patent:claim-1", "权利要求 1", "Claim 1 describes the technical solution.", {
        kind: "claim",
        claimNumber: "1"
      }),
      anchor("patent:embodiment", "实施例 1", "实施例 1 explains one embodiment.", {
        kind: "heading",
        headingPath: ["实施例 1"]
      }),
      anchor("patent:fig-1", "Figure 1", "Figure 1 shows the system.", {
        kind: "figure",
        figureNumber: "1"
      })
    ];
    const graph = buildSourceGraph({
      runId: "patent-run",
      sourceKind: "patent",
      structure: [
        node("patent:bg", "section", "背景技术", ["patent:bg"]),
        node("patent:claim-1", "claim", "权利要求 1", ["patent:claim-1"]),
        node("patent:embodiment", "section", "实施例 1", ["patent:embodiment"]),
        node("patent:fig-1", "figure", "Figure 1", ["patent:fig-1"])
      ],
      anchors,
      semantics: extractSourceSemantics({ sourceKind: "patent", anchors })
    });

    expect(graph.sourceUnits.map((unit) => unit.role)).toEqual(
      expect.arrayContaining(["background", "claim", "embodiment", "figure"])
    );
  });

  it("preserves blog heading hierarchy and argument-flow units", () => {
    const anchors = [
      anchor("blog:h1", "Agentic RAG Journey", "Agentic RAG Journey", {
        kind: "heading",
        headingPath: ["Agentic RAG Journey"]
      }),
      anchor("blog:h2-problem", "Why fixed RAG fails", "Why fixed RAG fails", {
        kind: "heading",
        headingPath: ["Agentic RAG Journey", "Why fixed RAG fails"]
      }),
      anchor("blog:h2-steps", "Implementation steps", "Implementation steps", {
        kind: "heading",
        headingPath: ["Agentic RAG Journey", "Implementation steps"]
      })
    ];
    const graph = buildSourceGraph({
      runId: "blog-run",
      sourceKind: "blog",
      structure: anchors.map((item) => node(item.anchorId, "section", item.label, [item.anchorId])),
      anchors,
      semantics: extractSourceSemantics({ sourceKind: "blog", anchors })
    });

    expect(graph.sourceUnits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "blog:h2-problem",
          role: "problem",
          headingPath: ["Agentic RAG Journey", "Why fixed RAG fails"]
        }),
        expect.objectContaining({
          id: "blog:h2-steps",
          role: "process",
          headingPath: ["Agentic RAG Journey", "Implementation steps"]
        })
      ])
    );
    expect(graph.coverage.anchorCount).toBe(3);
    expect(graph.coverage.sourceUnitCount).toBe(3);
    expect(graph.coverage.conceptCount).toBeGreaterThanOrEqual(5);
  });
});
