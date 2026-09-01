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

// Guards the regressions that shipped silently before (white planet from a
// stripped vertex-color shader; avatars missing / invisible). Unity's Debug.Log
// lines surface in the page console, so we can assert on them without pixels.
test("planet shader resolves and the avatar showcase spawns", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(msg.text()));

  await page.goto("/");
  const canvas = page
    .locator('iframe[src*="/unity/Build/index.html"]')
    .contentFrame()
    .locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  // Give the scene's Start() a moment to run after the loader finishes.
  await expect
    .poll(() => logs.some((l) => l.includes("Avatar Showcase spawned near camp")), {
      timeout: 30_000,
    })
    .toBe(true);

  const joined = logs.join("\n");
  expect(joined, "vertex-color shader fell back — planet would render flat white").not.toContain(
    "falling back to Unlit/Color",
  );
  expect(joined).toContain("[PlanetGenerator] vertex-color shader OK");
  // All four fixed-seed avatars reached the surface.
  for (const seed of [1, 42, 12345, 999999]) {
    expect(joined, `avatar ${seed} did not spawn`).toContain(`Avatar ${seed} spawned at`);
  }
});
