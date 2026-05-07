type McpProfileToolLists = {
  learner: string[];
  authoring: string[];
  operator: string[];
};

const learnerRequiredTools = [
  "learning_agent.prepare_learning_course",
  "learning_agent.list_learning_projects",
  "learning_agent.archive_learning_project",
  "learning_agent.publish_learning_course",
  "learning_agent.get_learning_preview",
  "learning_agent.revise_learning_course",
  "learning_agent.apply_learning_revision",
  "learning_agent.export_learning_course"
];

const defaultForbiddenTools = [
  "learning_agent.create_learning_project",
  "learning_agent.get_authoring_context",
  "learning_agent.generate_grounded_course",
  "learning_agent.compare_authoring_quality",
  "learning_agent.create_quality_revision",
  "learning_agent.generate_quick_preview",
  "learning_agent.plan_run",
  "learning_agent.init_from_plan",
  "learning_agent.beta_status",
  "learning_agent.read_artifact",
  "learning_agent.approve_gate",
  "learning_agent.promote_units",
  "learning_agent.promote_lesson"
];

const authoringRequiredTools = [
  "learning_agent.create_learning_project",
  "learning_agent.get_authoring_context",
  "learning_agent.compare_authoring_quality",
  "learning_agent.create_quality_revision",
  "learning_agent.generate_grounded_course"
];

const operatorRequiredTools = [
  "learning_agent.plan_run",
  "learning_agent.beta_status",
  "learning_agent.read_artifact",
  "learning_agent.promote_units"
];

export function validateMcpProfileToolLists(toolLists: McpProfileToolLists): void {
  assertIncludesAll("default learner MCP tool list", toolLists.learner, learnerRequiredTools);

  const visibleAdvancedTools = defaultForbiddenTools.filter((tool) => toolLists.learner.includes(tool));
  if (visibleAdvancedTools.length > 0) {
    throw new Error(`default learner MCP tool list should not expose advanced tools: ${visibleAdvancedTools.join(", ")}`);
  }

  assertIncludesAll("authoring MCP tool list", toolLists.authoring, authoringRequiredTools);
  assertIncludesAll("operator MCP tool list", toolLists.operator, operatorRequiredTools);
}

function assertIncludesAll(label: string, actual: string[], expected: string[]): void {
  const missing = expected.filter((tool) => !actual.includes(tool));
  if (missing.length > 0) {
    throw new Error(`${label} did not include expected tools: ${missing.join(", ")}`);
  }
}
