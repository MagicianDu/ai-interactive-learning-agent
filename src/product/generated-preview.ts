import type { CoursePackRegistryEntry } from "../course-packs/registry";
import type { LessonRegistryEntry } from "../lessons/registry";
import type { CoursePack } from "../schemas/course-pack.schema";
import type { Lesson } from "../schemas/lesson.schema";

type PreviewManifest = {
  schemaVersion: number;
  runId: string;
  coursePackId: string;
  courseTitle: string;
  coursePackPath: string;
  lessonPaths: string[];
};

export type GeneratedPreviewLoadResult = {
  previewRunId: string;
  coursePackEntry: CoursePackRegistryEntry;
  lessonEntries: LessonRegistryEntry[];
};

export async function fetchGeneratedPreview(runId: string): Promise<GeneratedPreviewLoadResult> {
  const manifest = await fetchJson<PreviewManifest>(previewAssetUrl(runId, "manifest.json"));
  const coursePack = await fetchJson<CoursePack>(previewAssetUrl(runId, manifest.coursePackPath));
  const lessons = await Promise.all(manifest.lessonPaths.map((lessonPath) => fetchJson<Lesson>(previewAssetUrl(runId, lessonPath))));

  return {
    previewRunId: manifest.runId,
    coursePackEntry: {
      id: coursePack.id,
      label: coursePack.title,
      coursePack,
      modulePath: `runs/${runId}/preview/${manifest.coursePackPath}`,
      projectStatus: "preview-ready",
      sourceKind: coursePack.sourceKind,
      strategy: coursePack.strategy,
      unitCount: coursePack.units.length
    },
    lessonEntries: lessons.map((lesson, index) => ({
      id: lesson.id,
      label: lesson.title,
      lesson,
      modulePath: `runs/${runId}/preview/${manifest.lessonPaths[index] ?? lesson.id}`
    }))
  };
}

function previewAssetUrl(runId: string, relativePath: string): string {
  if (!/^[a-z][a-z0-9-]{0,63}$/u.test(runId)) {
    throw new Error("preview runId is invalid");
  }
  const normalizedPath = normalizePreviewPath(relativePath);
  return `/__learning-preview/${runId}/${normalizedPath}`;
}

function normalizePreviewPath(relativePath: string): string {
  if (
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.includes("..") ||
    relativePath.includes("\\") ||
    !relativePath.endsWith(".json")
  ) {
    throw new Error(`preview path is invalid: ${relativePath}`);
  }
  return relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to load generated preview: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
}
