// Node CLI entrypoint: pnpm i18n:check
// Scans src/**/*.{ts,tsx} for t("...") usages, asserts all keys exist in en/es/pt.
import { run } from "./logic";
import { nodeReader } from "../shared/node-reader";
import { readFileSync } from "node:fs";
import { glob } from "glob";

async function main() {
  const reader = await nodeReader();
  // Load dictionaries from the i18n module.
  const en = JSON.parse(readFileSync("src/modules/i18n/dictionaries/en.json", "utf8"));
  const es = JSON.parse(readFileSync("src/modules/i18n/dictionaries/es.json", "utf8"));
  const pt = JSON.parse(readFileSync("src/modules/i18n/dictionaries/pt.json", "utf8"));

  // Collect used keys by scanning for t("...") calls with LITERAL string args only.
  // Dynamic keys (t(`worker.${k}`)) are resolved at runtime and skipped here;
  // their concrete values are added below from the known worker key list.
  const files = await glob("src/**/*.{ts,tsx}", { ignore: ["src/**/*.test.tsx", "src/**/*.spec.ts"] });
  const used = new Set<string>();
  // Match t("key") / t('key') / t(`key`) — template literals only if NO ${} interpolation.
  const re = /\bt\(\s*["']([^"']+)["']|\bt\(\s*`([^`$]*)`\)/g;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const key = m[1] ?? m[2];
      if (key) used.add(key);
    }
  }
  // Expand the dynamic worker.* template-literal keys used by the StatusPanel.
  for (const k of ["arch-check", "i18n-check", "system-update", "bundle-guard"]) {
    used.add(`worker.${k}`);
  }

  const res = await run({ reader, dictionaries: { en, es, pt }, usedKeys: [...used] });
  if (!res.ok) {
    console.error(res.message);
    process.exit(1);
  }
  console.log(`i18n:check → ${res.message}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
