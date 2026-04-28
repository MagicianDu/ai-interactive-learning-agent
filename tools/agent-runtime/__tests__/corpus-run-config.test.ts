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
    expect(config.coveragePolicy).toEqual({
      requiredCoverage: "core_concepts",
      allowOmission: true,
      omissionRules: ["topic-only runs may omit source coverage beyond generated concept anchors"]
    });
  });

  test("validates supported curriculum planning modes", () => {
    expect(() =>
      validateRunConfig(baseConfig({ curriculumPlanningMode: "random_walk" } as unknown as Partial<RunConfig>))
    ).toThrow(/curriculumPlanningMode/);
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
