// workers/i18n-check/logic.ts — assert every used key exists in all three
// dictionaries, and surface any hardcoded JSX text nodes (AGENTS §6).
//
// The hardcoded-string scan is structural: it walks the raw source and
// reports any JSX text content (a `>...<` segment that isn't pure
// whitespace, isn't an i18n key, and isn't one of a tiny allow-list of
// glyphs). It is reported as a `warning` (not a blocker) so the
// developer can see it in the panel / CI summary without failing every
// build on the first day. A future task can promote it to a blocker.
import type { Reader, WorkerResult } from "../shared/reader";

export type Lang = "en" | "es" | "pt";

export interface HardcodedString {
  file: string;
  line: number;
  text: string;
  rule: "jsx-text";
}

export interface RunOpts {
  reader: Reader;
  /** Per-language dictionaries. */
  dictionaries: Record<Lang, Record<string, string>>;
  /** Keys observed used in code (via t("...")). */
  usedKeys: string[];
  /** Hardcoded JSX text nodes found by the source scan (Node path). */
  hardcoded?: HardcodedString[];
}

export interface RunDetails {
  missing: string[];
  hardcoded: HardcodedString[];
  used: number;
}

export async function run({
  dictionaries,
  usedKeys,
  hardcoded = [],
}: RunOpts): Promise<WorkerResult> {
  const langs: Lang[] = ["en", "es", "pt"];
  const missing: string[] = [];
  for (const key of usedKeys) {
    for (const lang of langs) {
      if (!(key in dictionaries[lang])) {
        missing.push(`${lang}: ${key}`);
      }
    }
  }
  const blocker = missing.length > 0;
  if (blocker) {
    return {
      ok: false,
      message: `missing dictionary keys:\n${missing.join("\n")}`,
      details: { missing, hardcoded, used: usedKeys.length },
    };
  }
  // No missing keys. Hardcoded strings are a warning, not a blocker.
  const warn = hardcoded.length;
  const summary =
    `${usedKeys.length} key(s) present in all three dictionaries` +
    (warn > 0 ? `; ${warn} hardcoded string(s) flagged` : "");
  return {
    ok: true,
    message: summary,
    details: { missing: [], hardcoded, used: usedKeys.length },
  };
}
