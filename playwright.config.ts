import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Each spec boots one or more full WebGL worlds on software GL; running them
  // concurrently starves the pages and turns every wait into a timeout.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    { command: "pnpm dev", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: "pnpm server", url: "http://127.0.0.1:8787/health", reuseExistingServer: !process.env.CI, timeout: 30_000, env: { DB_PATH: ":memory:" } },
  ],
});
