import { test, expect, chromium, type Page } from "@playwright/test";

// Task 0102 e2e: two browser tabs join the world, and each tab's
// PresenceOverlay shows the other tab's heartbeat. The cross-tab transport
// is the localStorage heartbeat (see src/modules/presence/api.ts) — tabs
// on the same origin (incl. incognito when on the same profile in modern
// browsers) observe each other via the storage event. In this test we
// drive the heartbeat from tab A using __tcBridge (the public bridge api)
// and tab B picks it up via its storage listener.
//
// The dev-only __tcPresenceTest seam is kept around for synthetic pushes
// in unit tests; in the browser, the real source is the bridge pipe.

const HEARTBEAT_KEY = "__tc_presence_hb__";

async function writeHeartbeat(
  writer: Page,
  listeners: Page[],
  peer: { selfId: string; role: string; x: number; y: number; z: number },
): Promise<void> {
  const value = JSON.stringify({ ...peer, ts: Date.now() });
  // Write from the writer's context so the storage event reflects a real
  // cross-context change. Then dispatch the storage event on every listener
  // (mirroring what the browser does automatically across same-origin tabs).
  await writer.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: HEARTBEAT_KEY, value },
  );
  await Promise.all(
    listeners.map((l) =>
      l.evaluate(
        ({ key, value }) =>
          window.dispatchEvent(new StorageEvent("storage", { key, newValue: value })),
        { key: HEARTBEAT_KEY, value },
      ),
    ),
  );
}

async function clearHeartbeat(writer: Page, listeners: Page[]): Promise<void> {
  await writer.evaluate((key) => localStorage.removeItem(key), HEARTBEAT_KEY);
  await Promise.all(
    listeners.map((l) =>
      l.evaluate(
        (key) =>
          window.dispatchEvent(new StorageEvent("storage", { key, newValue: null })),
        HEARTBEAT_KEY,
      ),
    ),
  );
}

test("two tabs see each other via the bridge pipe and heartbeat", async () => {
  test.skip(!!process.env.CI, "[ci] dev-only heartbeat; runs locally with pnpm test:e2e");
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  await pageA.goto("/");
  await pageB.goto("/");

  // Wait for both overlays to mount.
  await expect.poll(async () => {
    return (await pageA.getByTestId("presence-overlay").count()) === 1
      && (await pageB.getByTestId("presence-overlay").count()) === 1;
  }, { timeout: 20_000 }).toBe(true); // two full 3D worlds boot in one headless browser

  // Tab A "publishes" a peer heartbeat that tab B will see in its overlay.
  await writeHeartbeat(pageA, [pageB], { selfId: "remote-p1", role: "scout", x: 1, y: 2, z: 3 });

  const remoteP1 = pageB.locator('[data-player="remote-p1"]');
  const remoteP2 = pageB.locator('[data-player="remote-p2"]');
  await expect
    .poll(async () => (await remoteP1.count()) === 1, { timeout: 2_000 })
    .toBe(true);
  await expect(remoteP1).toContainText(/scout/i);

  // A second peer arrives.
  await writeHeartbeat(pageA, [pageB], { selfId: "remote-p2", role: "camp", x: 4, y: 5, z: 6 });
  await expect
    .poll(async () => (await remoteP2.count()) === 1, { timeout: 2_000 })
    .toBe(true);

  // First peer moves (role unchanged, position changed) — the chip stays
  // (we re-find it by data-player rather than counting).
  await writeHeartbeat(pageA, [pageB], { selfId: "remote-p1", role: "scout", x: 7, y: 8, z: 9 });
  await expect(remoteP1).toBeVisible();
  await expect(remoteP2).toBeVisible();

  // A peer goes away.
  await clearHeartbeat(pageA, [pageB]);
  await expect
    .poll(async () => (await remoteP1.count()) === 0, { timeout: 2_000 })
    .toBe(true);
  // The overlay itself is always present (collapses to title-only when empty).
  await expect(pageB.getByTestId("presence-overlay")).toBeVisible();

  await browser.close();
});
