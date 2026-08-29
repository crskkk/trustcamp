import { test, expect } from "@playwright/test";

// Visual Checkpoint for task 0002: the embedded Unity placeholder loads (no black
// screen), the bridge namespace resolves on the parent window, and a joinWorld
// success is observable.
test("unity embed loads, bridge resolves, joinWorld succeeds", async ({ page }) => {
  const joinWorldHeard: string[] = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("joinWorld")) joinWorldHeard.push(t);
  });

  await page.goto("/");

  // The embedded iframe must exist and point at the Unity build.
  const iframe = page.locator('iframe[src*="/unity/Build/index.html"]');
  await expect(iframe).toBeVisible();

  // The placeholder sphere is visible inside the frame (no black screen).
  const frame = iframe.contentFrame();
  await expect(frame!.locator("[data-testid='unity-sphere']")).toBeVisible();

  // The bridge namespace is installed on the parent window.
  const hasBridge = await page.evaluate(() => typeof (window as any).__tcBridge === "object");
  expect(hasBridge).toBe(true);

  // A joinWorld success was logged via the bridge.
  await expect.poll(() => joinWorldHeard.some((t) => /joinWorld/i.test(t) && /ok|success/i.test(t))).toBe(true);
});
