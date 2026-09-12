import { test, expect } from "@playwright/test";

// World render smoke (v2.0): the Three.js canvas comes up, renders non-black
// pixels within 10 s (STANDARDS §2.1), the bridge seam is installed on the
// window, and a joinWorld success is logged.
test("world canvas renders non-black frames, bridge resolves, joinWorld succeeds", async ({ page }) => {
  const joinWorldHeard: string[] = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("joinWorld")) joinWorldHeard.push(t);
  });

  await page.goto("/");
  const world = page.getByTestId("world-canvas");
  await expect(world).toBeVisible();
  await expect(world).toHaveAttribute("data-ready", "1", { timeout: 10_000 });

  // Non-black frame: the dev seam renders a frame and reads it back (a WebGL
  // buffer is not readable after present, so the probe renders + reads).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = (window as unknown as { __tcWorld?: { probeFrame(): { bright: number } } }).__tcWorld;
          return w ? w.probeFrame().bright : 0;
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(200);

  const hasBridge = await page.evaluate(() => typeof (window as unknown as { __tcBridge?: unknown }).__tcBridge === "object");
  expect(hasBridge).toBe(true);
  await expect.poll(() => joinWorldHeard.some((t) => /joinWorld/i.test(t) && /ok|success/i.test(t))).toBe(true);
});

test("the control hint fades within 6 s of the first input (STANDARDS §6.2)", async ({ page }) => {
  await page.goto("/");
  const hint = page.getByTestId("world-hint");
  await expect(hint).toBeVisible();
  await page.keyboard.press("w");
  await expect(hint).toHaveClass(/is-hidden/, { timeout: 7_000 });
});
