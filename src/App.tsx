import { useEffect } from "react";
import { t } from "./modules/i18n/api";
import { useHudLang } from "./modules/hud/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";
import { WorldEmbed } from "./modules/world/api";
import { Hud } from "./modules/hud/api";
import { startOrbit, stopOrbit } from "./modules/screensaver/api";
import { PresenceOverlay } from "./modules/presence/api";
import { joinWorld as bridgeJoinWorld, sendState as bridgeSendState } from "./modules/bridge/api";

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
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []);
  return null;
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
