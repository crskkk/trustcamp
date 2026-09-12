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

  // Non-black frame: sample the canvas through a 2D copy (WebGL buffers are
  // not readable after present, so draw the canvas into an offscreen 2D one).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = document.querySelector<HTMLCanvasElement>(".tc-world-canvas");
          if (!c || c.width === 0) return 0;
          const off = document.createElement("canvas");
          off.width = 32;
          off.height = 32;
          const ctx = off.getContext("2d")!;
          ctx.drawImage(c, 0, 0, 32, 32);
          const d = ctx.getImageData(0, 0, 32, 32).data;
          let bright = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) bright++;
          return bright;
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
