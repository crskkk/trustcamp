import { test, expect } from "@playwright/test";

// v2.2 — two browser tabs connected to the local THE BAR server see each
// other's camper move (STANDARDS §4.1) and a reload resumes the same player.
const WS = "ws://127.0.0.1:8787";

async function remotesOf(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = (window as unknown as { __tcWorld?: { remotes: Map<string, unknown> } }).__tcWorld;
    return w ? [...w.remotes.keys()].filter((k) => !k.startsWith("npc-")) : [];
  });
}

test("two tabs on the server see each other and follow movement", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(`/?ws=${WS}`);
  await b.goto(`/?ws=${WS}`);
  await expect(a.getByTestId("world-canvas")).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(b.getByTestId("world-canvas")).toHaveAttribute("data-ready", "1", { timeout: 30_000 });

  await expect.poll(async () => (await remotesOf(a)).length >= 1 && (await remotesOf(b)).length >= 1, { timeout: 30_000 }).toBe(true);
  const idOfA = await a.evaluate(() => (window as unknown as { __tcBridge?: unknown }).__tcBridge && localStorage.getItem("tc.token"));
  expect(idOfA).toBeTruthy();

  // Player A walks; B's replica of A moves within the interpolation budget.
  const before = await b.evaluate(() => {
    const w = (window as unknown as { __tcWorld: { remotes: Map<string, { walker: { dir: { x: number; y: number; z: number } } }> } }).__tcWorld;
    const r = [...w.remotes.entries()].find(([k]) => !k.startsWith("npc-"))![1];
    return { ...r.walker.dir };
  });
  await a.evaluate(() => (window as unknown as { __tcWorld: { input: { inject(m: { x: number; y: number } | null): void } } }).__tcWorld.input.inject({ x: 0, y: 1 }));
  await a.waitForTimeout(2500);
  await a.evaluate(() => (window as unknown as { __tcWorld: { input: { inject(m: null): void } } }).__tcWorld.input.inject(null));
  await expect
    .poll(
      () =>
        b.evaluate((prev) => {
          const w = (window as unknown as { __tcWorld: { remotes: Map<string, { walker: { dir: { x: number; y: number; z: number } } }> } }).__tcWorld;
          const r = [...w.remotes.entries()].find(([k]) => !k.startsWith("npc-"))![1];
          const d = r.walker.dir;
          return Math.hypot(d.x - prev.x, d.y - prev.y, d.z - prev.z) * 48;
        }, before),
      { timeout: 8_000 },
    )
    .toBeGreaterThan(0.5); // B's replica of A clearly walked (software GL runs ~12 fps)

  // Reload A: same resume token, same player id on the server.
  const tokenBefore = await a.evaluate(() => localStorage.getItem("tc.token"));
  await a.reload();
  await expect(a.getByTestId("world-canvas")).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await expect.poll(() => a.evaluate(() => localStorage.getItem("tc.token")), { timeout: 10_000 }).toBe(tokenBefore);

  await ctxA.close();
  await ctxB.close();
});
