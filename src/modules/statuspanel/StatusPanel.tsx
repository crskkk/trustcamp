import { useEffect, useState } from "react";
import { t } from "../i18n/api";
import {
  runAllWorkers,
  readTestResults,
  readVersion,
  readSystemMd,
  type PanelState,
} from "./panelRuntime";

const WORKER_KEYS = [
  "arch-check",
  "i18n-check",
  "system-update",
  "bundle-guard",
] as const;

type WorkerKey = (typeof WORKER_KEYS)[number];

export function StatusPanel() {
  const [state, setState] = useState<PanelState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  async function refresh() {
    const results = await runAllWorkers();
    const tests = await readTestResults();
    const version = await readVersion();
    const systemMd = await readSystemMd();
    setState({ results, tests, version, systemMd });
  }

  useEffect(() => {
    refresh().catch(() => setState(null));
  }, []);

  if (dismissed) {
    return (
      <button className="tc-sp-resume" onClick={() => setDismissed(false)}>
        ⟳
      </button>
    );
  }

  const tests = state?.tests;
  const testsLabel = tests
    ? `${tests.passed} / ${tests.total}`
    : t("status.notrun");

  return (
    <section className="tc-sp" data-testid="status-panel" aria-label={t("status.title")}>
      <header className="tc-sp-head">
        <strong>{t("status.title")}</strong>
        <div className="tc-sp-actions">
          <button onClick={refresh} aria-label={t("status.refresh")}>↻</button>
          <button onClick={() => setDismissed(true)} aria-label={t("status.dismiss")}>×</button>
        </div>
      </header>

      <div className="tc-sp-section">
        <div className="tc-sp-label">{t("status.workers")}</div>
        <ul className="tc-sp-workers">
          {WORKER_KEYS.map((k) => {
            const r = state?.results[k];
            const status = r?.ok === undefined ? "pending" : r.ok ? "ok" : "bad";
            const detail = r?.message ?? t("status.running");
            return (
              <li key={k} className={`tc-sp-worker tc-sp-worker--${status}`}>
                <span className={`tc-sp-dot ${status}`} aria-hidden="true" />
                <span className="tc-sp-worker-name">{t(`worker.${k}`)}</span>
                <span
                  className="tc-sp-worker-detail"
                  data-testid={`worker-detail-${k}`}
                  title={detail}
                >
                  {detail}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="tc-sp-row">
        <span className="tc-sp-label">{t("status.tests")}</span>
        <span className="tc-sp-value" data-testid="tests-value">{testsLabel}</span>
      </div>

      <div className="tc-sp-row">
        <span className="tc-sp-label">{t("status.version")}</span>
        <span className="tc-sp-chip" data-testid="version-chip">{state?.version ?? t("status.notrun")}</span>
      </div>

      <details className="tc-sp-system" open>
        <summary>{t("status.system")}</summary>
        <pre data-testid="system-preview">{state?.systemMd ?? ""}</pre>
      </details>
    </section>
  );
}
