import { test, expect } from "@playwright/test";

// v2.1 — a round can be started from the HUD, its timer runs, and it can be
// stopped; XP/level are shown in the chrome.
test("start Firewood Dash from the HUD, timer counts down, stop hides the panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("world-canvas")).toHaveAttribute("data-ready", "1", { timeout: 15_000 });
  await page.getByTestId("hud-play-firewood-dash").click();
  const panel = page.getByTestId("hud-round");
  await expect(panel).toBeVisible();
  const timer = page.getByTestId("hud-round-time");
  await expect(timer).toHaveText(/0:5\d|1:00/);
  const first = await timer.textContent();
  await page.waitForTimeout(1600);
  const second = await timer.textContent();
  expect(second).not.toBe(first);
  await page.getByTestId("hud-stop").click();
  await expect(panel).toBeHidden();
  await expect(page.getByTestId("hud-level-value")).toHaveText(/\d+/);
});
