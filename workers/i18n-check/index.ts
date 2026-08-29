// Node CLI entrypoint: pnpm i18n:check
// Scans src/**/*.{ts,tsx} for t("...") usages, asserts all keys exist in
// en/es/pt, and flags any hardcoded JSX text nodes (AGENTS §6 — no
// untranslated UI strings in touched UI code).
import { run } from "./logic";
import { nodeReader } from "../shared/node-reader";
import { readFileSync } from "node:fs";
import { glob } from "glob";
import type { HardcodedString } from "./logic";

/** Lines of source we are allowed to skip when scanning for hardcoded text.
 *  - "true" / "false" — JSON-ish attribute values that happen to look
 *    like text but are not user-facing.
 *  - Glyphs — visual icons like "✕", "↻", "≡", "⟳", "×" used as button
 *    affordances. Localized strings belong in i18n keys; icons don't.
 *  - Pure whitespace lines.
 */
const GLYPHS = new Set([
  "",
  " ",
  "\n",
  "✕",
  "×",
  "↻",
  "⟳",
  "≡",
  "—",
  "EN",
  "ES",
  "PT",
]);

/** Walk a TS/TSX source string and find JSX text content. We only
 *  look at the gap between a `>` and the next `<` on the same line —
 *  i.e. a self-contained JSX text run inside an open/close tag pair.
 *  Multi-line text nodes and text mixed with expressions are skipped
 *  (they are usually small iconography or punctuation the developer
 *  intentionally left in English; future tasks can refine). */
function findHardcodedJsxText(source: string, file: string): HardcodedString[] {
  const out: HardcodedString[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Strip line and block comments to avoid false positives.
    const stripped = line
      .replace(/\/\/.*$/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    // Look for `>text<` runs that don't start with `{` and don't contain
    // another `{` or `}` (which would indicate we straddle an expression).
    const textRe = />([^{}<>][^<>{}]*?)<\//g;
    let m: RegExpExecArray | null;
    while ((m = textRe.exec(stripped)) !== null) {
      const t = (m[1] ?? "").trim();
      if (!t) continue;
      if (GLYPHS.has(t)) continue;
      // Skip things that look like a single identifier / classname (e.g.
      // class names that happen to land between two tag characters in
      // unusual attribute arrangements).
      if (/^[\w./#-]+$/.test(t) && !/[A-Z][a-z]/.test(t)) continue;
      // Skip import paths that the regex might catch on a JSX-ish line.
      if (t.startsWith("./") || t.startsWith("../") || t.startsWith("/")) continue;
      out.push({ file, line: i + 1, text: t, rule: "jsx-text" });
    }
  }
  return out;
}

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

  // Hardcoded JSX text scan. Excluded: test files (assertions on rendered
  // text are legitimate English), worker logic (no JSX there), and the
  // dictionary JSON.
  const hardcoded: HardcodedString[] = [];
  for (const f of files) {
    if (f.endsWith(".test.tsx") || f.endsWith(".spec.ts")) continue;
    const src = readFileSync(f, "utf8");
    hardcoded.push(...findHardcodedJsxText(src, f));
  }

  const res = await run({ reader, dictionaries: { en, es, pt }, usedKeys: [...used], hardcoded });
  if (hardcoded.length > 0) {
    // Always surface the hardcoded list, even on success — these are warnings.
    for (const h of hardcoded) {
      console.warn(`hardcoded JSX text in ${h.file}:${h.line}: "${h.text}"`);
    }
  }
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
