import { t } from "./modules/i18n/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";

export function App() {
  return (
    <div className="tc-app">
      <h1>{t("app.title")}</h1>
      <p>{t("app.subtitle")}</p>
      <div className="tc-unity-placeholder" data-testid="unity-placeholder">
        {t("unity.placeholder")}
      </div>
      {import.meta.env.DEV && <StatusPanel />}
    </div>
  );
}
