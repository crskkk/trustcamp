import { useEffect, useState } from "react";
import { t } from "./modules/i18n/api";
import { useHudLang } from "./modules/hud/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";
import { WorldEmbed } from "./modules/world/api";
import { Hud } from "./modules/hud/api";
import { startOrbit, stopOrbit } from "./modules/screensaver/api";
import { PresenceOverlay } from "./modules/presence/api";
import { joinWorld as bridgeJoinWorld, sendState as bridgeSendState } from "./modules/bridge/api";
import { spawnNpc, clearNpcs, listNpcs, setNpcCap } from "./modules/npc/api";

export function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/screensaver") {
    return <Screensaver />;
  }
  return (
    <div className="tc-app">
      <Bootstrap />
      <Hud>
        <AppSubtitle />
        <WorldEmbed />
      </Hud>
      {import.meta.env.DEV && (
        <>
          <StatusPanel />
          <PresenceOverlay selfId={SELF_ID} />
          <NpcDevControls />
        </>
      )}
    </div>
  );
}

// Each tab mints its own opaque session id at module load. Sharing this with
// the cross-tab heartbeat lets other tabs dedupe "self" correctly without
// needing a backend identity provider.
const SELF_ID: string =
  (typeof window !== "undefined" &&
    (window.crypto?.randomUUID?.() ?? "self-" + Math.random().toString(36).slice(2, 12))) ||
  "self";

/**
 * Join the bridge world and tick a position on a 2-second cadence so the
 * PresenceOverlay can populate from sibling tabs in dev (and so the
 * real Supabase channel — when configured — also sees us in v3).
 *
 * Also seeds a small NPC population in dev so the chip strip is non-empty
 * on first load (task 0103). Real spawn policy / dynamics land in 0104.
 */
function Bootstrap(): null {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const join = await bridgeJoinWorld();
      const id = join.sessionId || SELF_ID;
      if (stopped) return;
      const tick = () => {
        bridgeSendState({
          playerId: id,
          x: 0,
          y: 0,
          z: 0,
          role: "scout",
        }).catch(() => undefined);
      };
      tick();
      timer = setInterval(tick, 2000);

      // Seed a small dev population of NPCs (task 0103). 3 deterministic
      // prospects so the visual checkpoint is reproducible across runs.
      setNpcCap(8);
      for (const seed of [101, 202, 303]) {
        spawnNpc({ seed, role: "prospect" });
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []);
  return null;
}

/**
 * Dev-only NPC controls: a "Clear NPCs" button next to the status panel
 * and a counter showing the current NPC count. Tree-shaken in production.
 */
function NpcDevControls(): JSX.Element {
  const [count, setCount] = useStateNpcs();
  const { lang } = useHudLang();
  return (
    <div className="tc-npc-dev" data-testid="npc-dev">
      <span className="tc-npc-dev-label">{t("npc.dev.label", lang)}: </span>
      <span className="tc-npc-dev-count" data-testid="npc-count">{count}</span>
      <button
        type="button"
        className="tc-npc-dev-clear"
        data-testid="npc-clear"
        onClick={() => {
          clearNpcs();
          setCount(0);
        }}
      >
        {t("npc.dev.clear", lang)}
      </button>
    </div>
  );
}

// Tiny local hook so the dev control re-renders when the spawner mutates
// the list. We don't subscribe to presence events here (kept small); we
// just read listNpcs() on demand and on click.
function useStateNpcs(): [number, (n: number) => void] {
  const [n, setN] = useState(() => (typeof window === "undefined" ? 0 : listNpcs().length));
  useEffect(() => {
    const i = setInterval(() => setN(listNpcs().length), 500);
    return () => clearInterval(i);
  }, []);
  return [n, setN];
}

/**
 * Screensaver / landing mode (task 0009): the planet full-bleed with no HUD
 * chrome, camera auto-orbiting under shell control. The detach hook
 * (window.__tcScreensaver.stop) is where host steering lands later.
 */
function Screensaver(): JSX.Element {
  useEffect(() => {
    startOrbit();
    return () => stopOrbit();
  }, []);
  return (
    <div className="tc-app">
      <WorldEmbed />
    </div>
  );
}

/**
 * AppSubtitle component that reads language from HUD context.
 * Uses useHudLang() to get the current language and renders
 * a localized subtitle that updates when language changes.
 */
function AppSubtitle(): JSX.Element {
  const { lang } = useHudLang();
  return <p className="tc-app-subtitle">{t("app.subtitle", lang)}</p>;
}
