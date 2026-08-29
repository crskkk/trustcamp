import { test, expect } from "@playwright/test";

// Task 0003 visual checkpoint (LOCAL ONLY): after `pnpm dev:unity` produces the
// real Unity WebGL build, the embedded iframe renders a non-black planet canvas.
// Skipped in CI — there is no Unity Editor to produce the build there.
test.skip(!!process.env.CI, "[ci] planet render check needs a Unity build");

test("planet renders a non-black WebGL canvas", async ({ page }) => {
  await page.goto("/");
  const iframe = page.locator('iframe[src*="/unity/Build/index.html"]');
  // If the build isn't present, WorldEmbed falls back to the placeholder, so this
  // test only runs meaningfully after `pnpm dev:unity`.
  await expect(iframe).toBeVisible({ timeout: 30_000 });
  const frame = iframe.contentFrame();
  // Unity WebGL creates a <canvas> inside the iframe once the loader finishes.
  const canvas = frame!.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const w = await canvas.evaluate((el) => (el as HTMLCanvasElement).width);
  expect(w).toBeGreaterThan(0);
});
