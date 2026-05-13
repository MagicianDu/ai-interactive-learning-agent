import { describe, expect, it } from "vitest";

import type { SourceAnchor } from "../corpus-types.js";
import { sampleAuthoringAnchors } from "./source-anchor-sampler.js";

describe("sampleAuthoringAnchors", () => {
  it("skips book front matter when sampling long sources for authoring context", () => {
    const anchors = [
      anchor("source-001:page-1", "Page 1", "Agentic Design Patterns Table of Contents total 424 pages Dedication Acknowledgment Foreword"),
      anchor("source-001:page-3", "Page 3", "This book is about how to build intelligent tools, but it is dedicated to hope for the next generation."),
      anchor("source-001:page-4", "Page 4", "Acknowledgment thanks to reviewers and friends."),
      anchor("source-001:page-5", "Page 5", "A special thanks to pioneers of Software Agents and people focused on memory, learning, and agent systems."),
      anchor("source-001:page-10", "Page 10", "Preface: agentic systems evolve from reactive programs to autonomous systems."),
      anchor("source-001:page-11", "Page 11", "Agentic systems are characterized by autonomy, proactiveness, reactiveness, and social ability."),
      anchor("source-001:page-12", "Page 12", "The book is organized chapter by chapter, with each chapter explaining an agentic pattern."),
      anchor("source-001:page-14", "Page 14", "What makes an AI system an Agent? It perceives environment and takes actions to achieve a goal."),
      anchor("source-001:page-15", "Page 15", "Agentic AI operates via a five-step loop to accomplish tasks.")
    ];

    const sampled = sampleAuthoringAnchors({
      anchors,
      sourceKind: "book",
      maxAnchors: 4,
      selectedTopics: [],
      selectedChapters: [],
      topic: "Agentic Design Patterns"
    });

    const sampledIds = sampled.map((item) => item.anchorId);
    expect(sampledIds).toContain("source-001:page-10");
    expect(sampledIds).toContain("source-001:page-14");
    expect(sampledIds).not.toEqual(expect.arrayContaining(["source-001:page-1", "source-001:page-3", "source-001:page-4", "source-001:page-5"]));
  });

  it("prioritizes learner-selected topics before generic source anchors", () => {
    const anchors = [
      anchor("source-001:page-10", "Page 10", "Agentic systems overview and design patterns."),
      anchor("source-001:page-20", "Page 20", "Memory lets an agent maintain state across turns and recover context."),
      anchor("source-001:page-30", "Page 30", "Tool use connects reasoning to external APIs and actions."),
      anchor("source-001:page-40", "Page 40", "Multi-agent collaboration requires message passing and role boundaries.")
    ];

    const sampled = sampleAuthoringAnchors({
      anchors,
      sourceKind: "book",
      maxAnchors: 2,
      selectedTopics: ["tool use"],
      selectedChapters: [],
      topic: "Agentic Design Patterns"
    });

    expect(sampled[0]?.anchorId).toBe("source-001:page-30");
    expect(sampled).toHaveLength(2);
  });

  it("balances long book samples across chapter groups before filling by global score", () => {
    const anchors = [
      anchor("source-001:intro-1", "Intro 1", "Agentic patterns framework overview tool memory planning reflection."),
      anchor("source-001:intro-2", "Intro 2", "Agent systems architecture workflow tool use memory planning reflection."),
      anchor("source-001:c1", "Chapter 1: Prompt Chaining", "Prompt chaining breaks a complex task into sequential LLM steps."),
      anchor("source-001:c2", "Chapter 2: Routing", "Routing sends each request to the most suitable model or workflow."),
      anchor("source-001:c3", "Chapter 3: Parallelization", "Parallelization runs independent sub-tasks concurrently and merges results.")
    ];

    const sampled = sampleAuthoringAnchors({
      anchors,
      sourceKind: "book",
      maxAnchors: 3,
      selectedTopics: [],
      selectedChapters: [],
      topic: "Agentic Design Patterns",
      chapterAnchorGroups: [
        { title: "Chapter 1: Prompt Chaining", anchorIds: ["source-001:c1"] },
        { title: "Chapter 2: Routing", anchorIds: ["source-001:c2"] },
        { title: "Chapter 3: Parallelization", anchorIds: ["source-001:c3"] }
      ]
    });

    expect(sampled.map((item) => item.anchorId)).toEqual(["source-001:c1", "source-001:c2", "source-001:c3"]);
  });
});

function anchor(anchorId: string, label: string, quote: string): SourceAnchor {
  return {
    sourceId: "source-001",
    anchorId,
    label,
    locator: { kind: "page", page: Number(anchorId.match(/page-(\d+)/u)?.[1] ?? 1) },
    quote
  };
}
