export const learningAgentMcpServerName = "learningAgent";

export function buildLearningAgentMcpToml(projectRoot: string): string {
  return [
    `[mcp_servers.${learningAgentMcpServerName}]`,
    'command = "npm"',
    'args = ["run", "mcp"]',
    `cwd = "${escapeTomlString(projectRoot)}"`,
    ""
  ].join("\n");
}

export function upsertLearningAgentMcpServer(existingConfig: string, projectRoot: string): string {
  const withoutExistingServer = removeLearningAgentMcpServer(existingConfig);
  const base = withoutExistingServer.trimEnd();
  const separator = base.length > 0 ? "\n\n" : "";

  return `${base}${separator}${buildLearningAgentMcpToml(projectRoot)}`;
}

export function hasLearningAgentMcpServer(existingConfig: string, projectRoot: string): boolean {
  return (
    existingConfig.includes(`[mcp_servers.${learningAgentMcpServerName}]`) &&
    existingConfig.includes('command = "npm"') &&
    existingConfig.includes('args = ["run", "mcp"]') &&
    existingConfig.includes(`cwd = "${escapeTomlString(projectRoot)}"`)
  );
}

function removeLearningAgentMcpServer(config: string): string {
  const lines = config.replace(/\r\n/g, "\n").split("\n");
  const keptLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (!isLearningAgentMcpHeader(line)) {
      keptLines.push(line);
      continue;
    }

    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      if (isTableHeader(nextLine) && !isLearningAgentMcpHeader(nextLine)) {
        index -= 1;
        break;
      }
      index += 1;
    }
  }

  return keptLines.join("\n");
}

function isTableHeader(line: string): boolean {
  return /^\s*\[[^\]]+\]\s*$/.test(line);
}

function isLearningAgentMcpHeader(line: string): boolean {
  return new RegExp(`^\\s*\\[mcp_servers\\.${learningAgentMcpServerName}(?:\\.[^\\]]+)?\\]\\s*$`).test(line);
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
