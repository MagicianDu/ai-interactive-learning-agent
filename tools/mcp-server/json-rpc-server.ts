import { learningAgentToolContractsForProfile, type LearningAgentToolProfile } from "./tool-contracts.js";
import type { LearningAgentRuntimeTools } from "./runtime-tools.js";

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

export type JsonRpcResponse =
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      error: {
        code: number;
        message: string;
      };
    };

const serverInfo = {
  name: "ai-interactive-learning-agent",
  version: "0.1.0"
};

export async function handleMcpRequest(
  request: JsonRpcRequest,
  tools: LearningAgentRuntimeTools,
  profile: LearningAgentToolProfile = "learner"
): Promise<JsonRpcResponse | undefined> {
  if (request.method?.startsWith("notifications/")) {
    return undefined;
  }

  const id = request.id ?? null;

  try {
    switch (request.method) {
      case "initialize":
        return result(id, {
          protocolVersion: requestedProtocolVersion(request.params),
          capabilities: {
            tools: {}
          },
          serverInfo
        });
      case "ping":
        return result(id, {});
      case "tools/list":
        return result(id, { tools: learningAgentToolContractsForProfile(profile) });
      case "tools/call":
        return result(id, await callTool(request.params, tools));
      default:
        return error(id, -32601, `method not found: ${request.method ?? "<missing>"}`);
    }
  } catch (caught) {
    return error(id, -32000, caught instanceof Error ? caught.message : String(caught));
  }
}

export async function handleMcpLine(
  line: string,
  tools: LearningAgentRuntimeTools,
  profile: LearningAgentToolProfile = "learner"
): Promise<string | undefined> {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isLegacyToolRequest(parsed)) {
      const legacyResult = await tools.callTool(String(parsed.tool), parsed.input ?? {});
      return JSON.stringify({ id: parsed.id, result: legacyResult });
    }

    const response = await handleMcpRequest(expectRecord(parsed, "JSON-RPC request") as JsonRpcRequest, tools, profile);
    return response ? JSON.stringify(response) : undefined;
  } catch (caught) {
    return JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: caught instanceof Error ? caught.message : String(caught)
      }
    });
  }
}

async function callTool(params: unknown, tools: LearningAgentRuntimeTools): Promise<unknown> {
  const options = expectRecord(params, "tools/call params");
  const toolName = requiredString(options, "name");
  const input = options.arguments === undefined ? {} : options.arguments;
  const output = await tools.callTool(toolName, input);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(output, null, 2)
      }
    ]
  };
}

function requestedProtocolVersion(params: unknown): string {
  if (!isRecord(params)) {
    return "2024-11-05";
  }
  return typeof params.protocolVersion === "string" && params.protocolVersion.trim().length > 0
    ? params.protocolVersion
    : "2024-11-05";
}

function result(id: JsonRpcId, value: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: value
  };
}

function error(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLegacyToolRequest(value: unknown): value is { id?: JsonRpcId; tool: string; input?: unknown } {
  return isRecord(value) && typeof value.tool === "string" && value.tool.trim().length > 0;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}
