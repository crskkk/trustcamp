import { useEffect } from "react";
import { t } from "./modules/i18n/api";
import { useHudLang } from "./modules/hud/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";
import { WorldEmbed } from "./modules/world/api";
import { Hud } from "./modules/hud/api";
import { startOrbit, stopOrbit } from "./modules/screensaver/api";
import { PresenceOverlay } from "./modules/presence/api";

export function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/screensaver") {
    return <Screensaver />;
  }
  return (
    <div className="tc-app">
      <Hud>
        <AppSubtitle />
        <WorldEmbed />
      </Hud>
      {import.meta.env.DEV && (
        <>
          <StatusPanel />
          <PresenceOverlay selfId="self" />
        </>
      )}
    </div>
  );
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
