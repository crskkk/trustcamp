// vite.config.mjs — the dev/test/build config for the Lovable shell.
// Lives in plain JS (not .ts) so vite does not have to bundle it through
// esbuild on the sandboxed CI image. The .d.ts triple-slash reference
// keeps `vitest` field types available to editors via the `vite` package.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, existsSync } from "node:fs";

/// <reference types="vitest" />

// Dev-only middleware: serve repo-root artifacts the StatusPanel fetches at runtime
// (test-results.json, SYSTEM.md, ROADMAP.md, TASK_LOG.md). These are generated
// files, not in /public.
function serveRootArtifacts() {
  return {
    name: "serve-root-artifacts",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const serve = (file, type) => {
          if (existsSync(file)) {
            res.setHeader("Content-Type", type);
            res.end(readFileSync(file, "utf8"));
            return true;
          }
          res.statusCode = 404;
          res.end("not found");
          return false;
        };
        if (req.url === "/test-results.json") return serve("test-results.json", "application/json");
        if (req.url === "/SYSTEM.md") return serve("SYSTEM.md", "text/markdown");
        if (req.url === "/ROADMAP.md") return serve("ROADMAP.md", "text/markdown");
        if (req.url === "/TASK_LOG.md") return serve("TASK_LOG.md", "text/markdown");
        next();
      });
    },
  };
}

export default defineConfig({
  // Pages serves the client under /trustcamp/; local dev and Artifact snapshots use "/".
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), serveRootArtifacts()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      // Stable names so the Artifact snapshot wrapper can reference them.
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    reporters: ["default", "json"],
    outputFile: "test-results.json",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "workers/**/*.{test,spec}.ts", "server/**/*.spec.ts"],
  },
});
