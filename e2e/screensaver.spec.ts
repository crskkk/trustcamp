import { test, expect } from "@playwright/test";

// Task 0009 — screensaver render-path proof, now against the Three.js world.
test("/screensaver auto-orbits the planet; the detach hook freezes it", async ({ page }) => {
  await page.goto("/screensaver");
  await expect(page.getByTestId("world-canvas")).toHaveAttribute("data-ready", "1", { timeout: 15_000 });

  const yaw = () =>
    page.evaluate(() => (window as unknown as { __tcBridge?: { __camera?: { yaw?: number } } }).__tcBridge?.__camera?.yaw ?? null);

  await expect.poll(yaw, { timeout: 15_000 }).not.toBeNull();
  const a = (await yaw())!;
  await page.waitForTimeout(1500);
  const b = (await yaw())!;
  expect(b).toBeGreaterThan(a);

  await page.evaluate(() => (window as unknown as { __tcScreensaver: { stop(): void } }).__tcScreensaver.stop());
  await page.waitForTimeout(300);
  const c = (await yaw())!;
  await page.waitForTimeout(1500);
  const d = (await yaw())!;
  expect(Math.abs(d - c)).toBeLessThan(1);
});
