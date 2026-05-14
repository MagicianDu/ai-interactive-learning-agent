import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), learningPreviewPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
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

function decodePreviewAssetPath(assetPath: string): string {
  const decoded = decodeURIComponent(assetPath);
  if (decoded.startsWith("/") || decoded.includes("..") || decoded.includes("\\")) {
    throw new Error("invalid preview asset path");
  }
  return decoded;
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
