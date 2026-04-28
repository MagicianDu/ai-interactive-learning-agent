import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "./errors.js";

export type ArtifactVersion = `v${number}`;

const ARTIFACT_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const ARTIFACT_VERSION_PATTERN = /^v[1-9][0-9]*$/;

export type ArtifactWriteResult = {
  artifactId: string;
  version: ArtifactVersion;
  path: string;
  draftPath: string;
};

export class ArtifactStore {
  private readonly artifactsPath: string;

  constructor(runPath: string) {
    this.artifactsPath = path.join(runPath, "artifacts");
  }

  async writeDraft(artifactId: string, payload: unknown): Promise<ArtifactWriteResult> {
    validateArtifactId(artifactId);

    await mkdir(this.artifactsPath, { recursive: true });

    const version = toArtifactVersion(await this.getNextVersion(artifactId));
    const versionPath = this.getVersionPath(artifactId, version);
    const draftPath = this.getDraftPath(artifactId);

    await writeJson(versionPath, payload);
    await writeJson(draftPath, payload);

    return {
      artifactId,
      version,
      path: versionPath,
      draftPath
    };
  }

  async readDraft<T>(artifactId: string): Promise<T> {
    validateArtifactId(artifactId);

    return this.readJson<T>(this.getDraftPath(artifactId), artifactId);
  }

  async readVersion<T>(artifactId: string, version: ArtifactVersion): Promise<T> {
    validateArtifactId(artifactId);
    validateArtifactVersion(version);

    return this.readJson<T>(this.getVersionPath(artifactId, version), artifactId);
  }

  async copyApprovedAlias(artifactId: string, version: ArtifactVersion): Promise<string> {
    validateArtifactId(artifactId);
    validateArtifactVersion(version);

    const sourcePath = this.getVersionPath(artifactId, version);
    const targetPath = this.getApprovedPath(artifactId);

    await mkdir(this.artifactsPath, { recursive: true });
    try {
      await copyFile(sourcePath, targetPath);
    } catch (error) {
      if (isFileNotFound(error)) {
        throw new AgentRuntimeError(`artifact version not found: ${artifactId}.${version}`, "MISSING_ARTIFACT");
      }
      throw error;
    }

    return targetPath;
  }

  private async getNextVersion(artifactId: string): Promise<number> {
    let entries: string[];
    try {
      entries = await readdir(this.artifactsPath);
    } catch (error) {
      if (isFileNotFound(error)) {
        return 1;
      }
      throw error;
    }

    const versionPattern = new RegExp(`^${escapeRegex(artifactId)}\\.v(\\d+)\\.json$`);
    const versions = entries
      .map((entry) => versionPattern.exec(entry)?.[1])
      .filter((version): version is string => version !== undefined)
      .map(Number);

    return versions.length === 0 ? 1 : Math.max(...versions) + 1;
  }

  private getDraftPath(artifactId: string): string {
    return path.join(this.artifactsPath, `${artifactId}.draft.json`);
  }

  private getApprovedPath(artifactId: string): string {
    return path.join(this.artifactsPath, `${artifactId}.approved.json`);
  }

  private getVersionPath(artifactId: string, version: ArtifactVersion): string {
    return path.join(this.artifactsPath, `${artifactId}.${version}.json`);
  }

  private async readJson<T>(filePath: string, artifactId: string): Promise<T> {
    try {
      return JSON.parse(await readFile(filePath, "utf8")) as T;
    } catch (error) {
      if (isFileNotFound(error)) {
        throw new AgentRuntimeError(`artifact not found: ${artifactId}`, "MISSING_ARTIFACT");
      }
      throw error;
    }
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toArtifactVersion(version: number): ArtifactVersion {
  return `v${version}`;
}

function validateArtifactId(artifactId: string): void {
  if (!ARTIFACT_ID_PATTERN.test(artifactId)) {
    throw new AgentRuntimeError("artifactId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function validateArtifactVersion(version: ArtifactVersion): void {
  if (!ARTIFACT_VERSION_PATTERN.test(version)) {
    throw new AgentRuntimeError("version must match /^v[1-9][0-9]*$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
