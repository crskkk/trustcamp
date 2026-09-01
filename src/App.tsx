import { t } from "./modules/i18n/api";
import { useHudLang } from "./modules/hud/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";
import { WorldEmbed } from "./modules/world/api";
import { Hud } from "./modules/hud/api";

export function App() {
  return (
    <div className="tc-app">
      <Hud>
        <AppSubtitle />
        <WorldEmbed />
      </Hud>
      {import.meta.env.DEV && <StatusPanel />}
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