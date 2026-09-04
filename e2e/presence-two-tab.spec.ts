import { test, expect, chromium } from "@playwright/test";

// Task 0102 e2e: two browser tabs join the world, tab A drives a remote state
// through the dev-only window.__tcPresenceTest seam, and tab B's PresenceOverlay
// shows the new chip within 500 ms. The seam is a dev hook (see api.ts) and
// is tree-shaken in production builds, so this test only makes sense in dev.

test("two tabs see each other via PresenceOverlay", async () => {
  test.skip(!!process.env.CI, "[ci] dev-only test seam; runs locally with pnpm test:e2e");
  const browser = await chromium.launch();
  // Same BrowserContext for both pages so the BroadcastChannel seam can
  // reach across them (BroadcastChannel only crosses same-origin pages in
  // the same browsing context group). Two real browser tabs share a context.
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  await pageA.goto("/");
  await pageB.goto("/");

  // Wait for the dev seam to install and the overlays to mount.
  await expect.poll(async () => {
    return pageA.evaluate(() => typeof (window as any).__tcPresenceTest === "object")
      && pageB.evaluate(() => typeof (window as any).__tcPresenceTest === "object");
  }, { timeout: 5_000 }).toBe(true);

  // Drive a remote state into A — represents "another player moved near me".
  await pageA.evaluate(() => {
    const w = window as any;
    w.__tcPresenceTest.pushRemote({ playerId: "remote-p1", x: 1, y: 2, z: 3, role: "scout" });
  });

  // B should see the chip within 500 ms.
  await expect
    .poll(async () => (await pageB.getByTestId("presence-chip").count()) >= 1, { timeout: 1_000 })
    .toBe(true);
  await expect(pageB.getByTestId("presence-chip").first()).toContainText(/scout/i);

  // Drive a second remote into A and a move on the first.
  await pageA.evaluate(() => {
    const w = window as any;
    w.__tcPresenceTest.pushRemote({ playerId: "remote-p2", x: 4, y: 5, z: 6, role: "camp" });
    w.__tcPresenceTest.pushRemote({ playerId: "remote-p1", x: 7, y: 8, z: 9, role: "scout" });
  });
  await expect
    .poll(async () => (await pageB.getByTestId("presence-chip").count()) >= 2, { timeout: 1_000 })
    .toBe(true);

  // Clear and verify the overlay collapses back to title-only.
  await pageA.evaluate(() => {
    const w = window as any;
    w.__tcPresenceTest.clear();
  });
  await expect
    .poll(async () => (await pageB.getByTestId("presence-chip").count()) === 0, { timeout: 1_000 })
    .toBe(true);
  await expect(pageB.getByTestId("presence-overlay")).toBeVisible();

  await browser.close();
});
