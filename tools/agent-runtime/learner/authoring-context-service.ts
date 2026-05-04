import { readFile } from "node:fs/promises";
import path from "node:path";

import type { SourceAnchor } from "../corpus-types.js";
import { AgentRuntimeError } from "../errors.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { normalizeSources } from "../source/source-normalizer.js";
import type { RunConfig } from "../types.js";
import { planCourseUnits } from "./course-unit-planner.js";
import { extractSourceSemantics } from "./source-semantic-extractor.js";

type LearnerProjectFile = {
  request?: string;
  brief?: {
    topic?: string;
    sourcePath?: string;
    sourceKind?: string;
    audience?: string;
    unitPages?: number;
    strategy?: string;
    selectedChapters?: string[];
    selectedTopics?: string[];
    language?: string;
  };
};

export type GetAuthoringContextInput = {
  runId: string;
  maxAnchors?: number;
};

export type AuthoringContextResult = {
  status: "authoring_context_ready";
  runId: string;
  brief: {
    topic: string;
    sourcePath?: string;
    sourceKind: string;
    audience: string;
    unitPages: number;
    strategy: string;
    selectedChapters: string[];
    selectedTopics: string[];
    language: "zh-CN";
  };
  source: {
    sourceKind: string;
    sourcePath?: string;
    anchorCount: number;
    warningCount: number;
    anchors: Array<{
      anchorId: string;
      label: string;
      locator: SourceAnchor["locator"];
      quote?: string;
      notes?: string;
    }>;
  };
  coursePlan: {
    strategy: string;
    unitPages: number;
    recommendedUnits: Array<{
      unitId: string;
      title: string;
      kind: string;
      lessonId: string;
      targetPageCount: number;
      sourceAnchorIds: string[];
      sourceAnchorCount: number;
      focusConcepts: string[];
      chapterRefs: string[];
    }>;
  };
  authoringContract: {
    defaultTool: "learning_agent.publish_learning_course";
    language: "zh-CN";
    requirements: string[];
  };
  codexInstruction: string;
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export class AuthoringContextService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async getContext(input: GetAuthoringContextInput): Promise<AuthoringContextResult> {
    assertSafeRunId(input.runId);
    const maxAnchors = input.maxAnchors ?? 40;
    if (!Number.isInteger(maxAnchors) || maxAnchors < 1 || maxAnchors > 200) {
      throw new AgentRuntimeError("maxAnchors must be an integer between 1 and 200", "INVALID_RUN_CONFIG");
    }

    const project = await readLearnerProject(this.workspaceRoot, input.runId);
    const config = buildRunConfig(input.runId, project);
    const normalizedSources = await normalizeSources(config.sources);
    const sourceAnchorIds = ensureAnchorIds(
      normalizedSources.anchors.map((anchor) => anchor.anchorId),
      config
    );
    const semantics = extractSourceSemantics({
      sourceKind: config.sourceKind ?? "topic",
      anchors: normalizedSources.anchors
    });
    const concepts = uniqueStrings([
      semantics.concepts[0]?.label ?? "全局地图",
      ...(config.coursePack?.selectedTopics ?? []),
      ...semantics.concepts.map((concept) => concept.label)
    ]);
    const sampledAnchorIds = sourceAnchorIds.slice(0, maxAnchors);
    const unitPlan = planCourseUnits({
      runId: config.runId,
      topic: config.topic,
      sourceKind: config.sourceKind ?? "topic",
      strategy: config.coursePack?.strategy ?? "overview_plus_topic",
      unitPageCount: config.coursePack?.unitPageCount ?? config.pageCount.target,
      selectedTopics: config.coursePack?.selectedTopics ?? [],
      selectedChapters: config.coursePack?.selectedChapters ?? [],
      concepts,
      sourceAnchorIds: sampledAnchorIds,
      sourceNodeIds: config.sources.map((source) => `${source.id}:root`)
    });

    const displaySourceKind = project.brief?.sourceKind === "topic" && !project.brief.sourcePath ? "topic" : (config.sourceKind ?? "topic");
    const brief = {
      topic: config.topic,
      ...(project.brief?.sourcePath ? { sourcePath: project.brief.sourcePath } : {}),
      sourceKind: displaySourceKind,
      audience: config.audience,
      unitPages: config.coursePack?.unitPageCount ?? config.pageCount.target,
      strategy: config.coursePack?.strategy ?? "overview_plus_topic",
      selectedChapters: config.coursePack?.selectedChapters ?? [],
      selectedTopics: config.coursePack?.selectedTopics ?? [],
      language: "zh-CN" as const
    };

    return {
      status: "authoring_context_ready",
      runId: input.runId,
      brief,
      source: {
        sourceKind: brief.sourceKind,
        ...(brief.sourcePath ? { sourcePath: brief.sourcePath } : {}),
        anchorCount: normalizedSources.anchors.length,
        warningCount: normalizedSources.extractionWarnings.length,
        anchors: normalizedSources.anchors.slice(0, maxAnchors).map((anchor) => ({
          anchorId: anchor.anchorId,
          label: anchor.label,
          locator: anchor.locator,
          ...(anchor.quote ? { quote: anchor.quote } : {}),
          ...(anchor.notes ? { notes: anchor.notes } : {})
        }))
      },
      coursePlan: {
        strategy: brief.strategy,
        unitPages: brief.unitPages,
        recommendedUnits: unitPlan.units.map((unit) => ({
          unitId: unit.unitId,
          title: unit.title,
          kind: unit.kind,
          lessonId: unit.lessonId,
          targetPageCount: unit.targetPageCount,
          sourceAnchorIds: unit.sourceAnchorIds,
          sourceAnchorCount: unit.sourceAnchorIds.length,
          focusConcepts: unit.focusConcepts,
          chapterRefs: unit.chapterRefs ?? []
        }))
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course",
        language: "zh-CN",
        requirements: [
          "请由 Codex 创作 coursePack 和 lessons，不要让 MCP deterministic generator 代写正式内容。",
          "每个 lesson 必须中文优先，并包含问题、视觉模型、学习动作、反馈、误区检查和迁移任务。",
          "每个 source-backed 页面必须包含 page.sourceAnchorIds，或显式标注 grounding.kind 为 inferred/analogy。",
          "教学页面应一页一学习目标；如果内容过多，请拆页而不是堆长段落。",
          "完成后调用 learning_agent.publish_learning_course，并用 learning_agent.get_learning_preview 返回网页。"
        ]
      },
      codexInstruction: buildCodexInstruction(brief, unitPlan.units.length)
    };
  }
}

function buildCodexInstruction(brief: AuthoringContextResult["brief"], unitCount: number): string {
  return [
    "请由 Codex 创作 coursePack 和 lessons，然后调用 learning_agent.publish_learning_course。",
    `输出语言：${brief.language}。`,
    `课程策略：${brief.strategy}。`,
    `每个单元页数：${brief.unitPages}。`,
    `建议单元数：${unitCount}。`,
    "不要把资料压缩成摘要；每个页面要围绕一个学习动作或心智模型推进。",
    "保留 sourceAnchorIds，并让反馈解释原因、机制和误区。"
  ].join("\n");
}

function buildRunConfig(runId: string, project: LearnerProjectFile): RunConfig {
  const brief = project.brief;
  const sourcePath = brief?.sourcePath;
  const isUrl = sourcePath ? /^https?:\/\//u.test(sourcePath) : false;
  const sourceLooksLikeFolder = sourcePath ? !isUrl && !/\.[a-z0-9]{1,8}$/iu.test(sourcePath) : false;

  return createRunConfigFromArgs({
    run: runId,
    topic: !sourcePath ? brief?.topic : undefined,
    sourceFile: sourcePath && !isUrl && !sourceLooksLikeFolder ? sourcePath : undefined,
    sourceFolder: sourcePath && sourceLooksLikeFolder ? sourcePath : undefined,
    sourceUrl: sourcePath && isUrl ? sourcePath : undefined,
    sourceKind: brief?.sourceKind === "topic" ? undefined : brief?.sourceKind,
    sourceTitle: sourcePath ? brief?.topic : undefined,
    unitPages: String(brief?.unitPages ?? 8),
    strategy: brief?.strategy,
    chapters: brief?.selectedChapters?.join(","),
    topics: brief?.selectedTopics?.join(","),
    audience: brief?.audience,
    language: brief?.language,
    adapter: "mock"
  });
}

function ensureAnchorIds(anchorIds: string[], config: RunConfig): string[] {
  if (anchorIds.length > 0) {
    return uniqueStrings(anchorIds);
  }
  const sourceId = config.sources[0]?.id ?? "source-001";
  return [`${sourceId}:root`];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function readLearnerProject(workspaceRoot: string, runId: string): Promise<LearnerProjectFile> {
  try {
    return JSON.parse(await readFile(path.join(workspaceRoot, "runs", runId, "learner-project.json"), "utf8")) as LearnerProjectFile;
  } catch (error) {
    if (isFileNotFound(error)) {
      throw new AgentRuntimeError("learner project not found; call create_learning_project first", "MISSING_ARTIFACT");
    }
    throw error;
  }
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
