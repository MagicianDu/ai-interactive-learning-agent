import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";
import { ImagegenAssetBatchService } from "./imagegen-asset-batch-service.js";

export type ImagegenBatchItemStatus = "pending" | "succeeded" | "failed";

export type ImagegenBatchItem = {
  lessonId: string;
  pageId: string;
  imagePrompt: string;
  imageUrl: string;
  targetAssetPath: string;
  status: ImagegenBatchItemStatus;
  retryCount: number;
  failureReason?: string;
};

export type ImagegenBatchState = {
  runId: string;
  totalItems: number;
  items: ImagegenBatchItem[];
};

export type ImagegenBatchStateResult = {
  status: "batch_started" | "batch_in_progress" | "batch_complete";
  runId: string;
  totalItems: number;
  completedItems: number;
  pendingItems: ImagegenBatchItem[];
  failedItems: ImagegenBatchItem[];
  nextItem: ImagegenBatchItem | undefined;
  executionChecklist: string[];
  retrySummary: {
    failedCount: number;
    reasons: string[];
  };
  evidencePaths: string[];
  statePath: string;
};

export type RecordImagegenBatchItemInput =
  | {
      runId: string;
      lessonId: string;
      pageId: string;
      status: "succeeded";
      sourceImagePath: string;
    }
  | {
      runId: string;
      lessonId: string;
      pageId: string;
      status: "failed";
      failureReason: string;
    };

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

export class ImagegenBatchStateService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async start(input: { runId: string }): Promise<ImagegenBatchStateResult> {
    assertSafeRunId(input.runId);
    const manifest = await this.readManifest(input.runId);
    const state: ImagegenBatchState = {
      runId: input.runId,
      totalItems: manifest.length,
      items: manifest.map((item) => ({
        ...item,
        status: "pending",
        retryCount: 0
      }))
    };
    await this.writeState(state);
    return this.toResult(state, "batch_started");
  }

  async readOrStart(input: { runId: string }): Promise<ImagegenBatchStateResult> {
    assertSafeRunId(input.runId);
    try {
      const state = await this.readState(input.runId);
      return this.toResult(state, isBatchComplete(state) ? "batch_complete" : "batch_in_progress");
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") {
        return this.start(input);
      }
      throw error;
    }
  }

  async recordItem(input: RecordImagegenBatchItemInput): Promise<ImagegenBatchStateResult> {
    assertSafeRunId(input.runId);
    const state = await this.readState(input.runId);
    const item = state.items.find((candidate) => candidate.lessonId === input.lessonId && candidate.pageId === input.pageId);
    if (!item) {
      throw new AgentRuntimeError(`imagegen batch item not found: ${input.lessonId}:${input.pageId}`, "INVALID_RUN_CONFIG");
    }
    if (input.status === "failed") {
      item.status = "failed";
      item.retryCount += 1;
      item.failureReason = input.failureReason;
    } else {
      await new ImagegenAssetBatchService(this.workspaceRoot).recordAsset({
        runId: input.runId,
        lessonId: input.lessonId,
        pageId: input.pageId,
        sourceImagePath: input.sourceImagePath
      });
      item.status = "succeeded";
      item.failureReason = undefined;
    }
    await this.writeState(state);
    return this.toResult(state, isBatchComplete(state) ? "batch_complete" : "batch_in_progress");
  }

  private async readManifest(runId: string): Promise<Array<Omit<ImagegenBatchItem, "status" | "retryCount" | "failureReason">>> {
    const parsed = JSON.parse(await this.readOrCreateManifestText(runId)) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
      throw new AgentRuntimeError("imagegen manifest must include items", "INVALID_RUN_CONFIG");
    }
    return parsed.items.map((item) => {
      if (!isRecord(item)) {
        throw new AgentRuntimeError("imagegen manifest item must be an object", "INVALID_RUN_CONFIG");
      }
      return {
        lessonId: stringValue(item.lessonId, "lessonId"),
        pageId: stringValue(item.pageId, "pageId"),
        imagePrompt: stringValue(item.prompt ?? item.imagePrompt, "prompt"),
        imageUrl: stringValue(item.imageUrl, "imageUrl"),
        targetAssetPath: stringValue(item.targetAssetPath, "targetAssetPath")
      };
    });
  }

  private async readState(runId: string): Promise<ImagegenBatchState> {
    return JSON.parse(await readFile(this.statePath(runId), "utf8")) as ImagegenBatchState;
  }

  private async writeState(state: ImagegenBatchState): Promise<void> {
    await mkdir(path.dirname(this.statePath(state.runId)), { recursive: true });
    await writeFile(this.statePath(state.runId), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private toResult(state: ImagegenBatchState, status: ImagegenBatchStateResult["status"]): ImagegenBatchStateResult {
    const pendingItems = state.items.filter((item) => item.status !== "succeeded");
    const failedItems = state.items.filter((item) => item.status === "failed");
    const nextItem = failedItems[0] ?? pendingItems[0];
    return {
      status,
      runId: state.runId,
      totalItems: state.totalItems,
      completedItems: state.items.filter((item) => item.status === "succeeded").length,
      pendingItems,
      failedItems,
      nextItem,
      executionChecklist: buildExecutionChecklist(nextItem),
      retrySummary: {
        failedCount: failedItems.length,
        reasons: failedItems.map((item) => `${item.lessonId}/${item.pageId}: ${item.failureReason ?? "unknown failure"}`)
      },
      evidencePaths: [
        `runs/${state.runId}/quality/imagegen/imagegen-prompt-manifest.json`,
        `runs/${state.runId}/quality/imagegen/imagegen-batch-state.json`
      ],
      statePath: this.statePath(state.runId)
    };
  }

  private manifestPath(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId, "quality", "imagegen", "imagegen-prompt-manifest.json");
  }

  private async readOrCreateManifestText(runId: string): Promise<string> {
    try {
      return await readFile(this.manifestPath(runId), "utf8");
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") {
        await new ImagegenAssetBatchService(this.workspaceRoot).createManifest({ runId });
        return readFile(this.manifestPath(runId), "utf8");
      }
      throw error;
    }
  }

  private statePath(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId, "quality", "imagegen", "imagegen-batch-state.json");
  }
}

function isBatchComplete(state: ImagegenBatchState): boolean {
  return state.totalItems > 0 && state.items.every((item) => item.status === "succeeded");
}

function stringValue(value: unknown, name: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  throw new AgentRuntimeError(`imagegen manifest missing ${name}`, "INVALID_RUN_CONFIG");
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function buildExecutionChecklist(nextItem: ImagegenBatchItem | undefined): string[] {
  if (!nextItem) {
    return ["All imagegen items have been recorded. Run learning_agent.validate_imagegen_assets before layout smoke."];
  }
  return [
    `Call imagegen with the imagePrompt for ${nextItem.lessonId}/${nextItem.pageId}.`,
    "Save the generated PNG/WebP to a local temporary file.",
    "Call learning_agent.record_imagegen_batch_item with status=succeeded and sourceImagePath, or status=failed with a concrete failureReason.",
    "Do not reuse images across pages; regenerate if the image repeats the page title, bottom line, table, or UI panel."
  ];
}
