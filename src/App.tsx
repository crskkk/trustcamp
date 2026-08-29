import { t } from "./modules/i18n/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";
import { WorldEmbed } from "./modules/world/api";

export function App() {
  return (
    <div className="tc-app">
      <h1>{t("app.title")}</h1>
      <p>{t("app.subtitle")}</p>
      <WorldEmbed />
      {import.meta.env.DEV && <StatusPanel />}
    </div>
  );
}
