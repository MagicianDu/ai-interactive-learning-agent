import { describe, expect, test } from "vitest";

import { validateMcpProfileToolLists } from "./codex-mcp-tool-check";

const learnerTools = [
  "learning_agent.run_one_shot_learning_course",
  "learning_agent.list_learning_projects",
  "learning_agent.archive_learning_project",
  "learning_agent.publish_learning_course",
  "learning_agent.create_imagegen_manifest",
  "learning_agent.record_imagegen_asset",
  "learning_agent.validate_imagegen_assets",
  "learning_agent.start_imagegen_batch",
  "learning_agent.record_imagegen_batch_item",
  "learning_agent.get_learning_preview",
  "learning_agent.revise_learning_course",
  "learning_agent.apply_learning_revision",
  "learning_agent.export_learning_course"
];

describe("Codex MCP tool profile check", () => {
  test("accepts the one-shot learner default and explicit advanced profiles", () => {
    expect(() =>
      validateMcpProfileToolLists({
        learner: learnerTools,
        authoring: [
          "learning_agent.run_one_shot_learning_course",
          "learning_agent.prepare_learning_course",
          "learning_agent.publish_learning_course",
          "learning_agent.get_learning_preview",
          "learning_agent.create_learning_project",
          "learning_agent.get_authoring_context",
          "learning_agent.compare_authoring_quality",
          "learning_agent.create_quality_revision",
          "learning_agent.generate_grounded_course"
        ],
        operator: [
          "learning_agent.run_one_shot_learning_course",
          "learning_agent.prepare_learning_course",
          "learning_agent.plan_run",
          "learning_agent.beta_status",
          "learning_agent.read_artifact",
          "learning_agent.promote_units"
        ]
      })
    ).not.toThrow();
  });

  test("rejects advanced tools in the default learner profile", () => {
    expect(() =>
      validateMcpProfileToolLists({
        learner: [...learnerTools, "learning_agent.plan_run"],
        authoring: ["learning_agent.get_authoring_context", "learning_agent.compare_authoring_quality"],
        operator: ["learning_agent.plan_run", "learning_agent.beta_status"]
      })
    ).toThrow(/default learner MCP tool list should not expose advanced tools/u);
  });

  test("requires authoring and operator tools through explicit profiles", () => {
    expect(() =>
      validateMcpProfileToolLists({
        learner: learnerTools,
        authoring: ["learning_agent.run_one_shot_learning_course"],
        operator: ["learning_agent.run_one_shot_learning_course"]
      })
    ).toThrow(/authoring MCP tool list did not include expected tools/u);
  });
});
