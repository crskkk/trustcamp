import { test, expect } from "@playwright/test";

// Task 0104 e2e: the dev spawn of 3 Prospects also drives a per-tick
// motion publish loop (startNpcMotion). The bridge's in-memory fallback
// emits every sendState to its subscribers; the presence layer picks
// those up. We assert that within ~3 s the published positions
// have changed for at least one NPC (i.e., the loop is ticking).

test("dev NPCs tick their published position over time", async ({ page }) => {
  test.skip(!!process.env.CI, "[ci] dev-only motion loop; runs locally with pnpm test:e2e");

  await page.goto("/");
  await expect(page.getByTestId("npc-dev")).toBeVisible();
  // Wait for the first tick so presence has the NPC.
  await expect
    .poll(async () => (await page.locator('[data-player^="npc-"]').count()) >= 3, { timeout: 3_000 })
    .toBe(true);

  // Snapshot the data-x of one of the NPC chips.
  const before = await page.locator('[data-player="npc-101"]').first().getAttribute("data-x");
  expect(before).not.toBeNull();

  // Wait for the next tick (~2s) and check the position changed.
  await expect
    .poll(
      async () => {
        const now = await page.locator('[data-player="npc-101"]').first().getAttribute("data-x");
        return now !== before;
      },
      { timeout: 5_000, intervals: [500] },
    )
    .toBe(true);
});
