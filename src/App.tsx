import { t } from "./modules/i18n/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";
import { WorldEmbed } from "./modules/world/api";
import { Hud } from "./modules/hud/api";

export function App() {
  return (
    <div className="tc-app">
      <Hud>
        <p className="tc-app-subtitle">{t("app.subtitle")}</p>
        <WorldEmbed />
      </Hud>
      {import.meta.env.DEV && <StatusPanel />}
    </div>
  );
}
