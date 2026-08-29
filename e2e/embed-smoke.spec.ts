import { test, expect } from "@playwright/test";

// Task 0002 bridge harness smoke (updated in 0003 to drop the placeholder-only
// sphere testid): the iframe is visible, the bridge resolves on the parent, and
// a joinWorld success is logged. Works against both the placeholder (CI) and the
// real Unity build (local after `pnpm dev:unity`).
test("unity embed iframe present, bridge resolves, joinWorld succeeds", async ({ page }) => {
  const joinWorldHeard: string[] = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("joinWorld")) joinWorldHeard.push(t);
  });

  await page.goto("/");

  // The iframe points at the build (local) or the placeholder (CI).
  const iframe = page.locator('iframe[src*="/unity/"]');
  await expect(iframe).toBeVisible();

  // The bridge namespace is installed on the parent window.
  const hasBridge = await page.evaluate(() => typeof (window as any).__tcBridge === "object");
  expect(hasBridge).toBe(true);

  // A joinWorld success was logged via the bridge.
  await expect.poll(() => joinWorldHeard.some((t) => /joinWorld/i.test(t) && /ok|success/i.test(t))).toBe(true);
});
