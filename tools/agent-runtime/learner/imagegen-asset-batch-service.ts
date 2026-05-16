import { access, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";

export type CreateImagegenManifestInput = {
  runId: string;
};

export type RecordImagegenAssetInput = {
  runId: string;
  lessonId: string;
  pageId: string;
  sourceImagePath: string;
};

export type ValidateImagegenAssetsInput = {
  runId: string;
};

export type ImagegenManifestItem = {
  lessonId: string;
  pageId: string;
  pageTitle: string;
  prompt: string;
  imageAlt: string;
  targetAssetPath: string;
  imageUrl: string;
  status: "ready" | "missing_asset" | "invalid_prompt";
};

export type ImagegenManifest = {
  runId: string;
  createdAt: string;
  items: ImagegenManifestItem[];
};

export type CreateImagegenManifestResult = {
  status: "manifest_ready";
  runId: string;
  requiredImageCount: number;
  manifestPath: string;
};

export type RecordImagegenAssetResult = {
  status: "asset_recorded";
  runId: string;
  lessonId: string;
  pageId: string;
  imageUrl: string;
  assetPath: string;
  manifestPath: string;
};

export type ImagegenAssetValidationIssue = {
  issueId:
    | "imagegen.asset.file-missing"
    | "imagegen.asset.svg-reference"
    | "imagegen.asset.provider-missing"
    | "imagegen.asset.prompt-unsafe"
    | "imagegen.asset.prompt-guard-missing"
    | "imagegen.asset.prompt-duplicates-page-text"
    | "imagegen.asset.url-not-preview"
    | "imagegen.asset.visual-spec-missing";
  lessonId: string;
  pageId: string;
  reason: string;
  requiredFix: string;
};

export type ValidateImagegenAssetsResult = {
  status: "passed" | "failed";
  runId: string;
  checkedPageCount: number;
  issues: ImagegenAssetValidationIssue[];
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,127}$/u;

export class ImagegenAssetBatchService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async createManifest(input: CreateImagegenManifestInput): Promise<CreateImagegenManifestResult> {
    assertSafeRunId(input.runId);
    const lessons = await this.readLessons(input.runId);
    const items = lessons.flatMap(({ lessonId, lesson }) =>
      lesson.pages.map((page) => this.buildManifestItem(input.runId, lessonId, page))
    );
    const manifestPath = await this.writeManifest(input.runId, {
      runId: input.runId,
      createdAt: new Date().toISOString(),
      items
    });
    return {
      status: "manifest_ready",
      runId: input.runId,
      requiredImageCount: items.length,
      manifestPath
    };
  }

  async recordAsset(input: RecordImagegenAssetInput): Promise<RecordImagegenAssetResult> {
    assertSafeRunId(input.runId);
    assertSafeId(input.lessonId, "lessonId");
    assertSafeId(input.pageId, "pageId");
    const manifest = await this.readOrCreateManifest(input.runId);
    const item = manifest.items.find((candidate) => candidate.lessonId === input.lessonId && candidate.pageId === input.pageId);
    if (!item) {
      throw new AgentRuntimeError(`manifest item not found for ${input.lessonId}/${input.pageId}`, "MISSING_ARTIFACT");
    }

    await mkdir(path.dirname(item.targetAssetPath), { recursive: true });
    await copyFile(input.sourceImagePath, item.targetAssetPath);
    await this.updateLessonVisualSpec(input.runId, item);

    const updatedManifest: ImagegenManifest = {
      ...manifest,
      items: manifest.items.map((candidate) =>
        candidate.lessonId === item.lessonId && candidate.pageId === item.pageId ? { ...candidate, status: "ready" } : candidate
      )
    };
    const manifestPath = await this.writeManifest(input.runId, updatedManifest);
    return {
      status: "asset_recorded",
      runId: input.runId,
      lessonId: input.lessonId,
      pageId: input.pageId,
      imageUrl: item.imageUrl,
      assetPath: item.targetAssetPath,
      manifestPath
    };
  }

  async validateAssets(input: ValidateImagegenAssetsInput): Promise<ValidateImagegenAssetsResult> {
    assertSafeRunId(input.runId);
    const lessons = await this.readLessons(input.runId);
    const issues: ImagegenAssetValidationIssue[] = [];
    let checkedPageCount = 0;

    for (const { lessonId, lesson } of lessons) {
      for (const page of lesson.pages) {
        const visualSpec = isRecord(page.visualSpec) ? page.visualSpec : undefined;
        const shouldRequireImage = lesson.displayMode === "textbook_deck" || visualSpec !== undefined;
        if (!shouldRequireImage) {
          continue;
        }
        checkedPageCount += 1;
        const pageId = stringValue(page.id) ?? "unknown-page";
        if (!visualSpec) {
          issues.push({
            issueId: "imagegen.asset.visual-spec-missing",
            lessonId,
            pageId,
            reason: "Textbook deck pages must include visualSpec for an imagegen teaching illustration.",
            requiredFix: "Add visualSpec with imageUrl, imageAlt, imageProvider: \"imagegen\", and imagePrompt."
          });
          continue;
        }
        issues.push(...(await this.validateVisualSpec(input.runId, lessonId, pageId, page, visualSpec)));
      }
    }

    return {
      status: issues.length > 0 ? "failed" : "passed",
      runId: input.runId,
      checkedPageCount,
      issues
    };
  }

  private buildManifestItem(runId: string, lessonId: string, page: Record<string, unknown>): ImagegenManifestItem {
    const pageId = stringValue(page.id);
    if (!pageId) {
      throw new AgentRuntimeError(`lesson ${lessonId} contains a page without id`, "INVALID_LESSON");
    }
    assertSafeId(lessonId, "lessonId");
    assertSafeId(pageId, "pageId");
    const pageTitle = stringValue(page.title) ?? pageId;
    const visualSpec = isRecord(page.visualSpec) ? page.visualSpec : {};
    const imageAlt = stringValue(visualSpec.imageAlt) ?? buildImageAlt(page);
    const prompt = defaultPrompt(sanitizePromptInput(imageAlt, pageTitle, bottomLineForPage(page)));
    const imageUrl = `/__learning-preview/${runId}/images/${lessonId}/${pageId}-imagegen-v1.png`;
    return {
      lessonId,
      pageId,
      pageTitle,
      prompt,
      imageAlt,
      targetAssetPath: path.join(this.previewRoot(runId), "images", lessonId, `${pageId}-imagegen-v1.png`),
      imageUrl,
      status: "missing_asset"
    };
  }

  private async validateVisualSpec(
    runId: string,
    lessonId: string,
    pageId: string,
    page: Record<string, unknown>,
    visualSpec: Record<string, unknown>
  ): Promise<ImagegenAssetValidationIssue[]> {
    const issues: ImagegenAssetValidationIssue[] = [];
    const imageUrl = stringValue(visualSpec.imageUrl) ?? "";
    const imagePrompt = stringValue(visualSpec.imagePrompt) ?? "";
    const imageProvider = stringValue(visualSpec.imageProvider);

    if (imageUrl.toLowerCase().endsWith(".svg")) {
      issues.push({
        issueId: "imagegen.asset.svg-reference",
        lessonId,
        pageId,
        reason: "The page still references an SVG placeholder instead of an imagegen PNG/WebP asset.",
        requiredFix: "Generate a PNG/WebP teaching illustration with imagegen and record it through learning_agent.record_imagegen_asset."
      });
    }

    if (imageProvider !== "imagegen") {
      issues.push({
        issueId: "imagegen.asset.provider-missing",
        lessonId,
        pageId,
        reason: "The visualSpec does not declare imageProvider: \"imagegen\".",
        requiredFix: "Set visualSpec.imageProvider to \"imagegen\" after recording a generated image asset."
      });
    }

    const previewPath = imageUrlToPreviewPath(this.previewRoot(runId), runId, imageUrl);
    if (!previewPath) {
      issues.push({
        issueId: "imagegen.asset.url-not-preview",
        lessonId,
        pageId,
        reason: "The imageUrl does not point to the run preview asset directory.",
        requiredFix: "Record the image through learning_agent.record_imagegen_asset so the imageUrl uses /__learning-preview/<runId>/..."
      });
    } else if (!(await pathExists(previewPath))) {
      issues.push({
        issueId: "imagegen.asset.file-missing",
        lessonId,
        pageId,
        reason: "The preview imageUrl is declared, but the corresponding image file does not exist.",
        requiredFix: "Generate the image with imagegen and record the local file path through learning_agent.record_imagegen_asset."
      });
    }

    const promptIssue = validateImagePromptSafety(imagePrompt);
    if (promptIssue) {
      issues.push({
        issueId: promptIssue.issueId,
        lessonId,
        pageId,
        reason: promptIssue.reason,
        requiredFix: promptIssue.requiredFix
      });
    }

    const duplicatedPromptText = duplicatedLearnerTextInPrompt(imagePrompt, page);
    if (duplicatedPromptText) {
      issues.push({
        issueId: "imagegen.asset.prompt-duplicates-page-text",
        lessonId,
        pageId,
        reason: `The imagegen prompt repeats learner-facing page text: ${duplicatedPromptText}.`,
        requiredFix: "Rewrite the prompt to describe the visual mechanism with short labels instead of copying the page title or bottom-line sentence."
      });
    }

    return issues;
  }

  private async updateLessonVisualSpec(runId: string, item: ImagegenManifestItem): Promise<void> {
    const lessonPath = path.join(this.previewRoot(runId), "lessons", `${item.lessonId}.json`);
    const lesson = JSON.parse(await readFile(lessonPath, "utf8")) as unknown;
    if (!isRecord(lesson) || !Array.isArray(lesson.pages)) {
      throw new AgentRuntimeError(`invalid lesson JSON: ${lessonPath}`, "INVALID_LESSON");
    }
    const pages = lesson.pages.map((page) => {
      if (!isRecord(page) || page.id !== item.pageId) {
        return page;
      }
      const visualSpec = isRecord(page.visualSpec) ? page.visualSpec : {};
      return {
        ...page,
        visualSpec: {
          ...visualSpec,
          kind: stringValue(visualSpec.kind) ?? "diagram",
          description: stringValue(visualSpec.description) ?? item.pageTitle,
          keyElements: Array.isArray(visualSpec.keyElements) ? visualSpec.keyElements : [item.pageTitle],
          imageUrl: item.imageUrl,
          imageAlt: item.imageAlt,
          imageProvider: "imagegen",
          imagePrompt: item.prompt
        }
      };
    });
    await writeFile(lessonPath, `${JSON.stringify({ ...lesson, pages }, null, 2)}\n`, "utf8");
  }

  private async readOrCreateManifest(runId: string): Promise<ImagegenManifest> {
    const manifestPath = this.manifestPath(runId);
    const existing = await readFile(manifestPath, "utf8").catch(async (error: unknown) => {
      if (isFileNotFound(error)) {
        await this.createManifest({ runId });
        return readFile(manifestPath, "utf8");
      }
      throw error;
    });
    return JSON.parse(existing) as ImagegenManifest;
  }

  private async writeManifest(runId: string, manifest: ImagegenManifest): Promise<string> {
    const manifestPath = this.manifestPath(runId);
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifestPath;
  }

  private async readLessons(runId: string): Promise<Array<{ lessonId: string; lesson: PreviewLesson }>> {
    const lessonsDir = path.join(this.previewRoot(runId), "lessons");
    const lessonFiles = (await readdir(lessonsDir)).filter((entry) => entry.endsWith(".json")).sort();
    return Promise.all(
      lessonFiles.map(async (lessonFile) => {
        const lesson = JSON.parse(await readFile(path.join(lessonsDir, lessonFile), "utf8")) as unknown;
        if (!isPreviewLesson(lesson)) {
          throw new AgentRuntimeError(`invalid preview lesson JSON: ${lessonFile}`, "INVALID_LESSON");
        }
        return { lessonId: lesson.id, lesson };
      })
    );
  }

  private runRoot(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId);
  }

  private previewRoot(runId: string): string {
    return path.join(this.runRoot(runId), "preview");
  }

  private manifestPath(runId: string): string {
    return path.join(this.runRoot(runId), "quality", "imagegen", "imagegen-prompt-manifest.json");
  }
}

type PreviewLesson = {
  id: string;
  displayMode?: string;
  pages: Array<Record<string, unknown>>;
};

function isPreviewLesson(value: unknown): value is PreviewLesson {
  return isRecord(value) && typeof value.id === "string" && Array.isArray(value.pages);
}

function defaultPrompt(imageAlt: string): string {
  return `生成一张中文 Web Deck 教学插图，画出这一页的核心知识关系：${imageAlt}。可以使用短标签、方向词或局部标注帮助理解；不要包含长段落文字、表格或 UI 文本框；不要重复页面标题；不要重复底部总结；不要重复页面卡片原文。`;
}

function buildImageAlt(page: Record<string, unknown>): string {
  const board = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  const coreProposition = board ? stringValue(board.coreProposition) : undefined;
  return coreProposition ?? "解释本页的关键知识关系";
}

function bottomLineForPage(page: Record<string, unknown>): string | undefined {
  const board = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  return board ? stringValue(board.bottomLine) : undefined;
}

function sanitizePromptInput(value: string, pageTitle: string, bottomLine: string | undefined): string {
  return [pageTitle, bottomLine].filter((text): text is string => Boolean(text)).reduce((result, text) => result.replaceAll(text, ""), value).trim();
}

function imageUrlToPreviewPath(previewRoot: string, runId: string, imageUrl: string): string | undefined {
  const prefix = `/__learning-preview/${runId}/`;
  if (!imageUrl.startsWith(prefix)) {
    return undefined;
  }
  const relativePath = imageUrl.slice(prefix.length);
  if (relativePath.includes("..")) {
    return undefined;
  }
  return path.join(previewRoot, relativePath);
}

type ImagePromptSafetyIssue = {
  issueId: "imagegen.asset.prompt-unsafe" | "imagegen.asset.prompt-guard-missing";
  reason: string;
  requiredFix: string;
};

const negationPattern = /(不要|不能|不得|禁止|避免|不包含|不要包含|不使用|不得包含|无)\s*/iu;
const unsafeAllowPattern =
  /(可以|允许|可包含|包含|使用|加入|呈现|展示|生成|渲染)[^。；;,.，、]{0,18}(大段文字|长段落|长篇文字|段落解释|表格|table|UI\s*文本框|UI\s*面板|用户界面|文本框|text\s*panel|text\s*box|bullet\s*list|项目符号)/iu;

const requiredImagePromptGuards: Array<{ label: string; pattern: RegExp }> = [
  { label: "长段落或大段文字", pattern: /(长段落|大段文字|长篇文字|long\s*prose|paragraph)/iu },
  { label: "表格", pattern: /(表格|table)/iu },
  { label: "UI 文本框或面板", pattern: /(UI\s*文本框|UI\s*面板|用户界面|文本框|text\s*panel|text\s*box)/iu },
  { label: "页面标题", pattern: /(页面标题|page\s*title)/iu },
  { label: "底部总结", pattern: /(底部总结|bottom\s*line|bottomLine)/iu }
];

function validateImagePromptSafety(prompt: string): ImagePromptSafetyIssue | undefined {
  if (allowsUnsafeImageArtifact(prompt)) {
    return {
      issueId: "imagegen.asset.prompt-unsafe",
      reason: "The imagegen prompt permits text-heavy artifacts such as long prose, tables, or UI text panels.",
      requiredFix: "Revise the prompt so it forbids long prose, tables, UI panels, page-title duplication, and card-text duplication."
    };
  }

  const missingGuards = requiredImagePromptGuards
    .filter((guard) => !hasNegatedPromptGuard(prompt, guard.pattern))
    .map((guard) => guard.label);

  if (missingGuards.length > 0) {
    return {
      issueId: "imagegen.asset.prompt-guard-missing",
      reason: `The imagegen prompt does not explicitly guard against: ${missingGuards.join("、")}.`,
      requiredFix: "在 imagePrompt 中明确写入：不要包含长段落文字、表格或 UI 文本框；图片应以知识点讲解为主，只保留必要短标签。"
    };
  }

  return undefined;
}

function hasNegatedPromptGuard(prompt: string, topicPattern: RegExp): boolean {
  return prompt
    .split(/[。；;.!！?？\n]/u)
    .some((clause) => negationPattern.test(clause) && topicPattern.test(clause));
}

function allowsUnsafeImageArtifact(prompt: string): boolean {
  return prompt
    .split(/[。；;.!！?？\n]/u)
    .some((clause) => unsafeAllowPattern.test(clause) && !negationPattern.test(clause));
}

function duplicatedLearnerTextInPrompt(prompt: string, page: Record<string, unknown>): string | undefined {
  const pageTitle = stringValue(page.title);
  const bottomLine = bottomLineForPage(page);
  if (pageTitle && containsLearnerText(prompt, pageTitle)) {
    return "page title";
  }
  if (bottomLine && containsLearnerText(prompt, bottomLine)) {
    return "bottom line";
  }
  return undefined;
}

function containsLearnerText(prompt: string, learnerText: string): boolean {
  const normalizedPrompt = normalizeForDuplication(prompt);
  const normalizedText = normalizeForDuplication(learnerText);
  return normalizedText.length >= 6 && normalizedPrompt.includes(normalizedText);
}

function normalizeForDuplication(value: string): string {
  return value.normalize("NFKC").replace(/[\s，。；：、,.!?！？:;'"“”‘’()[\]（）【】《》<>]/gu, "").toLocaleLowerCase();
}

async function pathExists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function assertSafeId(value: string, name: string): void {
  if (!ID_PATTERN.test(value)) {
    throw new AgentRuntimeError(`${name} must be a safe identifier`, "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
