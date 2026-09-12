// scripts/shots.mjs — capture reference screenshots of THE BAR for visual review.
//   pnpm dev   (in another terminal)   then   node scripts/shots.mjs [outDir]
// Writes 1280x720 PNGs: camp, lake, forest, hills, camper, menu. Uses the
// "high" quality tier (shadows, full terrain) even on software GL.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "e2e/shots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:5173/?quality=high&ws=");
await page.waitForFunction(() => document.querySelector("[data-testid=world-canvas]")?.dataset.ready === "1", null, { timeout: 60_000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  document.querySelectorAll(".tc-app > *:not(.tc-hud-stage):not(header)").forEach((e) => (e.style.display = "none"));
  document.querySelector(".tc-world-hint")?.remove();
});

const look = async (area, facingToward) => {
  await page.evaluate(async ([area, toward]) => {
    const m = await import("/src/modules/world3d/api.ts");
    const from = m.landmark(area);
    const to = toward === "area" ? m.REGIONS[area] : m.REGIONS[toward];
    window.__tcWorld.teleport(from, { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z });
  }, [area, facingToward]);
  await page.waitForTimeout(2500);
};

const shots = [
  ["camp", "camp", "camp"],
  ["lake", "lake", "area"],
  ["forest", "forest", "hills"],
  ["hills", "hills", "area"],
];
for (const [name, area, toward] of shots) {
  await look(area, toward);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
}
// Camper close-up: walk a little so the walk cycle shows, then freeze.
await look("camp", "camp");
await page.evaluate(() => window.__tcWorld.input.inject({ x: 0.3, y: 1 }));
await page.waitForTimeout(900);
await page.evaluate(() => window.__tcWorld.input.inject(null));
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/camper.png` });
console.log("shot camper");
await page.evaluate(() => document.querySelector("[data-testid=hud-menu]")?.click());
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/menu.png` });
console.log("shot menu");
await browser.close();
