/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, existsSync } from "node:fs";

// Dev-only middleware: serve repo-root artifacts the StatusPanel fetches at runtime
// (test-results.json, SYSTEM.md, ROADMAP.md). These are generated files, not in /public.
function serveRootArtifacts() {
  return {
    name: "serve-root-artifacts",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const serve = (file: string, type: string) => {
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
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveRootArtifacts()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    reporters: ["default", "json"],
    outputFile: "test-results.json",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "workers/**/*.{test,spec}.ts"],
  },
});
