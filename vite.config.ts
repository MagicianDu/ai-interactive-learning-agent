import react from "@vitejs/plugin-react";
import type { Dirent } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), learningPreviewPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    testTimeout: 20000
  }
});

function learningPreviewPlugin(): Plugin {
  const workspaceRoot = process.cwd();
  return {
    name: "learning-preview-runtime",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url ?? "";
        const pathname = url.split("?", 1)[0] ?? "";
        if (pathname === "/__learning-preview/index.json") {
          const previews = await listPreviewIndex(workspaceRoot);
          response.statusCode = 200;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ previews }));
          return;
        }

        const match = /^\/__learning-preview\/(?<runId>[a-z][a-z0-9-]{0,63})\/(?<assetPath>.+)$/u.exec(pathname);
        if (!match?.groups) {
          next();
          return;
        }

        try {
          const assetPath = decodePreviewAssetPath(match.groups.assetPath);
          const previewRoot = path.join(workspaceRoot, "runs", match.groups.runId, "preview");
          const filePath = safeJoin(previewRoot, assetPath);
          const body = await readFile(filePath);
          response.statusCode = 200;
          response.setHeader("content-type", contentTypeForPreviewAsset(filePath));
          if (isTextPreviewAsset(filePath)) {
            response.end(body.toString("utf8"));
            return;
          }
          response.end(body);
        } catch (error) {
          response.statusCode = 404;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : "preview asset not found" }));
        }
      });
    }
  };
}

type PreviewIndexEntry = {
  runId: string;
  courseTitle: string;
  updatedAt: string;
};

async function listPreviewIndex(workspaceRoot: string): Promise<PreviewIndexEntry[]> {
  const runsRoot = path.join(workspaceRoot, "runs");
  let entries: Array<Dirent<string>>;
  try {
    entries = await readdir(runsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const previews = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && isPreviewRunId(entry.name))
      .map(async (entry): Promise<PreviewIndexEntry | undefined> => {
        const manifestPath = path.join(runsRoot, entry.name, "preview", "manifest.json");
        try {
          const [manifestBody, manifestStat] = await Promise.all([readFile(manifestPath, "utf8"), stat(manifestPath)]);
          const manifest = JSON.parse(manifestBody) as unknown;
          return {
            runId: entry.name,
            courseTitle: courseTitleFromManifest(manifest) ?? entry.name,
            updatedAt: manifestStat.mtime.toISOString()
          };
        } catch {
          return undefined;
        }
      })
  );

  return previews
    .filter((entry): entry is PreviewIndexEntry => entry !== undefined)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function decodePreviewAssetPath(assetPath: string): string {
  const decoded = decodeURIComponent(assetPath);
  if (decoded.startsWith("/") || decoded.includes("..") || decoded.includes("\\")) {
    throw new Error("invalid preview asset path");
  }
  return decoded;
}

function courseTitleFromManifest(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const courseTitle = value.courseTitle;
  return typeof courseTitle === "string" && courseTitle.trim().length > 0 ? courseTitle : undefined;
}

function contentTypeForPreviewAsset(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function isTextPreviewAsset(filePath: string): boolean {
  switch (path.extname(filePath).toLowerCase()) {
    case ".json":
    case ".svg":
    case ".txt":
    case ".md":
      return true;
    default:
      return false;
  }
}

function safeJoin(parentPath: string, childPath: string): string {
  const resolvedParent = path.resolve(parentPath);
  const resolvedChild = path.resolve(resolvedParent, childPath);
  const relative = path.relative(resolvedParent, resolvedChild);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("preview asset resolves outside preview directory");
  }
  return resolvedChild;
}

function isPreviewRunId(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,63}$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
