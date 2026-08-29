// src/modules/i18n/api.ts — the ONLY public door to the i18n module.
// Other modules import { t, detectLang } from "../i18n/api".
import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";
import pt from "./dictionaries/pt.json";

export type Lang = "en" | "es" | "pt";

const DICT: Record<Lang, Record<string, string>> = {
  en: en as Record<string, string>,
  es: es as Record<string, string>,
  pt: pt as Record<string, string>,
};

const DEFAULT: Lang = "en";

/** Detect a language from a BCP-47 tag (e.g. navigator.language). */
export function detectLang(tag?: string): Lang {
  if (!tag) return DEFAULT;
  const base = tag.toLowerCase().split("-")[0];
  if (base === "es") return "es";
  if (base === "pt") return "pt";
  return DEFAULT;
}

/** Translate a key in a given language, falling back to English then the key. */
export function t(key: string, lang: Lang = DEFAULT): string {
  return DICT[lang]?.[key] ?? DICT[DEFAULT]?.[key] ?? key;
}

/** List every known key (used by i18n-check worker). */
export function knownKeys(): string[] {
  return Object.keys(DICT[DEFAULT]);
}

export type { Lang as _Lang };
