import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ExportBundleService } from "./export-bundle-service.js";

describe("ExportBundleService", () => {
  it("writes export manifest for a preview-ready course", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-export-"));
    const runDir = path.join(root, "runs", "agentic");
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify(
        {
          status: "preview_ready",
          runId: "agentic",
          coursePackId: "agentic",
          courseTitle: "Agentic 课程",
          lessonCount: 3,
          coursePackPath: path.join(root, "src/course-packs/agentic/coursePack.ts"),
          lessonPaths: [path.join(root, "src/lessons/agentic-overview/lesson.ts")],
          publishNotes: "Generated."
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await new ExportBundleService(root).exportRun({ runId: "agentic" });

    expect(result.status).toBe("export_ready");
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as { courseTitle: string; artifactVersions: string[] };
    expect(manifest.courseTitle).toBe("Agentic 课程");
    expect(manifest.artifactVersions).toEqual([]);
  });
});
