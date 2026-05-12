import { describe, expect, test } from "vitest";

import { createRunConfigFromArgs, validateRunConfig } from "../run-config.js";
import type { RunConfig } from "../types.js";

function baseConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    runId: "database-index-001",
    topic: "数据库索引",
    source: { type: "topic", value: "数据库索引" },
    sources: [
      {
        id: "source-001",
        type: "topic",
        title: "数据库索引",
        value: "数据库索引",
        language: "zh-CN"
      }
    ],
    audience: "learners",
    userLearningProfile: {
      level: "basic",
      readingHabit: "visual_first",
      goal: "understand",
      preferredPageCountPerUnit: 10
    },
    curriculumPlanningMode: "hybrid",
    coveragePolicy: {
      requiredCoverage: "core_concepts",
      allowOmission: true,
      omissionRules: ["topic-only runs may omit source coverage beyond generated concept anchors"]
    },
    outputLanguage: "zh-CN",
    targetOutput: "web_deck",
    pageCount: { target: 10, min: 8, max: 12 },
    runtime: { adapter: "mock", mode: "interactive" },
    models: { defaultModel: { provider: "mock", model: "mock", temperature: 0.2 } },
    modelFallbackPolicy: "require_approval",
    approvalGates: ["source-map", "concept-map", "curriculum-plan", "learning-architecture", "lesson", "critic-report", "publish-package"],
    ...overrides
  };
}

describe("run config", () => {
  test("creates a Chinese-first run config from CLI args", () => {
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", targetTotalPages: "80" });

    expect(config.runId).toBe("hash-table-001");
    expect(config.topic).toBe("哈希表");
    expect(config.outputLanguage).toBe("zh-CN");
    expect(config.pageCount).toEqual({ target: 8, min: 6, max: 10 });
    expect(config.coursePack?.targetTotalPages).toBe(80);
    expect(config.runtime.adapter).toBe("mock");
  });

  test("supports natural-language entry aliases for Codex and Claude/OpenClaw", () => {
    const codexConfig = createRunConfigFromArgs({ topic: "哈希表", pages: "10", adapter: "codex" });
    const claudeConfig = createRunConfigFromArgs({ topic: "哈希表", pages: "10", adapter: "claude" });
    const openclawConfig = createRunConfigFromArgs({ topic: "哈希表", pages: "10", adapter: "openclaw" });

    expect(codexConfig.runtime.adapter).toBe("codex-manual");
    expect(codexConfig.models.defaultModel.provider).toBe("codex");
    expect(codexConfig.models.defaultModel.model).toBe("manual-codex-session");

    expect(claudeConfig.runtime.adapter).toBe("codex-manual");
    expect(claudeConfig.models.defaultModel.provider).toBe("claude");
    expect(claudeConfig.models.defaultModel.model).toBe("manual-claude-session");

    expect(openclawConfig.runtime.adapter).toBe("codex-manual");
    expect(openclawConfig.models.defaultModel.provider).toBe("openclaw");
    expect(openclawConfig.models.defaultModel.model).toBe("manual-openclaw-session");
  });

  test("rejects invalid page count", () => {
    expect(() =>
      createRunConfigFromArgs({
        topic: "哈希表",
        pages: "0",
        language: "zh-CN",
        adapter: "mock",
        run: undefined
      })
    ).toThrow(/pages must be between 1 and 40/);
  });

  test("rejects invalid course pack total page budget", () => {
    expect(() => createRunConfigFromArgs({ topic: "哈希表", pages: "8", targetTotalPages: "3" })).toThrow(
      /coursePack.targetTotalPages/
    );
    expect(() => createRunConfigFromArgs({ topic: "哈希表", pages: "8", targetTotalPages: "301" })).toThrow(
      /targetTotalPages/
    );
  });

  test("validates required run config fields", () => {
    expect(() =>
      validateRunConfig({
        runId: "bad",
        topic: "",
        sources: [
          {
            id: "source-001",
            type: "topic",
            title: "bad",
            value: "x",
            language: "zh-CN"
          }
        ],
        userLearningProfile: {
          level: "basic",
          readingHabit: "visual_first",
          goal: "understand",
          preferredPageCountPerUnit: 10
        },
        curriculumPlanningMode: "hybrid",
        coveragePolicy: {
          requiredCoverage: "core_concepts",
          allowOmission: true,
          omissionRules: []
        },
        source: { type: "topic", value: "x" },
        audience: "learners",
        outputLanguage: "zh-CN",
        targetOutput: "web_deck",
        pageCount: { target: 8, min: 6, max: 10 },
        runtime: { adapter: "mock", mode: "interactive" },
        models: { defaultModel: { provider: "mock", model: "mock", temperature: 0.2 } },
        modelFallbackPolicy: "require_approval",
        approvalGates: ["source-map", "concept-map", "curriculum-plan", "learning-architecture", "lesson", "critic-report", "publish-package"]
      })
    ).toThrow(/topic is required/);
  });

  test("creates distinct safe run ids for unknown Chinese topics with the same length", () => {
    const first = createRunConfigFromArgs({ topic: "机器学习" });
    const second = createRunConfigFromArgs({ topic: "深度学习" });

    expect(first.runId).not.toBe(second.runId);
    expect(first.runId).toMatch(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
    expect(second.runId).toMatch(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
  });

  test("rejects user provided run ids that are not path safe", () => {
    expect(() => createRunConfigFromArgs({ topic: "哈希表", run: "bad/run" })).toThrow(/runId must match/);
  });

  test("rejects invalid target output from a deserialized config object", () => {
    expect(() => validateRunConfig(baseConfig({ targetOutput: "pdf" } as unknown as Partial<RunConfig>))).toThrow(
      /targetOutput/
    );
  });

  test("rejects empty source values", () => {
    expect(() => validateRunConfig(baseConfig({ source: { type: "topic", value: " " } }))).toThrow(/source.value/);
  });

  test("rejects non-object mixed source items with a config error", () => {
    expect(() =>
      validateRunConfig(baseConfig({ source: { type: "mixed", items: [null] } as unknown as RunConfig["source"] }))
    ).toThrow(/source\.items|source/);
  });

  test("rejects invalid approval gates", () => {
    expect(() =>
      validateRunConfig(baseConfig({ approvalGates: ["learning-architecture", "export-pdf"] as RunConfig["approvalGates"] }))
    ).toThrow(/approvalGates/);
  });

  test("rejects empty default model provider", () => {
    expect(() =>
      validateRunConfig(baseConfig({ models: { defaultModel: { provider: " ", model: "mock" } } }))
    ).toThrow(/models.defaultModel.provider/);
  });

  test("rejects empty role model provider", () => {
    expect(() =>
      validateRunConfig(
        baseConfig({
          models: {
            defaultModel: { provider: "mock", model: "mock" },
            roleModels: { "lesson-critic": { provider: " ", model: "mock" } }
          }
        })
      )
    ).toThrow(/models.roleModels.lesson-critic.provider/);
  });

  test("rejects empty role model name", () => {
    expect(() =>
      validateRunConfig(
        baseConfig({
          models: {
            defaultModel: { provider: "mock", model: "mock" },
            roleModels: { "lesson-critic": { provider: "mock", model: " " } }
          }
        })
      )
    ).toThrow(/models.roleModels.lesson-critic.model/);
  });

  test("rejects invalid model fallback policy from a deserialized config object", () => {
    expect(() =>
      validateRunConfig(baseConfig({ modelFallbackPolicy: "fail_fast" } as unknown as Partial<RunConfig>))
    ).toThrow(/modelFallbackPolicy/);
  });

  test("rejects invalid page count bounds and ordering", () => {
    expect(() => validateRunConfig(baseConfig({ pageCount: { min: 0, target: 10, max: 12 } }))).toThrow(/pageCount/);
    expect(() => validateRunConfig(baseConfig({ pageCount: { min: 8, target: 13, max: 12 } }))).toThrow(/pageCount/);
  });
});
