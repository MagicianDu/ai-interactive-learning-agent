import { describe, expect, test } from "vitest";

import { createRunConfigFromArgs, validateRunConfig } from "../run-config.js";
import type { RunConfig } from "../types.js";

function baseConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-corpus" });
  return { ...config, ...overrides };
}

describe("corpus run config", () => {
  test("maps topic shorthand into a one-item sources array", () => {
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-corpus" });

    expect(config.topic).toBe("哈希表");
    expect(config.sources).toEqual([
      {
        id: "source-001",
        type: "topic",
        kind: "unknown",
        title: "哈希表",
        value: "哈希表",
        language: "zh-CN"
      }
    ]);
    expect(config.userLearningProfile).toMatchObject({
      level: "basic",
      readingHabit: "visual_first",
      goal: "understand",
      preferredPageCountPerUnit: 8
    });
    expect(config.curriculumPlanningMode).toBe("hybrid");
    expect(config.coursePack).toMatchObject({
      strategy: "overview_plus_topic",
      includeOverview: true,
      preserveSourceMapping: true,
      unitPageCount: 8,
      outputProducts: ["web_lesson", "assessment"]
    });
    expect(config.coveragePolicy).toEqual({
      requiredCoverage: "core_concepts",
      allowOmission: true,
      omissionRules: ["topic-only runs may omit source coverage beyond generated concept anchors"]
    });
  });

  test("creates a source-grounded course-pack config from a local file source", () => {
    const config = createRunConfigFromArgs({
      sourceFile: "/tmp/Agentic_Design_Patterns.pdf",
      sourceKind: "book",
      sourceTitle: "Agentic Design Patterns",
      unitPages: "12",
      run: "agentic-design-book"
    });

    expect(config.topic).toBe("Agentic Design Patterns");
    expect(config.source).toEqual({
      type: "file",
      value: "/tmp/Agentic_Design_Patterns.pdf",
      label: "Agentic Design Patterns"
    });
    expect(config.sourceKind).toBe("book");
    expect(config.sources).toEqual([
      {
        id: "source-001",
        type: "file",
        kind: "book",
        title: "Agentic Design Patterns",
        value: "/tmp/Agentic_Design_Patterns.pdf",
        uri: "/tmp/Agentic_Design_Patterns.pdf",
        language: "zh-CN"
      }
    ]);
    expect(config.coursePack).toMatchObject({
      strategy: "overview_plus_topic",
      includeOverview: true,
      preserveSourceMapping: true,
      unitPageCount: 12
    });
    expect(config.coveragePolicy).toMatchObject({
      requiredCoverage: "goal_relevant"
    });
  });

  test("validates supported curriculum planning modes", () => {
    expect(() =>
      validateRunConfig(baseConfig({ curriculumPlanningMode: "random_walk" } as unknown as Partial<RunConfig>))
    ).toThrow(/curriculumPlanningMode/);
  });

  test("preserves topic-guided user constraints for course-pack planning", () => {
    const config = createRunConfigFromArgs({
      sourceUrl: "https://example.com/agentic-design-patterns",
      sourceKind: "blog",
      sourceTitle: "Agentic Design Patterns",
      planningMode: "topic_guided",
      strategy: "overview_plus_topic",
      unitPages: "10",
      units: "5",
      topics: "routing,tool use,memory",
      chapters: "part 1,part 2",
      run: "agentic-blog-course"
    });

    expect(config.curriculumPlanningMode).toBe("topic_guided");
    expect(config.coursePack).toMatchObject({
      strategy: "overview_plus_topic",
      preferredUnitCount: 5,
      selectedTopics: ["routing", "tool use", "memory"],
      selectedChapters: ["part 1", "part 2"]
    });
  });

  test("validates user learning profile fields", () => {
    expect(() =>
      validateRunConfig(
        baseConfig({
          userLearningProfile: {
            level: "novice",
            readingHabit: "visual_first",
            goal: "understand",
            preferredPageCountPerUnit: 8
          } as unknown as RunConfig["userLearningProfile"]
        })
      )
    ).toThrow(/userLearningProfile.level/);
  });

  test("validates non-empty sources", () => {
    expect(() =>
      validateRunConfig(
        baseConfig({
          sources: []
        })
      )
    ).toThrow(/sources/);
  });
});
