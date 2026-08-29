import { test, expect } from "@playwright/test";

// Sanity check: in a live dev run, the System Status panel shows every
// worker as green (not red). Verifies the in-browser reader is wired up.
test("status panel shows all workers green with verbose messages", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (msg) => messages.push(`${msg.type()}: ${msg.text()}`));
  await page.goto("/");
  await expect(page.getByText("System Status")).toBeVisible();
  // arch:check row.
  const archRow = page.locator("li", { hasText: "arch:check" });
  await expect(archRow.locator(".tc-sp-dot")).toHaveClass(/ok|pending/);
  // Wait for the dot to flip to ok (the panel runs workers async on mount).
  await expect.poll(async () => {
    const cls = await archRow.locator(".tc-sp-dot").getAttribute("class");
    return cls;
  }, { timeout: 10_000 }).toMatch(/ok/);
  // The verbose message is present.
  const detail = page.getByTestId("worker-detail-arch-check");
  await expect(detail).toBeVisible();
  const detailText = await detail.textContent();
  expect(detailText).toBeTruthy();
});
