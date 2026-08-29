import { test, expect } from "@playwright/test";

// Task 0006 — Visual checkpoint. The HUD chrome mounts at the top of the
// app, exposes a collapse/expand toggle, and the language switch re-renders
// the chrome in es / pt. Standalone page; runs in chromium under
// `pnpm dev` (webServer is configured in playwright.config.ts).
test.describe("HUD skeleton", () => {
  test("chrome renders, collapse/expand round-trip, language switch localizes the chrome", async ({ page }) => {
    await page.goto("/");

    // The HUD toggle button is always visible.
    await expect(page.getByRole("button", { name: /collapse/i })).toBeVisible();

    // Default expanded view shows every row.
    for (const key of ["score", "role", "level", "items", "notifications", "avatar", "leaderboard"]) {
      await expect(page.getByText(new RegExp(key, "i"))).toBeVisible();
    }

    // Collapse → only the toggle button is visible.
    await page.getByRole("button", { name: /collapse/i }).click();
    const visibleButtons = page.getByRole("button");
    await expect(visibleButtons).toHaveCount(1);
    await expect(page.getByRole("button", { name: /expand/i })).toBeVisible();
    await expect(page.getByText(/score/i)).toHaveCount(0);

    // Expand → rows return.
    await page.getByRole("button", { name: /expand/i }).click();
    await expect(page.getByText(/score/i)).toBeVisible();
  });

  test("Spanish locale renders the Spanish HUD label", async ({ browser }) => {
    const ctx = await browser.newContext({ locale: "es" });
    const page = await ctx.newPage();
    await page.goto("/");
    // Spanish label for `hud.score` per i18n plan.
    await expect(page.getByText(/Puntuación/)).toBeVisible();
    await ctx.close();
  });

  test("Portuguese locale renders the Portuguese HUD label", async ({ browser }) => {
    const ctx = await browser.newContext({ locale: "pt-BR" });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByText(/Pontuação/)).toBeVisible();
    await ctx.close();
  });
});
