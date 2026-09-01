import { test, expect } from "@playwright/test";

// Visual Checkpoint for task 0001: the dev-only System Status panel reflects
// what was built (workers, tests, SYSTEM.md, version) in a live dev run.
test("status panel shows workers, tests, SYSTEM.md preview, and version chip", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("System Status")).toBeVisible();
  await expect(page.getByText("arch:check")).toBeVisible();
  await expect(page.getByText("i18n:check")).toBeVisible();
  await expect(page.getByText("system:update")).toBeVisible();
  await expect(page.getByText("bundle:guard")).toBeVisible();
  // Test pass line (format "N / M") and version chip both present.
  await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();
  await expect(page.getByText(/^v\d+\.\d+$/)).toBeVisible();
  // SYSTEM.md preview visible somewhere.
  await expect(page.getByText("## Modules")).toBeVisible();
});
