import { test, expect } from "@playwright/test";

// Task 0103 e2e: dev-only. The Bootstrap component seeds 5 deterministic
// Prospects on first load; they show up in the PresenceOverlay chip strip.
// The dev controls expose a "Clear NPCs" button that removes them.

test("dev spawns 5 Prospect NPCs and Clear NPCs empties the chip strip", async ({ page }) => {
  test.skip(!!process.env.CI, "[ci] dev-only NPC seed; runs locally with pnpm test:e2e");

  await page.goto("/");
  // Wait for the dev controls to mount.
  await expect(page.getByTestId("npc-dev")).toBeVisible();

  // Three NPC chips should be present, each with a data-player starting
  // with "npc-".
  await expect
    .poll(async () => (await page.locator('[data-player^="npc-"]').count()) >= 5, { timeout: 3_000 })
    .toBe(true);
  const npcChips = page.locator('[data-player^="npc-"]');
  await expect(npcChips).toHaveCount(5);
  // Each chip's role label is "Prospect" (English locale, en.json).
  await expect(npcChips.first()).toContainText(/prospect/i);

  // The dev counter shows 3.
  await expect(page.getByTestId("npc-count")).toHaveText("5");

  // Click "Clear NPCs".
  await page.getByTestId("npc-clear").click();

  await expect
    .poll(async () => (await page.locator('[data-player^="npc-"]').count()) === 0, { timeout: 2_000 })
    .toBe(true);
  await expect(page.getByTestId("npc-count")).toHaveText("0");
});
