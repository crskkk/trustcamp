import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Each spec boots a full WebGL world; more than a couple at once starves the
  // page (software GL on CI) and turns every wait into a timeout.
  workers: process.env.CI ? 2 : 3,
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
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
