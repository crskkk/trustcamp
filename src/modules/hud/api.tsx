// src/modules/hud/api.tsx — the ONLY public door to the HUD module.
//
// Exports:
//   - Hud: the root component, mount once at the top of the app.
//   - useHudLang(): a hook returning the current HUD language and a setter
//     so future HUD-connected panels (notifications, role chip) can read
//     the same language without coupling to React Context's internals.
//   - HudLangProvider: opt-in provider for sub-trees that need to read
//     the active lang without becoming a child of <Hud />.
//
// The HUD owns its own collapsed/expanded state and active language.
// Both are persisted in localStorage so the chrome remembers the player's
// preference across reloads. The default language falls back to
// detectLang(navigator.language) (i18n/api.ts).
//
// The lang state is shared across the tree via a small React context
// provided by <Hud />. <Hud />'s children can call useHudLang() and see
// the same value as the chrome. Outside <Hud />, the hook falls back to
// a local state for unit-test ergonomics (so a single component can
// mount and assert on the hook in isolation).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { t, detectLang, type Lang } from "../i18n/api";
import { HudRoot } from "./HudRoot";
import "./hud.css";

/** Re-export of i18n.Lang so callers don't have to import from i18n/api. */
export type HudLang = Lang;

const LANG_KEY = "tc.lang";
const COLLAPSED_KEY = "tc.hud.collapsed";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readLang(): Lang {
  const s = safeStorage();
  const stored = s?.getItem(LANG_KEY);
  if (stored === "en" || stored === "es" || stored === "pt") return stored;
  return detectLang(typeof navigator !== "undefined" ? navigator.language : undefined);
}

function readCollapsed(): boolean {
  const s = safeStorage();
  const v = s?.getItem(COLLAPSED_KEY);
  if (v === "true") return true;
  if (v === "false") return false;
  return false;
}

interface HudLangState {
  lang: HudLang;
  setLang: (l: HudLang) => void;
}

const HudLangContext = createContext<HudLangState | null>(null);

/**
 * The internal provider that owns the language state. Used by <Hud /> and
 * exported so unit tests / sibling trees can read the same state.
 */
function HudLangStore({ children, initial }: { children: ReactNode; initial?: HudLang }): JSX.Element {
  const [lang, setLangState] = useState<HudLang>(() => initial ?? readLang());
  const setLang = useCallback((l: HudLang) => {
    setLangState(l);
    safeStorage()?.setItem(LANG_KEY, l);
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <HudLangContext.Provider value={value}>{children}</HudLangContext.Provider>;
}

/** Provider for sub-trees that need to read the active lang without
 *  becoming a child of <Hud />. The initial value is taken from
 *  localStorage / navigator.language if not supplied. */
export function HudLangProvider({ children, initial }: { children: ReactNode; initial?: HudLang }): JSX.Element {
  return <HudLangStore initial={initial}>{children}</HudLangStore>;
}

/** Active HUD language and a setter. Persists to localStorage.
 *  - When the caller is inside a <Hud /> (or <HudLangProvider />), the
 *    value is the shared state.
 *  - Outside, the hook creates its own state — useful for unit tests. */
export function useHudLang(): HudLangState {
  const ctx = useContext(HudLangContext);
  if (ctx) return ctx;
  // Fall back to local state when the hook is used outside a Hud tree
  // (e.g. unit tests that probe the hook in isolation).
  const [lang, setLangState] = useState<HudLang>(() => readLang());
  const setLang = useCallback((l: HudLang) => {
    setLangState(l);
    safeStorage()?.setItem(LANG_KEY, l);
  }, []);
  return { lang, setLang };
}

interface HudProps {
  /** Optional content rendered under the chrome (e.g. the world embed). */
  children?: ReactNode;
}

/**
 * The HUD root. Mount once near the top of the app. The HUD is just chrome:
 * score / role / level / items / notifications / avatar / leaderboard
 * placeholders, a language toggle, and a collapse-to-one-button behavior.
 */
export function Hud({ children }: HudProps): JSX.Element {
  // The chrome is rendered inside the lang store so the chrome and any
  // descendants see the same state. <HudLangStore /> calls useState
  // internally, which means the chrome is the part of the tree that
  // *owns* the language state.
  return (
    <HudLangStore>
      <HudShell>{children}</HudShell>
    </HudLangStore>
  );
}

/** Inner component that reads lang/collapsed from the store. Splitting
 *  Hud into Hud + HudShell keeps the store as the outermost element. */
function HudShell({ children }: { children?: ReactNode }): JSX.Element {
  const [collapsed, setCollapsedState] = useState<boolean>(() => readCollapsed());
  const { lang, setLang } = useHudLang();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setCollapsed = useCallback((c: boolean) => {
    setCollapsedState(c);
    safeStorage()?.setItem(COLLAPSED_KEY, String(c));
  }, []);

  const labels = useMemo(
    () => ({
      title: t("hud.title", lang),
      collapse: t("hud.collapse", lang),
      expand: t("hud.expand", lang),
      score: t("hud.score", lang),
      role: t("hud.role", lang),
      level: t("hud.level", lang),
      items: t("hud.items", lang),
      notifications: t("hud.notifications", lang),
      avatar: t("hud.avatar", lang),
      leaderboard: t("hud.leaderboard", lang),
      langLabel: t("hud.lang.label", lang),
      langEn: t("hud.lang.en", lang),
      langEs: t("hud.lang.es", lang),
      langPt: t("hud.lang.pt", lang),
    }),
    [lang],
  );

  return (
    <HudRoot
      lang={lang}
      collapsed={collapsed}
      labels={labels}
      onToggleCollapsed={() => setCollapsed(!collapsed)}
      onSetLang={setLang}
    >
      {children}
    </HudRoot>
  );
}
