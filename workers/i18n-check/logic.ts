// workers/i18n-check/logic.ts — assert every used key exists in all three dictionaries.
import type { Reader, WorkerResult } from "../shared/reader";

export type Lang = "en" | "es" | "pt";

export interface RunOpts {
  reader: Reader;
  /** Per-language dictionaries. */
  dictionaries: Record<Lang, Record<string, string>>;
  /** Keys observed used in code (via t("...")). */
  usedKeys: string[];
}

export async function run({ dictionaries, usedKeys }: RunOpts): Promise<WorkerResult> {
  const langs: Lang[] = ["en", "es", "pt"];
  const missing: string[] = [];
  for (const key of usedKeys) {
    for (const lang of langs) {
      if (!(key in dictionaries[lang])) {
        missing.push(`${lang}: ${key}`);
      }
    }
  }
  if (missing.length > 0) {
    return { ok: false, message: `missing dictionary keys:\n${missing.join("\n")}`, details: { missing } };
  }
  return { ok: true, message: `${usedKeys.length} key(s) present in all three dictionaries`, details: { missing: [] } };
}
