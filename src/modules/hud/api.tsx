// src/modules/hud/api.tsx — the ONLY public door to the HUD module.
//
// Exports:
//   - Hud: the root component, mount once at the top of the app.
//   - useHudLang(): the active language + setter (shared with sub-panels).
//   - HudLangProvider: opt-in provider for sub-trees outside <Hud />.
//   - setHudGame / showHudToast / useHudGame: a tiny external store for the
//     game-facing chrome (score, level + XP, active round, toast, play list).
//     Game modules push values in; the chrome renders them. No game logic here.
//
// The HUD owns its own collapsed/expanded state and active language, both
// persisted in localStorage.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { t, detectLang, type Lang } from "../i18n/api";
import { HudRoot } from "./HudRoot";
import "./hud.css";

export type HudLang = Lang;
export type LangText = Record<Lang, string>;

const LANG_KEY = "tc.lang";
const COLLAPSED_KEY = "tc.hud.collapsed";
const TOAST_MS = 2600;

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
  return s?.getItem(COLLAPSED_KEY) === "true";
}

// ---------- game-facing store ----------

export interface HudRoundView {
  title: LangText;
  timeLeft: number;
  current: number;
  total: number;
  label?: LangText;
  points: number;
}

export interface HudGameState {
  score: number;
  level: number;
  xpInto: number;
  xpNeed: number;
  teamScore: number;
  round: HudRoundView | null;
  toast: { id: number; text: LangText } | null;
  games: Array<{ slug: string; title: LangText }>;
}

let gameState: HudGameState = { score: 0, level: 1, xpInto: 0, xpNeed: 60, teamScore: 0, round: null, toast: null, games: [] };
const gameListeners = new Set<() => void>();
let toastId = 0;

export function setHudGame(patch: Partial<HudGameState>): void {
  gameState = { ...gameState, ...patch };
  for (const l of gameListeners) l();
}
export function showHudToast(text: LangText): void {
  setHudGame({ toast: { id: ++toastId, text } });
}
export function getHudGame(): HudGameState {
  return gameState;
}
function subscribeGame(cb: () => void): () => void {
  gameListeners.add(cb);
  return () => {
    gameListeners.delete(cb);
  };
}
export function useHudGame(): HudGameState {
  return useSyncExternalStore(subscribeGame, () => gameState, () => gameState);
}

// ---------- language store ----------

interface HudLangState {
  lang: HudLang;
  setLang: (l: HudLang) => void;
}

const HudLangContext = createContext<HudLangState | null>(null);

function HudLangStore({ children, initial }: { children: ReactNode; initial?: HudLang }): JSX.Element {
  const [lang, setLangState] = useState<HudLang>(() => initial ?? readLang());
  const setLang = useCallback((l: HudLang) => {
    setLangState(l);
    safeStorage()?.setItem(LANG_KEY, l);
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <HudLangContext.Provider value={value}>{children}</HudLangContext.Provider>;
}

export function HudLangProvider({ children, initial }: { children: ReactNode; initial?: HudLang }): JSX.Element {
  return <HudLangStore initial={initial}>{children}</HudLangStore>;
}

export function useHudLang(): HudLangState {
  const ctx = useContext(HudLangContext);
  if (ctx) return ctx;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [lang, setLangState] = useState<HudLang>(() => readLang());
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const setLang = useCallback((l: HudLang) => {
    setLangState(l);
    safeStorage()?.setItem(LANG_KEY, l);
  }, []);
  return { lang, setLang };
}

// ---------- root ----------

export type HudMenuTab = "play" | "customize" | "leaderboard" | "settings";

interface HudProps {
  children?: ReactNode;
  /** Start a minigame round by slug (wired by the app shell). */
  onAction?: (slug: string) => void;
  /** Stop the active round. */
  onStop?: () => void;
  /** Open the menu drawer (menu button, Avatar / Leaderboard rows). */
  onMenu?: (tab?: HudMenuTab) => void;
}

export function Hud({ children, onAction, onStop, onMenu }: HudProps): JSX.Element {
  return (
    <HudLangStore>
      <HudShell onAction={onAction} onStop={onStop} onMenu={onMenu}>{children}</HudShell>
    </HudLangStore>
  );
}

function HudShell({ children, onAction, onStop, onMenu }: HudProps): JSX.Element {
  const [collapsed, setCollapsedState] = useState<boolean>(() => readCollapsed());
  const { lang, setLang } = useHudLang();
  const game = useHudGame();

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  // Toasts clear themselves.
  useEffect(() => {
    if (!game.toast) return;
    const id = game.toast.id;
    const timer = setTimeout(() => {
      if (getHudGame().toast?.id === id) setHudGame({ toast: null });
    }, TOAST_MS);
    return () => clearTimeout(timer);
  }, [game.toast]);

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
      play: t("hud.play", lang),
      stop: t("hud.stop", lang),
      time: t("hud.time", lang),
      points: t("hud.points", lang),
      xp: t("hud.xp", lang),
      team: t("hud.team", lang),
      menu: t("hud.menu", lang),
    }),
    [lang],
  );

  return (
    <HudRoot
      lang={lang}
      collapsed={collapsed}
      labels={labels}
      game={game}
      onToggleCollapsed={() => setCollapsed(!collapsed)}
      onSetLang={setLang}
      onAction={onAction}
      onStop={onStop}
      onMenu={onMenu}
    >
      {children}
    </HudRoot>
  );
}
