import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeCourseIntent, type CourseIntent } from "./course-intent.js";

export type LearningProjectStatus =
  | "draft"
  | "generating"
  | "preview-ready"
  | "failed"
  | "revised"
  | "published"
  | "exported"
  | "archived";

export type LearningProjectRecord = {
  projectId: string;
  title: string;
  sourceKind: string;
  sourceRefs: string[];
  audience?: string;
  difficultyLevel?: string;
  language: "zh-CN";
  strategy: string;
  unitPageCount: number;
  targetTotalPages?: number;
  selectedChapters?: string[];
  selectedTopics?: string[];
  courseIntent?: CourseIntent;
  status: LearningProjectStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type LearningProjectListItem = LearningProjectRecord & {
  preview?: {
    courseTitle?: string;
    lessonCount?: number;
  };
};

type LearnerProjectManifest = Record<string, unknown> & {
  project?: Record<string, unknown>;
  brief?: Record<string, unknown>;
};

const projectStatuses = new Set<LearningProjectStatus>([
  "draft",
  "generating",
  "preview-ready",
  "failed",
  "revised",
  "published",
  "exported",
  "archived"
]);

export class ProjectRegistry {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async upsertProject(project: LearningProjectRecord): Promise<LearningProjectRecord> {
    const now = new Date().toISOString();
    const current: LearnerProjectManifest = await this.readManifest(project.projectId).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return { runId: project.projectId };
      }
      throw error;
    });
    const existing = current.project ? normalizeProject(current.project, project.projectId) : undefined;
    const normalized: LearningProjectRecord = {
      ...project,
      projectId: project.projectId,
      createdAt: existing?.createdAt ?? project.createdAt ?? now,
      updatedAt: now
    };
    const runDir = this.runDir(project.projectId);
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "learner-project.json"),
      `${JSON.stringify({ ...current, runId: project.projectId, project: normalized }, null, 2)}\n`,
      "utf8"
    );
    return normalized;
  }

  async readProject(projectId: string): Promise<LearningProjectRecord> {
    const manifest = await this.readManifest(projectId);
    if (manifest.project) {
      return normalizeProject(manifest.project, projectId);
    }

    const brief = manifest.brief ?? {};
    const sourcePath = optionalString(brief.sourcePath);
    return {
      projectId,
      title: optionalString(brief.topic) ?? projectId,
      sourceKind: optionalString(brief.sourceKind) ?? "topic",
      sourceRefs: sourcePath ? [sourcePath] : [],
      audience: optionalString(brief.audience),
      difficultyLevel: optionalString(brief.difficultyLevel),
      language: "zh-CN",
      strategy: optionalString(brief.strategy) ?? "overview_plus_topic",
      unitPageCount: optionalNumber(brief.unitPages) ?? 8,
      targetTotalPages: optionalNumber(brief.targetTotalPages),
      selectedChapters: optionalStringArray(brief.selectedChapters),
      selectedTopics: optionalStringArray(brief.selectedTopics),
      courseIntent: normalizeCourseIntent(brief.courseIntent),
      status: "draft"
    };
  }

  async listProjects(): Promise<LearningProjectListItem[]> {
    const runsDir = path.join(this.workspaceRoot, "runs");
    const entries = await readdir(runsDir, { withFileTypes: true }).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return [];
      }
      throw error;
    });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const project = await this.readProject(entry.name).catch((error: unknown) => {
            if (isFileNotFound(error)) {
              return undefined;
            }
            throw error;
          });
          if (!project) {
            return undefined;
          }

          const preview = await this.readPreview(entry.name);
          return {
            ...project,
            status: preview && project.status !== "archived" ? "preview-ready" : project.status,
            ...(preview ? { preview } : {})
          } satisfies LearningProjectListItem;
        })
    );

    return projects
      .filter((project): project is LearningProjectListItem => Boolean(project))
      .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
  }

  async archiveProject(projectId: string): Promise<LearningProjectRecord> {
    const project = await this.readProject(projectId);
    return this.upsertProject({ ...project, status: "archived" });
  }

  private async readPreview(projectId: string): Promise<LearningProjectListItem["preview"] | undefined> {
    const manifest = await readJson(path.join(this.runDir(projectId), "learning-preview.json")).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return undefined;
      }
      throw error;
    });
    if (!manifest) {
      return undefined;
    }
    return {
      courseTitle: optionalString(manifest.courseTitle),
      lessonCount: optionalNumber(manifest.lessonCount)
    };
  }

  private async readManifest(projectId: string): Promise<LearnerProjectManifest> {
    return readJson(path.join(this.runDir(projectId), "learner-project.json"));
  }

  private runDir(projectId: string): string {
    return path.join(this.workspaceRoot, "runs", projectId);
  }
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed;
}

function normalizeProject(value: Record<string, unknown>, projectId: string): LearningProjectRecord {
  return {
    projectId: optionalString(value.projectId) ?? projectId,
    title: optionalString(value.title) ?? projectId,
    sourceKind: optionalString(value.sourceKind) ?? "topic",
    sourceRefs: optionalStringArray(value.sourceRefs) ?? [],
    audience: optionalString(value.audience),
    difficultyLevel: optionalString(value.difficultyLevel),
    language: "zh-CN",
    strategy: optionalString(value.strategy) ?? "overview_plus_topic",
    unitPageCount: optionalNumber(value.unitPageCount) ?? 8,
    targetTotalPages: optionalNumber(value.targetTotalPages),
    selectedChapters: optionalStringArray(value.selectedChapters),
    selectedTopics: optionalStringArray(value.selectedTopics),
    courseIntent: normalizeCourseIntent(value.courseIntent),
    status: normalizeStatus(value.status),
    createdAt: optionalString(value.createdAt),
    updatedAt: optionalString(value.updatedAt)
  };
}

function normalizeStatus(value: unknown): LearningProjectStatus {
  return typeof value === "string" && projectStatuses.has(value as LearningProjectStatus) ? (value as LearningProjectStatus) : "draft";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
